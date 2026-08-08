import { useLiveQuery } from "dexie-react-hooks";
import { requestMonthlyAdvice } from "@/api/monthlyAdvice";
import { getMonthlyAdviceRecord, saveMonthlyAdviceRecord } from "@/db/adviceRecords";
import AdviceCard from "./AdviceCard";
import type { MonthlyDigest } from "@/types";

interface MonthlyAdviceCardProps {
  digest: MonthlyDigest;
}

/**
 * 月次AIコーチのコメントカード(Issue #114)。表示はAdviceCard共通で、月次のデータ取得・生成だけを持つ。
 * 出力契約は週次と共通で、winsを「今月の良かった変化」、actionsを「来月の重点」として表示する。
 */
export default function MonthlyAdviceCard({ digest }: MonthlyAdviceCardProps) {
  const month = digest.month;
  // 生成済みの月はキャッシュを表示する。「未生成」もnullに解決してロード中と区別する
  const cachedAdvice = useLiveQuery(
    () => getMonthlyAdviceRecord(month).then((v) => v ?? null),
    [month],
  );

  const generate = async () => {
    const advice = await requestMonthlyAdvice(digest);
    // 生成時のdigestも一緒に保存する(何を根拠にこのコメントが出たかを後から再現できるように)
    await saveMonthlyAdviceRecord(month, digest, advice);
  };

  return (
    <AdviceCard
      title="AIコーチのコメント(月次)"
      winsLabel="今月の良かった変化"
      actionsLabel="来月の重点"
      emptyDescription="この月の実績サマリーをもとに、今月の変化と来月の重点をAIが提案します"
      cached={cachedAdvice}
      generate={generate}
    />
  );
}
