import { getSettings } from "@/db/settings";

/**
 * Worker API(/api/*)呼び出し用の認証ヘッダ(Issue #87)。
 * 設定画面で入力したAPIトークン(Settings.apiToken)をAuthorizationヘッダで送る。
 * 未設定なら何も付けない(Worker側もAPI_AUTH_TOKEN未設定なら認証を要求しない)。
 */
export async function apiAuthHeaders(): Promise<Record<string, string>> {
  const { apiToken } = await getSettings();
  return apiToken ? { authorization: `Bearer ${apiToken}` } : {};
}
