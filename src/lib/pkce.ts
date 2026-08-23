/**
 * OAuth 2.0 の PKCE(RFC 7636)で使う値の生成(Issue #214)。
 *
 * トークン交換はWorkerが `client_secret` を添えて行うためPKCEは必須ではないが、
 * 認可コードは**ブラウザのURLに一度現れる**(リダイレクトのクエリ)。横取りされたコードを
 * 単体では使えなくするために付けている。Web Crypto APIのみを使う(Node固有APIは使わない)。
 */

/** RFC 7636 が定める code_verifier の長さの範囲は43〜128文字。上限に寄せて余裕を持たせる */
const VERIFIER_BYTES = 64;

/** base64url(パディング無し)。認可URLのクエリにそのまま載せられる形 */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** ランダムなbase64url文字列。code_verifier と state の両方に使う */
export function generateRandomToken(byteLength = VERIFIER_BYTES): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/** code_verifier から code_challenge(S256)を作る。Googleは plain を受け付けないためS256固定 */
export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return toBase64Url(new Uint8Array(digest));
}
