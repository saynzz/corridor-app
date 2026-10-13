import { NextResponse } from "next/server";
import { history } from "@/lib/fx";
import type { Currency } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const base = (u.searchParams.get("base") || "SGD") as Currency;
  const quote = (u.searchParams.get("quote") || "KZT") as Currency;
  const h = await history(base, quote, 30);
  const t = Date.now() / 1000;
  const live = h.current * (1 + 0.0012 * Math.sin(t / 17) + 0.0005 * Math.sin(t / 3.1));
  return NextResponse.json({ base, quote, ...h, live });
}
