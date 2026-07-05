import type { Env } from "./index";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlEncodeString(input: string): string {
  return toBase64Url(new TextEncoder().encode(input));
}

export function base64UrlEncodeBuffer(input: ArrayBuffer): string {
  return toBase64Url(new Uint8Array(input));
}

/** Cloudflareのシークレットに1行で貼り付けた場合、改行がリテラルな "\n" として保存されることがあるため正規化する。 */
export function normalizePemNewlines(raw: string): string {
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

export function pemToPkcs8ArrayBuffer(pem: string): ArrayBuffer {
  const base64Body = normalizePemNewlines(pem.trim())
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/[\r\n\s]+/g, "");
  const binary = atob(base64Body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** サービスアカウントのJWTアサーションを組み立てて署名する(Google OAuth2のJWT Bearerフロー)。 */
export async function buildSignedJwt(email: string, privateKeyPem: string, nowSec: number): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSec,
    exp: nowSec + 3600,
  };
  const signingInput = `${base64UrlEncodeString(JSON.stringify(header))}.${base64UrlEncodeString(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8ArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncodeBuffer(signature)}`;
}

async function fetchGoogleAccessToken(jwt: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google認証トークンの取得に失敗しました (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Google認証トークンにaccess_tokenが含まれていません");
  }
  return data.access_token;
}

export async function getGoogleAccessToken(env: Env): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const jwt = await buildSignedJwt(env.GOOGLE_SERVICE_ACCOUNT_EMAIL, env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, nowSec);
  return fetchGoogleAccessToken(jwt);
}
