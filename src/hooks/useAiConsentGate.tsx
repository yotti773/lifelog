import { useCallback, useRef, useState } from "react";
import AiConsentDialog from "@/components/AiConsentDialog";
import { grantAiConsent, hasAiConsent } from "@/db/aiConsent";

/**
 * AI機能を使う直前に同意を取るためのフック(Issue #219)。
 *
 * 使い方:
 * ```tsx
 * const { ensureConsent, consentDialog } = useAiConsentGate();
 * const handleGenerate = async () => {
 *   if (!(await ensureConsent())) return; // 同意しなければ何もしない
 *   await requestWeeklyAdvice(digest);
 * };
 * return <>{consentDialog}...</>;
 * ```
 *
 * **同意済みならダイアログを出さずにtrueを返す。** 毎回確認を挟むと使い勝手が落ちるため、
 * 確認は最初の1回だけ。取り消しは設定画面から行う。
 *
 * なお最終的な歯止めは送信経路側(`assertAiConsent`)にあり、このフックは
 * 「ユーザーに聞く」ための入口。画面を増やしたときにここを通し忘れても、送信自体は起きない。
 */
export function useAiConsentGate() {
  const [open, setOpen] = useState(false);
  // 「同意した/やめた」をawaitしている呼び出し元へ返すための保留中のresolve
  const resolveRef = useRef<((agreed: boolean) => void) | null>(null);
  // 表示中のダイアログに対する保留中のPromise(二重呼び出しで共有する)
  const pendingRef = useRef<Promise<boolean> | null>(null);

  const settle = useCallback((agreed: boolean) => {
    setOpen(false);
    resolveRef.current?.(agreed);
    resolveRef.current = null;
    pendingRef.current = null;
  }, []);

  const ensureConsent = useCallback(async (): Promise<boolean> => {
    if (await hasAiConsent()) return true;
    // **すでに聞いている最中なら、同じ回答を両方の呼び出しへ返す。**
    // resolveを上書きすると、先に待っていた側のPromiseが永久に解決しない
    // (「コメントを生成する」の二度押しで起きる)
    if (pendingRef.current !== null) return pendingRef.current;
    setOpen(true);
    const pending = new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
    pendingRef.current = pending;
    return pending;
  }, []);

  const handleAgree = useCallback(async () => {
    await grantAiConsent();
    settle(true);
  }, [settle]);

  const consentDialog = (
    <AiConsentDialog open={open} onAgree={() => void handleAgree()} onClose={() => settle(false)} />
  );

  return { ensureConsent, consentDialog };
}
