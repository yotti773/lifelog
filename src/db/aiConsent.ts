import { getSettings, updateSettings } from "./settings";

/**
 * AIへの送信に対する同意(Issue #219)。
 *
 * **他人に配る以上、健康データを第三者(GoogleのGemini API)へ送る前に説明と同意が要る。**
 * 特商法(検討メモ12.5)は無償配布では不要だが、これはそれとは別の話で省略できない。
 *
 * **同意はAI機能だけを止める。** 記録・同期・グラフは同意しなくても全部使える —
 * このアプリの中心は記録であって、AIコメントは補助だから(要件定義書3章のMVP優先度)。
 *
 * **同意状態はシート同期に載せない。** 「この人がこの端末で同意した」という事実であって、
 * 記録ではないため。バックアップJSON(`Settings`)には入るので、機種変更では引き継がれる。
 */

/** 同意済みか。`Settings.aiConsentAt` に同意日時が入っていれば同意済みとみなす */
export async function hasAiConsent(): Promise<boolean> {
  const { aiConsentAt } = await getSettings();
  return typeof aiConsentAt === "string" && aiConsentAt !== "";
}

/** 同意した日時を返す(未同意ならnull)。設定画面の表示用 */
export async function getAiConsentAt(): Promise<string | null> {
  const { aiConsentAt } = await getSettings();
  return typeof aiConsentAt === "string" && aiConsentAt !== "" ? aiConsentAt : null;
}

export async function grantAiConsent(): Promise<void> {
  await updateSettings({ aiConsentAt: new Date().toISOString() });
}

/**
 * 同意を取り消す。**空文字ではなく`undefined`で消す** — 未同意の判定を「値が無い」の一点に保つ。
 * 取り消してもAIが生成済みのコメントは消さない(既に手元にある記録であり、送信とは別の話)。
 */
export async function revokeAiConsent(): Promise<void> {
  await updateSettings({ aiConsentAt: undefined });
}
