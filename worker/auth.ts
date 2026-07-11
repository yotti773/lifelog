// Worker APIの共有トークン認証(Issue #87)。
// 単一ユーザー前提の最小構成: シークレットAPI_AUTH_TOKENとAuthorizationヘッダの一致だけを見る。
// マルチユーザー化(#67)の際はここを本格的な認証に置き換える。

/**
 * Authorizationヘッダが期待トークンと一致するかを判定する。
 * 期待トークンが未設定(undefined/空文字)の場合は認証を要求しない —
 * ローカル開発(.dev.vars未設定)と、シークレット登録→クライアント設定完了までの移行期間を壊さないため。
 */
export function isAuthorized(authorizationHeader: string | null, expectedToken: string | undefined): boolean {
  if (!expectedToken) return true;
  if (!authorizationHeader) return false;
  const match = /^Bearer\s+(.+)$/.exec(authorizationHeader);
  return match !== null && match[1] === expectedToken;
}

/** 認証NG時の401レスポンス。クライアント側のエラー表示にそのまま出せる文言を返す */
export function unauthorizedResponse(): Response {
  return Response.json(
    { error: "認証に失敗しました。設定画面のAPIトークンがWorkerのAPI_AUTH_TOKENと一致しているか確認してください" },
    { status: 401 },
  );
}
