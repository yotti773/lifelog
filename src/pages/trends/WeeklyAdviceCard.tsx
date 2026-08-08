import { useLiveQuery } from "dexie-react-hooks";
import { requestWeeklyAdvice } from "@/api/weeklyAdvice";
import { getAdviceRecord, saveAdviceRecord } from "@/db/adviceRecords";
import AdviceCard from "./AdviceCard";
import type { WeeklyDigest } from "@/types";

interface WeeklyAdviceCardProps {
  digest: WeeklyDigest;
}

/** AIコーチのコメントカード(Issue #12)。表示はAdviceCard共通で、週次のデータ取得・生成だけを持つ */
export default function WeeklyAdviceCard({ digest }: WeeklyAdviceCardProps) {
  const weekStart = digest.period.start;
  // 生成済みの週はキャッシュを表示する(Issue #12)。「未生成」もnullに解決してロード中と区別する
  const cachedAdvice = useLiveQuery(
    () => getAdviceRecord(weekStart).then((v) => v ?? null),
    [weekStart],
  );

  const generate = async () => {
    const advice = await requestWeeklyAdvice(digest);
    // 生成時のdigestも一緒に保存する(何を根拠にこのコメントが出たかを後から再現できるように)
    await saveAdviceRecord(weekStart, digest, advice);
  };

  return (
    <AdviceCard
      title="AIコーチのコメント"
      winsLabel="続けたいこと"
      actionsLabel="来週やってみること"
      emptyDescription="この週の実績サマリーをもとに、総評・良かった点・来週のアクションをAIが提案します"
      cached={cachedAdvice}
      generate={generate}
    />
  );
}
