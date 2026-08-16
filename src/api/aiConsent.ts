import { getSettings, hasAiConsent } from "@/db/settings";

/**
 * AI機能を呼ぶ前に同意(Issue #219)を確認するガード。
 *
 * **UIで止めるだけにしない理由:** AI機能は現在3つの入口(週次コメント・月次コメント・食事判定)から
 * 呼ばれており、画面側の分岐だけで守ると、4つ目の呼び出しを足したときに黙ってすり抜ける。
 * 送信の直前で必ず通るこの層に置くことで、同意していない人のデータがGeminiへ渡らないことを
 * 構造として担保する。通常は画面側が先に同意ダイアログを出すため、ここが発火するのは実装漏れのとき。
 */
export async function assertAiConsent(): Promise<void> {
  const settings = await getSettings();
  if (!hasAiConsent(settings)) {
    throw new Error("AI機能の利用にはデータ送信への同意が必要です。設定画面から同意してください");
  }
}
