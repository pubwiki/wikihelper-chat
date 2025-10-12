// lib/token.ts
import * as jose from "jose";

const ISS = "chat-wiki";
const AUD = "api";
const ALG = "EdDSA"; // 也可以 HS256；EdDSA 更稳妥
let keyPair: { publicKey: CryptoKey; privateKey: CryptoKey } | null = null;

export async function getKeyPair() {
  if (!keyPair) {
    keyPair = await jose.generateKeyPair("EdDSA"); 
  }
  return keyPair;
}

export async function signAnonJWT(ttlSec = 1800) {
  const { privateKey } = await getKeyPair();
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();
  return new jose.SignJWT({ ver: 1, scope: "access" })
    .setProtectedHeader({ alg: ALG, typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSec)
    .setJti(jti)
    .setIssuer(ISS)
    .setAudience(AUD)
    .sign(privateKey);
}

export async function verifyAnonJWT(token: string) {
  const { publicKey } = await getKeyPair();
  const { payload } = await jose.jwtVerify(token, publicKey, {
    issuer: ISS,
    audience: AUD,
  });
  // 这里只判断签名+exp是否有效，不读取任何身份字段
  return payload; // 包含 { ver, scope, iat, exp, jti, iss, aud }
}
