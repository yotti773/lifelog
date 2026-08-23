import { hasAiConsent } from "@/db/aiConsent";

/**
 * AIへ送る前の同意チェック(Issue #219)。
 *
 * **UIではなくAPI層に置く。** 「同意していない状態でAI機能が呼ばれない」を、画面の分岐ではなく
 * 送信経路の1箇所で保証するため — 新しい呼び出し口が増えても、ここを通る限り漏れない。
 * 画面側は事前に同意ダイアログを出す(`useAiConsentGate`)ので、通常この例外は表に出ない。
 */
export const AI_CONSENT_REQUIRED_MESSAGE =
  "AIへの送信に同意していません。設定画面の「AIに送る内容」から確認してください";

export async function assertAiConsent(): Promise<void> {
  if (!(await hasAiConsent())) throw new Error(AI_CONSENT_REQUIRED_MESSAGE);
}
