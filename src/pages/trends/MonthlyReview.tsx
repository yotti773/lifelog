import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import CrossAnalysisCard from "./CrossAnalysisCard";
import MonthlyAdviceCard from "./MonthlyAdviceCard";
import { IconActivity, IconArrow, IconBack, IconChevronRight, IconFlame, IconWarning } from "@/components/icons";
import { formatMonthDay, formatMonthKey } from "@/lib/date";
import { fontRounded, tokens } from "@/theme";
import type { DigestFlag, MonthlyDigest } from "@/types";

/**
 * 月次レビュー画面(Issue #114。画面設計書8.3章)。
 * 週次レビューの全セクションは持ち込まず、月次ならではの俯瞰に絞る:
 * 週平均体重の推移(折れ線)・目標へのマイルストーン・月間実測TDEE・カロリー/記録率・
 * 月窓クロス分析・月次AIコメント。表示はMonthlyDigest(コード側で計算済み)の値をそのまま出す。
 * 判定の配色は週次と同じ3色(teal=順調 / amber=注意 / coral=要注意)。
 */

interface MonthlyReviewProps {
  digest: MonthlyDigest;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** 今月を表示中は翌月へ進めない */
  canGoNext: boolean;
}

/** フラグの文言は週次(WeeklyReview.tsx)と同じ語彙だが、日数の閾値が月窓のため独自に持つ */
const FLAG_LABELS: Record<DigestFlag, { label: string; severity: "coral" | "amber" }> = {
  PACE_TOO_AGGRESSIVE: { label: "減量ペースが速すぎます(週あたり体重の1%超)。摂取カロリーの見直しを", severity: "coral" },
  INTAKE_BELOW_BMR: { label: "平均摂取カロリーが基礎代謝を下回っています", severity: "coral" },
  BEHIND_PACE: { label: "今月のペースでは目標日に目標体重へ届かない見込みです", severity: "amber" },
  LOW_RECORDING_RATE: { label: "記録した日が月の7割未満です。まずは記録の再開から", severity: "amber" },
  NO_WEIGHT_DATA: { label: "この月の体重記録がありません", severity: "amber" },
  INSUFFICIENT_DATA: { label: "データが少なく、まだ月の評価には向きません", severity: "amber" },
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", mb: "10px" }}>{children}</Typography>
  );
}

function StatRow({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", py: "5px" }}>
      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{label}</Typography>
      <Box sx={{ textAlign: "right" }}>
        <Typography component="span" sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14 }}>
          {value}
        </Typography>
        {sub && (
          <Typography component="span" sx={{ fontFamily: fontRounded, fontSize: 11, color: "text.secondary", ml: "3px" }}>
            {sub}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/**
 * 週平均体重の折れ線(4〜5点)。手書きSVG(チャートライブラリを使わないのは他のグラフと同じ方針)。
 * 記録が無い週は点を打たず隙間として見せる(欠測を線で誤魔化さない。getDailyCalorieTotalsと同じ考え方)
 */
function WeeklyAvgWeightChart({ weeks }: { weeks: MonthlyDigest["weeks"] }) {
  const W = 320;
  const H = 112;
  const PAD_X = 26;
  const TOP = 20;
  const BOTTOM = 26;

  const points = weeks
    .map((week, i) => ({ i, weekStart: week.weekStart, kg: week.weekAvgKg }))
    .filter((p): p is { i: number; weekStart: string; kg: number } => p.kg !== null);

  const xOf = (i: number) =>
    weeks.length === 1 ? W / 2 : PAD_X + (i * (W - PAD_X * 2)) / (weeks.length - 1);

  const kgs = points.map((p) => p.kg);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  // 変化が小さい月でも線が潰れないよう、レンジの下限を0.6kgに広げる
  const span = Math.max(max - min, 0.6);
  const mid = (max + min) / 2;
  const yOf = (kg: number) => TOP + ((mid + span / 2 - kg) / span) * (H - TOP - BOTTOM);

  return (
    <Box component="svg" viewBox={`0 0 ${W} ${H}`} sx={{ width: "100%", height: "auto", display: "block" }}>
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={PAD_X - 10}
          x2={W - PAD_X + 10}
          y1={TOP + t * (H - TOP - BOTTOM)}
          y2={TOP + t * (H - TOP - BOTTOM)}
          stroke={tokens.track}
          strokeWidth={1}
        />
      ))}
      {points.length > 1 && (
        <polyline
          points={points.map((p) => `${xOf(p.i)},${yOf(p.kg)}`).join(" ")}
          fill="none"
          stroke="#FF6B4A"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {points.map((p, idx) => {
        const last = idx === points.length - 1;
        return (
          <g key={p.weekStart}>
            <circle
              cx={xOf(p.i)}
              cy={yOf(p.kg)}
              r={last ? 5 : 4}
              fill={last ? "#FF6B4A" : "#FFFFFF"}
              stroke={last ? "#FFFFFF" : "#FF6B4A"}
              strokeWidth={2}
            />
            {(idx === 0 || last) && (
              <text
                x={xOf(p.i)}
                y={yOf(p.kg) - 9}
                fontSize={9}
                fontWeight={700}
                fill={last ? "#FF6B4A" : "#8C8C8C"}
                textAnchor="middle"
                fontFamily={fontRounded}
              >
                {p.kg.toFixed(1)}
              </text>
            )}
          </g>
        );
      })}
      {weeks.map((week, i) => (
        <text
          key={week.weekStart}
          x={xOf(i)}
          y={H - 8}
          fontSize={9}
          fill={tokens.faint}
          textAnchor="middle"
          fontFamily={fontRounded}
        >
          {formatMonthDay(week.weekStart)}
        </text>
      ))}
    </Box>
  );
}

export default function MonthlyReview({ digest, onPrevMonth, onNextMonth, canGoNext }: MonthlyReviewProps) {
  const { weight, calories, recording, flags, crossAnalysis, bloodPressure } = digest;

  // 必要ペースとの比較(マイルストーンの判定)。減量が必要な月でペースが計算できたときのみ判定する
  const paceStatus =
    weight.avgWeeklyPaceKg !== null && weight.requiredWeeklyPaceKg < 0
      ? weight.avgWeeklyPaceKg <= weight.requiredWeeklyPaceKg
        ? ("on" as const)
        : ("behind" as const)
      : null;

  return (
    <>
      {/* 月ナビゲーション(その月に日曜が含まれる週の集合。デフォルトは今月) */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <ButtonBase
          onClick={onPrevMonth}
          aria-label="前の月"
          sx={{ width: 34, height: 34, borderRadius: "50%", bgcolor: "background.paper", boxShadow: tokens.fieldShadow, color: "text.secondary" }}
        >
          <IconBack size={14} />
        </ButtonBase>
        <Box sx={{ textAlign: "center" }}>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 15 }}>
            {formatMonthKey(digest.month)}
          </Typography>
          <Typography sx={{ fontSize: 10, color: tokens.faint }}>
            {formatMonthDay(digest.period.start)}(月)〜 {formatMonthDay(digest.period.end)}(日)・{digest.weeks.length}週
          </Typography>
        </Box>
        <ButtonBase
          onClick={onNextMonth}
          disabled={!canGoNext}
          aria-label="次の月"
          sx={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            bgcolor: "background.paper",
            boxShadow: tokens.fieldShadow,
            color: "text.secondary",
            opacity: canGoNext ? 1 : 0.35,
          }}
        >
          <IconChevronRight size={14} />
        </ButtonBase>
      </Box>

      {/* 週平均体重の推移(4〜5点の折れ線)。単日ではなく週平均同士を比較する8.2章の設計思想の延長 */}
      <Card sx={{ p: "18px" }}>
        <SectionTitle>体重(週平均の推移)</SectionTitle>
        {weight.endWeekAvgKg !== null ? (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: "6px" }}>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 30, lineHeight: 1 }}>
                  {weight.endWeekAvgKg.toFixed(1)}
                </Typography>
                <Typography sx={{ fontFamily: fontRounded, fontSize: 13, color: "text.secondary" }}>kg</Typography>
                <Typography sx={{ fontSize: 11, color: tokens.faint, ml: "2px" }}>最終週平均</Typography>
              </Box>
              {weight.monthlyChangeKg !== null && (
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    bgcolor: weight.monthlyChangeKg <= 0 ? tokens.secondarySoft : tokens.primarySoft,
                    color: weight.monthlyChangeKg <= 0 ? "secondary.main" : "primary.main",
                    px: "8px",
                    py: "4px",
                    borderRadius: "20px",
                  }}
                >
                  <IconArrow up={weight.monthlyChangeKg > 0} />
                  <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 12 }}>
                    月間 {Math.abs(weight.monthlyChangeKg).toFixed(2)}kg
                  </Typography>
                </Box>
              )}
            </Box>
            <WeeklyAvgWeightChart weeks={digest.weeks} />
            <Box sx={{ borderTop: `1px solid ${tokens.divider}`, mt: "8px", pt: "4px" }}>
              <StatRow
                label="平均ペース(今月)"
                value={weight.avgWeeklyPaceKg !== null ? `${weight.avgWeeklyPaceKg.toFixed(2)}` : "-"}
                sub="kg/週"
              />
              <StatRow label="体重を記録した週" value={`${weight.weeksWithData}`} sub={`/ ${digest.weeks.length}週`} />
            </Box>
          </>
        ) : (
          <Typography sx={{ fontSize: 12, color: tokens.faint }}>この月の体重記録はありません</Typography>
        )}
      </Card>

      {/* 目標へのマイルストーン: 残り期間と、今月のペースを維持した場合の到達見込み */}
      <Card sx={{ p: "18px" }}>
        <SectionTitle>目標へのマイルストーン</SectionTitle>
        <StatRow
          label={`目標(${formatMonthDay(digest.goal.targetDate)})まで`}
          value={`${digest.goal.remainingDays}`}
          sub="日"
        />
        <StatRow
          label="必要ペース"
          value={
            digest.goal.remainingDays > 0 && (weight.endWeekAvgKg !== null || weight.requiredWeeklyPaceKg !== 0)
              ? `${weight.requiredWeeklyPaceKg.toFixed(2)}`
              : "-"
          }
          sub="kg/週"
        />
        {weight.projectedAtGoalDateKg !== null ? (
          <>
            <StatRow
              label="今月のペースを維持した場合の見込み"
              value={`${weight.projectedAtGoalDateKg.toFixed(1)}`}
              sub={`/ 目標 ${digest.goal.targetWeightKg.toFixed(1)} kg`}
            />
            {paceStatus && (
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: paceStatus === "on" ? tokens.secondaryDeep : tokens.warnText,
                  bgcolor: paceStatus === "on" ? tokens.secondarySoft : tokens.warnBg,
                  borderRadius: "10px",
                  p: "7px 10px",
                  mt: "2px",
                }}
              >
                {paceStatus === "on"
                  ? "今月のペースを保てば目標に届く見込みです"
                  : "今月のペースでは目標に届きません。来月の重点を見直しましょう"}
              </Typography>
            )}
          </>
        ) : (
          <Typography sx={{ fontSize: 11, color: tokens.faint, mt: "4px", lineHeight: 1.6 }}>
            体重記録のある週が2週以上あると、今月のペースでの到達見込みが表示されます
          </Typography>
        )}
      </Card>

      {/* 実測消費カロリー(月間推定)。週単位の逆算はブレが大きいため月窓の安定値を出す(Issue #44・#114) */}
      <Card sx={{ p: "18px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "10px" }}>
          <Box sx={{ color: "primary.main", display: "flex" }}>
            <IconFlame size={15} />
          </Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary" }}>実測消費カロリー(月間推定)</Typography>
        </Box>
        {calories.monthlyTdeeKcal !== null ? (
          <>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 26, lineHeight: 1 }}>
                約 {calories.monthlyTdeeKcal.toLocaleString()}
              </Typography>
              <Typography sx={{ fontFamily: fontRounded, fontSize: 12, color: "text.secondary" }}>kcal/日</Typography>
            </Box>
            <Typography sx={{ fontSize: 10, color: tokens.faint, mt: "5px", lineHeight: 1.6 }}>
              摂取カロリーと体重変化からの逆算(月内の有効週 {calories.tdeeValidWeeks}週の平均)。週ごとの値よりブレが少なく、目標カロリー調整の根拠に使えます
            </Typography>
            {calories.tdeeValidWeeks > 1 && calories.tdeeMinKcal !== null && calories.tdeeMaxKcal !== null && (
              <Box sx={{ borderTop: `1px solid ${tokens.divider}`, mt: "10px", pt: "6px" }}>
                <StatRow
                  label="週ごとの逆算値の幅"
                  value={`${calories.tdeeMinKcal.toLocaleString()}〜${calories.tdeeMaxKcal.toLocaleString()}`}
                  sub="kcal"
                />
              </Box>
            )}
          </>
        ) : (
          <Typography sx={{ fontSize: 12, color: tokens.faint, lineHeight: 1.7 }}>
            データ蓄積中です。食事記録が5日以上・体重記録が2件以上ある週が前後で揃うと表示されます
          </Typography>
        )}
      </Card>

      {/* カロリー・記録率 */}
      <Card sx={{ p: "18px" }}>
        <SectionTitle>カロリー・記録</SectionTitle>
        <StatRow
          label="平均摂取カロリー"
          value={calories.avgIntakeKcal !== null ? calories.avgIntakeKcal.toLocaleString() : "-"}
          sub={`/ 目標 ${calories.targetKcal.toLocaleString()} kcal`}
        />
        <StatRow label="目標カロリー以内の日" value={`${calories.daysOnTarget}`} sub={`/ ${recording.totalDays}日`} />
        <StatRow label="食事を記録した日" value={`${calories.recordedDays}`} sub={`/ ${recording.totalDays}日`} />
        <Box sx={{ borderTop: `1px solid ${tokens.divider}`, mt: "4px", pt: "4px" }}>
          <StatRow
            label="記録率(体重または食事)"
            value={`${recording.recordedDays}`}
            sub={`/ ${recording.totalDays}日`}
          />
        </Box>
      </Card>

      {/* 血圧サマリー(Issue #117)。記録が無い月はカードごと出さない。医学的判断はせず事実の提示に留める */}
      {bloodPressure && (
        <Card sx={{ p: "18px" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "4px" }}>
            <Box sx={{ color: "primary.main", display: "flex" }}>
              <IconActivity size={15} />
            </Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary" }}>血圧(朝の家庭血圧)</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: "4px", mb: "2px" }}>
            <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 28, lineHeight: 1 }}>
              {bloodPressure.avgSystolic}/{bloodPressure.avgDiastolic}
            </Typography>
            <Typography sx={{ fontFamily: fontRounded, fontSize: 12, color: "text.secondary" }}>mmHg</Typography>
            <Typography sx={{ fontSize: 11, color: tokens.faint, ml: "2px" }}>月平均</Typography>
          </Box>
          <Box sx={{ borderTop: `1px solid ${tokens.divider}`, mt: "8px", pt: "4px" }}>
            <StatRow label="記録した日" value={`${bloodPressure.recordedDays}`} sub={`/ ${recording.totalDays}日`} />
            <StatRow label="135/85以上だった日" value={`${bloodPressure.highReadingDays}`} sub="日" />
          </Box>
          <Typography sx={{ fontSize: 10, color: tokens.faint, mt: "8px", lineHeight: 1.6 }}>
            数値は事実の提示です(本アプリは医療機器ではなく、医学的な判断は行いません)
          </Typography>
        </Card>
      )}

      {/* クロス分析(月窓。Issue #112の集計を月幅で再実行)。比較が成立する項目が無い月はカードごと出さない */}
      {crossAnalysis && (
        <CrossAnalysisCard
          crossAnalysis={crossAnalysis}
          title="クロス分析(月間)"
          footnote="1か月分のデータによる事実の提示です。週次より日数が多いぶん傾向の目安になりますが、因果の断定はできません"
        />
      )}

      {/* 警告フラグ(コード側で判定。AIの判断に依存しない) */}
      {flags.length > 0 && (
        <Card sx={{ p: "18px" }}>
          <SectionTitle>気をつけたいこと</SectionTitle>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {flags.map((flag) => {
              const { label, severity } = FLAG_LABELS[flag];
              const bg = severity === "coral" ? tokens.errorBg : tokens.warnBg;
              const color = severity === "coral" ? tokens.errorText : tokens.warnText;
              const iconColor = severity === "coral" ? tokens.errorText : tokens.warnIcon;
              return (
                <Box key={flag} sx={{ display: "flex", alignItems: "flex-start", gap: "8px", bgcolor: bg, borderRadius: "12px", p: "10px 12px" }}>
                  <Box sx={{ color: iconColor, display: "flex", mt: "1px", flexShrink: 0 }}>
                    <IconWarning size={14} />
                  </Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 500, color, lineHeight: 1.6 }}>{label}</Typography>
                </Box>
              );
            })}
          </Box>
        </Card>
      )}

      <MonthlyAdviceCard digest={digest} />
    </>
  );
}
