// Worker APIの共有トークン認証(Issue #87)。
// シークレットAPI_AUTH_TOKENとAuthorizationヘッダの一致だけを見る最小構成。
// 数人への配布(#213)に備えて**カンマ区切りの複数トークン**を許すようにした(Issue #218) —
// 人ごとに違う値を配れば、1人分だけシークレットから外して失効させられる。
// D1によるユーザー管理は作らない(課金状態と突き合わせる話は有料化に進むときの論点。検討メモ12.2・12.3)。

/**
 * シークレットの値を、許可トークンの配列に分解する。
 * カンマ区切りで、各値の前後の空白は無視し、空の要素は捨てる(`"a, ,b"` → `["a", "b"]`)。
 */
export function parseAuthTokens(secret: string | undefined): string[] {
  if (!secret) return [];
  return secret
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token !== "");
}

/**
 * Authorizationヘッダが許可トークンのいずれかと一致するかを判定する。
 *
 * **「シークレットが存在しない(undefined)」ときだけ認証を要求しない。**
 * ローカル開発(.dev.vars にこの行が無い)と、シークレット登録→クライアント設定完了までの
 * 移行期間(#87)を壊さないための穴で、そこは従来どおり。
 *
 * **一方、シークレットは在るのに解釈できるトークンが0本("" / "," / "  " など)なら全拒否する。**
 * 複数トークン化(#218)で「シークレットを手編集してトークンを1本ずつ抜く」運用が加わったため、
 * 最後の1本を抜いた結果この状態になりうる。ここを未設定と同じ「全許可」にすると、
 * **失効させたつもりの操作でAPIが黙って全開放**され、健康データの読み出し(/api/import-sheets)も
 * Gemini課金(/api/judge-meal)も無認証で通ってしまう。全拒否なら401ですぐ気づけるため、
 * 事故ったときに倒れる向きとしてこちらを選ぶ。
 * 全員を止めたいときは、シークレットを空にするのではなく**誰にも渡していない新しい値に差し替える**。
 */
export function isAuthorized(authorizationHeader: string | null, expectedToken: string | undefined): boolean {
  if (expectedToken === undefined) return true;
  const allowedTokens = parseAuthTokens(expectedToken);
  if (allowedTokens.length === 0) return false;
  if (!authorizationHeader) return false;
  const match = /^Bearer\s+(.+)$/.exec(authorizationHeader);
  if (match === null) return false;
  return allowedTokens.includes(match[1]);
}

/** 認証NG時の401レスポンス。クライアント側のエラー表示にそのまま出せる文言を返す */
export function unauthorizedResponse(): Response {
  return Response.json(
    { error: "認証に失敗しました。設定画面のAPIトークンがWorkerのAPI_AUTH_TOKENと一致しているか確認してください" },
    { status: 401 },
  );
}
