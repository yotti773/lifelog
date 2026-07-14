import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { IconTrends } from "@/components/icons";
import { tokens } from "@/theme";
import type { WeeklyDigest } from "@/types";

/**
 * クロス分析カード(Issue #112)。週次・月次レビュー(Issue #114)で共有する。
 * 集計はdigest側で済んでおり、ここでは事実の提示に徹する
 * (サンプル数が少なく「相関」とは言い切れないため断定しない。解釈はAIコメントに委ねる)。
 */

interface CrossAnalysisCardProps {
  crossAnalysis: NonNullable<WeeklyDigest["crossAnalysis"]>;
  /** カード見出し(週次=「クロス分析」、月次=「クロス分析(月間)」) */
  title: string;
  /** 期間・サンプル数の注意書き(週次と月次で文言が異なる) */
  footnote: string;
}

/** クロス分析の1項目。太字の見出し+事実の提示文(解釈・断定はAIコメントに委ねる) */
function CrossAnalysisRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary", mb: "2px" }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, lineHeight: 1.7 }}>{children}</Typography>
    </Box>
  );
}

const formatKcal = (kcal: number) => `${kcal.toLocaleString()}kcal`;

/**
 * 飲酒×食事の事実文を組み立てる。当日・翌日の平均は食事記録が無いとnullになるため、
 * 出せる要素だけを「。〜でした」の1文にまとめる(nullの要素を飛ばしても文が壊れないように)
 */
function formatAlcoholFact(alcohol: NonNullable<NonNullable<WeeklyDigest["crossAnalysis"]>["alcohol"]>): string {
  const clauses: string[] = [];
  if (alcohol.avgIntakeOnAlcoholDays !== null) {
    clauses.push(
      `その日の平均摂取カロリーは${formatKcal(alcohol.avgIntakeOnAlcoholDays)}${
        alcohol.avgIntakeOnOtherDays !== null ? `(それ以外の日は${formatKcal(alcohol.avgIntakeOnOtherDays)})` : ""
      }`,
    );
  }
  if (alcohol.avgIntakeNextDay !== null) {
    clauses.push(`飲酒した翌日の平均は${formatKcal(alcohol.avgIntakeNextDay)}`);
  }
  return `飲酒タグのある日が${alcohol.alcoholDays}日ありました${
    clauses.length > 0 ? `。${clauses.join("、")}でした` : ""
  }`;
}

export default function CrossAnalysisCard({ crossAnalysis, title, footnote }: CrossAnalysisCardProps) {
  return (
    <Card sx={{ p: "18px" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "10px" }}>
        <Box sx={{ color: "secondary.main", display: "flex" }}>
          <IconTrends size={15} />
        </Box>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary" }}>{title}</Typography>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {crossAnalysis.sleepIntake && (
          <CrossAnalysisRow label="睡眠 × 食事">
            睡眠{Math.round(crossAnalysis.sleepIntake.thresholdMinutes / 60)}時間未満の日が
            {crossAnalysis.sleepIntake.shortSleepDays}日(睡眠データのある{crossAnalysis.sleepIntake.sleepRecordedDays}
            日中)あり、その日の平均摂取カロリーは{formatKcal(crossAnalysis.sleepIntake.avgIntakeOnShortSleepDays)}
            {crossAnalysis.sleepIntake.avgIntakeOnOtherDays !== null &&
              `(それ以外の日は${formatKcal(crossAnalysis.sleepIntake.avgIntakeOnOtherDays)})`}
            でした
          </CrossAnalysisRow>
        )}
        {crossAnalysis.moodIntake && (
          <CrossAnalysisRow label="気分 × 食事">
            気分が良い日({crossAnalysis.moodIntake.goodMoodDays}日)の平均摂取カロリーは
            {formatKcal(crossAnalysis.moodIntake.avgIntakeOnGoodMoodDays)}、眠い・不調の日(
            {crossAnalysis.moodIntake.badMoodDays}日)は
            {formatKcal(crossAnalysis.moodIntake.avgIntakeOnBadMoodDays)}でした
          </CrossAnalysisRow>
        )}
        {crossAnalysis.alcohol && (
          <CrossAnalysisRow label="飲酒 × 食事">{formatAlcoholFact(crossAnalysis.alcohol)}</CrossAnalysisRow>
        )}
      </Box>
      <Typography sx={{ fontSize: 10, color: tokens.faint, mt: "10px", pt: "8px", borderTop: `1px solid ${tokens.divider}`, lineHeight: 1.6 }}>
        {footnote}
      </Typography>
    </Card>
  );
}
