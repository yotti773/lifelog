import { apiAuthHeaders } from "@/api/apiAuth";

/**
 * Worker API(/api/*)呼び出しの共通処理(Issue #204・#205)。
 *
 * 2026-08-09、壊れたService Workerが原因で /api/* への通信が全て失敗した際(Issue #203)、
 * 画面に出たのがブラウザ生の "Failed to fetch" だけだったため切り分けに難儀した。
 * そのため「サーバーに届かなかった」と「サーバーがエラーを返した」をここで明確に分ける —
 * 前者はユーザーの対処(通信環境の確認・アプリのリセット)が必要で、後者は待てば直りうるため。
 */

/** AI生成(週次・月次コメント、食事写真判定)のタイムアウト。Worker側で1回リトライしうるぶん長めに取る */
export const AI_REQUEST_TIMEOUT_MS = 120_000;

/**
 * 同期・取り込みのタイムアウト。
 *
 * **短くしすぎないこと。** 同期は未同期分をまとめて1リクエストで送り、分割送信の仕組みが無い
 * (`runSync`)。長期のオフライン後など未同期が大量にたまった状態でタイムアウトすると、
 * 次回も同じ量を送って同じように打ち切られ、永久に同期できなくなる。
 * 全タブの取り込み(`/api/import-sheets`)も行数に比例して伸びる。
 * ここでの目的は「速く諦めること」ではなく「応答が返らないまま無限に待たせないこと」。
 */
export const SYNC_REQUEST_TIMEOUT_MS = 180_000;

export const API_CONNECTION_MESSAGE =
  "サーバーに接続できませんでした。通信環境を確認してください。繰り返す場合は設定画面の「アプリのリセット」をお試しください";

export const API_TIMEOUT_MESSAGE = "サーバーから応答がありませんでした。時間をおいて再試行してください";

export const API_INVALID_RESPONSE_MESSAGE =
  "サーバーから正しい応答が得られませんでした。繰り返す場合は設定画面の「アプリのリセット」をお試しください";

/**
 * サーバーに到達できなかった(接続不成立・タイムアウト)ことを表すエラー。
 * サーバーが返した業務エラーとはUI上の扱いを変えるため、型で区別できるようにしている。
 */
export class ApiConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiConnectionError";
  }
}

export function isApiConnectionError(error: unknown): error is ApiConnectionError {
  return error instanceof ApiConnectionError;
}

export interface ApiRequestOptions {
  method?: "GET" | "POST";
  /** JSONとして送るリクエストボディ。省略時はボディ無し(GET) */
  body?: unknown;
  timeoutMs: number;
  /** サーバーがJSONの `error` を返さなかった場合に使う文言。ステータスを含めたい呼び出し元があるため関数で受ける */
  fallbackErrorMessage: (status: number) => string;
}

/**
 * 認証ヘッダ付与・タイムアウト・エラー整形をまとめて行う。
 * 成功時はレスポンスのJSONをそのまま返す(形の検証は呼び出し元の責務)。
 */
export async function requestApi<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const { method = "GET", body, timeoutMs, fallbackErrorMessage } = options;
  const authHeaders = await apiAuthHeaders();

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? authHeaders : { "content-type": "application/json", ...authHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // fetch自体が失敗するのは接続不成立(TypeError)かタイムアウト(TimeoutError)だけ。
    // どちらもユーザーから見れば「サーバーに届かなかった」なので同じ型で投げ、文言だけ分ける
    const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
    throw new ApiConnectionError(isTimeout ? API_TIMEOUT_MESSAGE : API_CONNECTION_MESSAGE);
  }

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorBody?.error ?? fallbackErrorMessage(res.status));
  }

  try {
    return (await res.json()) as T;
  } catch (error) {
    // 200なのにJSONでないのは、Workerではない何かが応答している(SPAのindex.htmlが返る・
    // キャプティブポータルに攫われる等)ということ。ボディ読み取り中のタイムアウトもここに来る。
    // いずれも「サーバーからの正しい応答が得られなかった」で、対処は接続不能時と同じ
    const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
    throw new ApiConnectionError(isTimeout ? API_TIMEOUT_MESSAGE : API_INVALID_RESPONSE_MESSAGE);
  }
}
