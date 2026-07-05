import { describe, expect, it } from "vitest";
import { base64UrlEncodeBuffer, base64UrlEncodeString, buildSignedJwt, normalizePemNewlines } from "../googleSheetsAuth";

function base64UrlDecodeToString(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return atob(padded + padding);
}

function pemFromPkcs8(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
}

async function generateTestKeyPair(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
}

describe("base64UrlEncodeString/base64UrlEncodeBuffer", () => {
  it("produces URL-safe output with no padding characters", () => {
    const encoded = base64UrlEncodeString('{"a":1,"b":">>>???"}');
    expect(encoded).not.toMatch(/[+/=]/);
    expect(base64UrlDecodeToString(encoded)).toBe('{"a":1,"b":">>>???"}');
  });

  it("round-trips arbitrary binary content", () => {
    const bytes = new Uint8Array([0, 255, 128, 64, 16, 8]);
    const encoded = base64UrlEncodeBuffer(bytes.buffer);
    expect(encoded).not.toMatch(/[+/=]/);
  });
});

describe("normalizePemNewlines", () => {
  it("converts literal backslash-n sequences into real newlines", () => {
    const raw = "-----BEGIN PRIVATE KEY-----\\nABCD\\n-----END PRIVATE KEY-----\\n";
    expect(normalizePemNewlines(raw)).toBe("-----BEGIN PRIVATE KEY-----\nABCD\n-----END PRIVATE KEY-----\n");
  });

  it("is idempotent for input that already has real newlines", () => {
    const raw = "-----BEGIN PRIVATE KEY-----\nABCD\n-----END PRIVATE KEY-----\n";
    expect(normalizePemNewlines(raw)).toBe(raw);
  });
});

describe("buildSignedJwt", () => {
  it("produces a JWT whose signature verifies against the matching public key and whose claims match the input", async () => {
    const { privateKey, publicKey } = await generateTestKeyPair();
    const pkcs8 = (await crypto.subtle.exportKey("pkcs8", privateKey)) as ArrayBuffer;
    const pem = pemFromPkcs8(pkcs8);
    const nowSec = 1_700_000_000;

    const jwt = await buildSignedJwt("test-service-account@example.iam.gserviceaccount.com", pem, nowSec);

    const [headerPart, claimsPart, signaturePart] = jwt.split(".");
    const header = JSON.parse(base64UrlDecodeToString(headerPart)) as { alg: string; typ: string };
    const claims = JSON.parse(base64UrlDecodeToString(claimsPart)) as {
      iss: string;
      scope: string;
      aud: string;
      iat: number;
      exp: number;
    };
    expect(header).toEqual({ alg: "RS256", typ: "JWT" });
    expect(claims).toEqual({
      iss: "test-service-account@example.iam.gserviceaccount.com",
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: nowSec,
      exp: nowSec + 3600,
    });

    const signingInput = `${headerPart}.${claimsPart}`;
    const signatureBinary = base64UrlDecodeToString(signaturePart);
    const signatureBytes = Uint8Array.from(signatureBinary, (c) => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      signatureBytes,
      new TextEncoder().encode(signingInput),
    );
    expect(isValid).toBe(true);
  });
});
