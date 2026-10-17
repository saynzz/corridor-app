import crypto from "node:crypto";

const b64u = (b: Buffer) => b.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const unb64u = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export function sha256Hex(b: Buffer | string) {
  return crypto.createHash("sha256").update(b).digest("hex");
}

export function newKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

export function signJws(payload: object, privateKeyPem: string, kid: string) {
  const header = { alg: "EdDSA", typ: "JWT", kid };
  const input = b64u(Buffer.from(JSON.stringify(header))) + "." + b64u(Buffer.from(JSON.stringify(payload)));
  const sig = crypto.sign(null, Buffer.from(input), crypto.createPrivateKey(privateKeyPem));
  return input + "." + b64u(sig);
}

export function decodeJws(jws: string) {
  const [h, p] = jws.split(".");
  return { header: JSON.parse(unb64u(h).toString()), payload: JSON.parse(unb64u(p).toString()) };
}

export function verifyJws(jws: string, publicKeyPem: string) {
  const parts = jws.split(".");
  if (parts.length !== 3) return false;
  try {
    return crypto.verify(null, Buffer.from(parts[0] + "." + parts[1]), crypto.createPublicKey(publicKeyPem), unb64u(parts[2]));
  } catch {
    return false;
  }
}

export function randomId(prefix: string) {
  return prefix + "_" + crypto.randomBytes(6).toString("hex");
}
