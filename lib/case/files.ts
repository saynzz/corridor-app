import fs from "node:fs";
import path from "node:path";

export function dataDir() {
  return process.env.DATA_DIR || (process.env.DATA_FILE ? path.dirname(process.env.DATA_FILE) : path.join(process.cwd(), "data"));
}

export function readJson<T>(rel: string, fallback: () => T): T {
  const f = path.join(dataDir(), rel);
  if (!fs.existsSync(f)) {
    const v = fallback();
    writeJson(rel, v);
    return v;
  }
  return JSON.parse(fs.readFileSync(f, "utf8")) as T;
}

export function writeJson(rel: string, v: unknown) {
  const f = path.join(dataDir(), rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = f + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(v, null, 2));
  fs.renameSync(tmp, f);
}

export function writeBytes(rel: string, b: Buffer) {
  const f = path.join(dataDir(), rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, b);
}

export function readBytes(rel: string) {
  return fs.readFileSync(path.join(dataDir(), rel));
}

export function removeRel(rel: string) {
  fs.rmSync(path.join(dataDir(), rel), { recursive: true, force: true });
}
