import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const f = path.join(process.cwd(), "reports", "eval-report.md");
  if (!fs.existsSync(f)) return NextResponse.json({ ok: false });
  const md = fs.readFileSync(f, "utf8");
  const model = md.match(/^- Model: (.*)$/m)?.[1]?.replace(/`/g, "") ?? "";
  const run = md.match(/^- Run: (.*)$/m)?.[1] ?? "";
  const rows: { suite: string; passed: string }[] = [];
  const head = md.split("## ")[0];
  for (const line of head.split("\n")) {
    const m = line.match(/^\| ([^|]+) \| (\d+\/\d+) \|$/);
    if (m) rows.push({ suite: m[1].trim(), passed: m[2] });
  }
  const metrics = head.match(/^Interaction metrics.*$/m)?.[0] ?? "";
  return NextResponse.json({ ok: true, model, run, rows, metrics });
}
