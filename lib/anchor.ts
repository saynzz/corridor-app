import crypto from "node:crypto";
import { readJson, writeJson } from "./case/files";
import { load, verifyChain, GENESIS } from "./store";

export interface AnchorRecord {
  height: number;
  at: string;
  provider: "local" | "webase";
  root: string;
  count: number;
  reason: string;
  prevBlock: string;
  block: string;
  txHash?: string;
  blockNumber?: number;
  status: "ANCHORED" | "FAILED";
  error?: string;
}

interface Ledger {
  blocks: AnchorRecord[];
}

const FILE = "ledger.json";

export const ANCHOR_ABI = [
  {
    type: "function",
    name: "anchor",
    constant: false,
    inputs: [
      { name: "root", type: "bytes32" },
      { name: "count", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
  },
];

export function anchorProvider(): "local" | "webase" {
  return process.env.ANCHOR_PROVIDER === "webase" ? "webase" : "local";
}

export function ledger(): Ledger {
  return readJson<Ledger>(FILE, () => ({ blocks: [] }));
}

export function resetLedger() {
  writeJson(FILE, { blocks: [] });
}

function sha(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

async function sendWebase(root: string, count: number, reason: string) {
  const url = (process.env.WEBASE_URL || "http://127.0.0.1:5002").replace(/\/$/, "") + "/WeBASE-Front/trans/handle";
  const body = {
    groupId: process.env.FISCO_GROUP || "group0",
    user: process.env.ANCHOR_SIGN_USER || "",
    contractName: "CorridorAnchor",
    contractAddress: process.env.ANCHOR_CONTRACT || "",
    funcName: "anchor",
    contractAbi: ANCHOR_ABI,
    funcParam: ["0x" + root, String(count), reason.slice(0, 64)],
    useCns: false,
  };
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  const j = (await r.json().catch(() => ({}))) as { transactionHash?: string; blockNumber?: string | number; status?: string; message?: string; code?: number };
  if (!r.ok || !j.transactionHash) throw new Error(j.message || `WeBASE-Front HTTP ${r.status}`);
  if (j.status && j.status !== "0x0" && j.status !== "0") throw new Error("transaction status " + j.status);
  return { txHash: j.transactionHash, blockNumber: typeof j.blockNumber === "string" ? parseInt(j.blockNumber, j.blockNumber.startsWith("0x") ? 16 : 10) : j.blockNumber };
}

export async function anchorNow(reason: string): Promise<AnchorRecord> {
  const s = load();
  const chain = verifyChain(s);
  const root = chain.head;
  const l = ledger();
  const prev = l.blocks[0];
  if (chain.ok && prev && prev.root === root && prev.status === "ANCHORED") return prev;
  const provider = anchorProvider();
  const rec: AnchorRecord = {
    height: (prev?.height ?? 0) + 1,
    at: new Date().toISOString(),
    provider,
    root,
    count: chain.length,
    reason,
    prevBlock: prev?.block ?? GENESIS,
    block: "",
    status: chain.ok ? "ANCHORED" : "FAILED",
    error: chain.ok ? undefined : "audit chain is broken — refusing to anchor",
  };
  if (chain.ok && provider === "webase") {
    try {
      const tx = await sendWebase(root, chain.length, reason);
      rec.txHash = tx.txHash;
      rec.blockNumber = tx.blockNumber;
    } catch (e) {
      rec.status = "FAILED";
      rec.error = e instanceof Error ? e.message : String(e);
    }
  }
  rec.block = sha(JSON.stringify([rec.height, rec.prevBlock, rec.root, rec.count, rec.reason, rec.at, rec.txHash ?? null]));
  const fresh = ledger();
  fresh.blocks.unshift(rec);
  if (fresh.blocks.length > 200) fresh.blocks.length = 200;
  writeJson(FILE, fresh);
  return rec;
}

export function anchorSoon(reason: string) {
  anchorNow(reason).catch((e) => console.error("anchor failed", e));
}

export function verifyAnchors() {
  const s = load();
  const chain = verifyChain(s);
  const hashes = new Set(s.audit.map((e) => e.hash));
  const l = ledger();
  let linksOk = true;
  for (let i = 0; i < l.blocks.length; i++) {
    const b = l.blocks[i];
    const expectPrev = l.blocks[i + 1]?.block ?? GENESIS;
    const recomputed = sha(JSON.stringify([b.height, b.prevBlock, b.root, b.count, b.reason, b.at, b.txHash ?? null]));
    if (b.prevBlock !== expectPrev || recomputed !== b.block) linksOk = false;
  }
  const anchored = l.blocks.filter((b) => b.status === "ANCHORED");
  const missing = anchored.filter((b) => !hashes.has(b.root) && b.root !== GENESIS);
  const oldestKept = s.audit[s.audit.length - 1]?.at ?? "";
  const missingInWindow = missing.filter((b) => b.at >= oldestKept);
  return {
    chain,
    provider: anchorProvider(),
    ledgerOk: linksOk,
    anchors: l.blocks.slice(0, 10),
    anchoredRootsFound: anchored.length - missing.length,
    anchoredRootsMissing: missingInWindow.length,
    ok: chain.ok && linksOk && missingInWindow.length === 0,
  };
}
