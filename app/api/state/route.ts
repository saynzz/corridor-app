import { NextResponse } from "next/server";
import { load } from "@/lib/store";
import { toBase, round2 } from "@/lib/fx";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = load();
  const wallets = await Promise.all(s.wallets.map(async (w) => ({ ...w, inBase: round2(await toBase(w.balance, w.currency)) })));
  const totalBase = round2(wallets.reduce((a, w) => a + w.inBase, 0));
  return NextResponse.json({
    profile: s.profile,
    wallets,
    totalBase,
    bills: s.bills.map((b) => ({ ...b, payee: s.payees.find((p) => p.id === b.payeeId)?.name })),
    transactions: s.transactions.slice(0, 10),
    pending: s.drafts.filter((d) => d.status === "pending" && Date.parse(d.expiresAt) > Date.now()),
    alerts: s.alerts,
    credit: s.credit,
    limits: s.limits,
    payees: s.payees.map((p) => ({ id: p.id, name: p.name, kind: p.kind, account: p.account, verified: p.verified })),
  });
}
