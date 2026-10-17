import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { loadEnv } from "./env";

loadEnv();
process.env.FX_LIVE = "0";
const OUT = path.join(process.cwd(), "reports", "evidence");
fs.rmSync(path.join(OUT, "data"), { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
process.env.DATA_DIR = path.join(OUT, "data");
process.env.DATA_FILE = path.join(process.env.DATA_DIR, "bank.json");

const sh = (c: string) => {
  try {
    return execSync(c, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
};
const sgd = (c: number) => "SGD " + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
const idr = (n: number) => "IDR " + n.toLocaleString("en-US");

(async () => {
  const store = await import("../lib/store");
  const e = await import("../lib/case/engine");
  const anchor = await import("../lib/anchor");
  const { llmConfig } = await import("../lib/llm");

  store.reset();
  e.resetCase();
  anchor.resetLedger();
  const log: string[] = [];
  const step = (s: string) => {
    log.push(`${new Date().toISOString()}  ${s}`);
    console.log("•", s);
  };

  const c0 = e.createCase("student");
  step(`Case created ${c0.id}`);
  e.useSample("student", "valid");
  e.giveConsent("student");
  const vr = e.verify("student");
  step(`Invoice verification: ${vr.verificationStatus} (issuer ${vr.issuerId}, hash ${vr.documentHash})`);
  e.confirmFields("student", {});
  e.calculate("student");
  const plan = e.createPlan("student");
  step(`Plan v${plan.version} ${plan.status}, hash ${plan.hash}`);
  e.approve("payer", { planVersion: plan.version, method: "pin", pin: process.env.PAYER_PIN || "1357" });
  step("Family payer approved step 1 with the family PIN");
  e.approve("student", { planVersion: plan.version, method: "pin", pin: process.env.STUDENT_PIN || process.env.DEMO_PIN || "2468" });
  step("Student approved step 2 with the student PIN");
  e.consoleOp("operator", "posting_delayed");
  const famBefore = e.getCase()!.familyAccount.balanceIdr;
  await e.execute("student", { planVersion: plan.version, idempotencyKey: "evidence-1" });
  await e.execute("student", { planVersion: plan.version, idempotencyKey: "evidence-1" });
  step("Execute sent twice with the same idempotency key");
  e.reconcile();
  e.consoleOp("operator", "post_now");
  e.reconcile();
  const c = e.getCase()!;
  const st = e.status(c);
  step(`Status: transfer ${st.transfer}, posting ${st.posting}, completed ${c.completed}`);
  const anc = await anchor.anchorNow("evidence");
  const integ = anchor.verifyAnchors();
  step(`Audit chain ${integ.chain.ok ? "intact" : "BROKEN"} (${integ.chain.length} entries), anchored block #${anc.height}`);

  const bank = store.load();
  const studentSgd = bank.wallets.find((w) => w.currency === "SGD")!.balance;
  const famDebit = famBefore - c.familyAccount.balanceIdr;
  const cfg = llmConfig();
  const commit = sh("git rev-parse HEAD") || "source snapshot (main branch)";
  const dirty = sh("git status --porcelain") ? " (uncommitted changes present)" : "";
  const evalReport = path.join(process.cwd(), "reports", "eval-report.md");
  const evalHead = fs.existsSync(evalReport) ? fs.readFileSync(evalReport, "utf8").split("## Agent scenarios")[0].trim() : "_Run `npm run eval` first._";
  const runs = fs.existsSync(path.join(process.cwd(), "reports", "runs"))
    ? fs.readdirSync(path.join(process.cwd(), "reports", "runs")).filter((f) => f.endsWith(".jsonl")).sort()
    : [];

  const md = [
    `# Corridor — Execution Evidence`,
    ``,
    `Team FINOVA · International AI Track · Topic C. Sandbox operation evidence: all people, accounts, the university and routes are synthetic.`,
    ``,
    `## Release`,
    ``,
    `| Item | Value |`,
    `|---|---|`,
    `| Repository | https://github.com/saynzz/corridor-app |`,
    `| Commit | \`${commit}\`${dirty} |`,
    `| Generated | ${new Date().toISOString()} |`,
    `| Runtime | Node.js ${process.version}, ${os.platform()} ${os.arch()} |`,
    `| Model | ${cfg.provider === "mock" ? `rule-based test model (\`LLM_PROVIDER=mock\`); production model \`${cfg.model}\`` : `\`${cfg.model}\` via ${cfg.baseUrl}`} |`,
    ``,
    `## 1. Core journey (reproduced by this script)`,
    ``,
    `| Check | Expected | Observed | Result |`,
    `|---|---|---|---|`,
    `| Invoice verification | VALID | ${vr.verificationStatus} | ${vr.verificationStatus === "VALID" ? "✅" : "❌"} |`,
    `| Family top-up | ${sgd(37960)} | ${sgd(plan.funding.topup)} | ${plan.funding.topup === 37960 ? "✅" : "❌"} |`,
    `| Chosen route | B, ${idr(4725000)} | ${c.quotes.find((q) => q.feasible)?.routeId}, ${idr(famDebit)} | ${famDebit === 4725000 ? "✅" : "❌"} |`,
    `| Duplicate execute (same key) | one debit per step | ${Object.keys(c.provider).length} provider records | ${Object.keys(c.provider).length === 2 ? "✅" : "❌"} |`,
    `| Transfer | SETTLED | ${st.transfer} | ${st.transfer === "SETTLED" ? "✅" : "❌"} |`,
    `| University posting | POSTED (signed) | ${st.posting}, verified ${c.posting.events[0]?.verified} | ${c.completed ? "✅" : "❌"} |`,
    `| Student balance after | ${sgd(150000)} | SGD ${studentSgd.toFixed(2)} | ${Math.abs(studentSgd - 1500) < 0.001 ? "✅" : "❌"} |`,
    `| Audit chain | intact, anchored | ${integ.chain.ok ? "intact" : "broken"}, block #${anc.height} (${anc.provider}) | ${integ.ok ? "✅" : "❌"} |`,
    ``,
    `### Identifiers`,
    ``,
    `- Case: \`${c.id}\``,
    `- Proof: \`${vr.proofId}\` · issuer \`${vr.issuerId}\` · key \`${vr.keyId}\``,
    `- Document SHA-256: \`${vr.documentHash}\``,
    `- Plan v${plan.version} hash: \`${plan.hash}\``,
    ...c.approvals.map((a) => `- Approval: ${a.role}, steps ${a.steps.join(",")}, method ${a.method}, plan hash \`${a.planHash.slice(0, 16)}…\``),
    ...c.attempts.map((a) => `- Attempt: step ${a.step}, ${a.status}, key \`${a.key}\``),
    ...c.posting.events.map((p) => `- Posting event: ${p.status} ${sgd(p.amount)}, verified ${p.verified}`),
    `- Audit chain head: \`${integ.chain.head}\` (${integ.chain.length} entries)`,
    `- Ledger block #${anc.height}: \`${anc.block}\``,
    ``,
    `### Step log`,
    ``,
    "```",
    ...log,
    "```",
    ``,
    `## 2. Automated test suites`,
    ``,
    evalHead.replace(/^# .*$/m, "").trim(),
    ``,
    `Full traces: ${runs.length ? runs.map((r) => `\`reports/runs/${r}\``).slice(-1).join(", ") : "_none yet_"}`,
    ``,
    `## 3. How to reproduce`,
    ``,
    "```",
    "git clone https://github.com/saynzz/corridor-app && cd corridor-app",
    "npm install && cp .env.example .env",
    "npm run eval        # all test suites → reports/eval-report.md",
    "npm run evidence    # this file → reports/evidence/EXECUTION_EVIDENCE.md",
    "```",
    ``,
  ].join("\n");

  fs.writeFileSync(path.join(OUT, "EXECUTION_EVIDENCE.md"), md);
  fs.writeFileSync(
    path.join(OUT, "evidence.json"),
    JSON.stringify({ commit, model: cfg.model, provider: cfg.provider, case: c, status: st, audit: bank.audit, ledger: anchor.ledger(), integrity: integ, log }, null, 2)
  );
  console.log(`\nWritten: reports/evidence/EXECUTION_EVIDENCE.md and evidence.json`);
})();
