import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import MoodIcon from "@/components/MoodIcon";
import {
  IconActivity,
  IconArrow,
  IconBack,
  IconBarbell,
  IconCheck,
  IconChevronRight,
  IconDiary,
  IconDrop,
  IconFlame,
  IconWarning,
} from "@/components/icons";
import { formatSleepDuration } from "./ActivityHistoryList";
import { getDiaryRecordsByDateRange } from "@/db/diaryRecords";
import { updateSettings } from "@/db/settings";
import { formatMonthDay } from "@/lib/date";
import { suggestCalorieTarget } from "@/lib/nutritionCalc";
import { fontRounded, tokens } from "@/theme";
import type { DigestFlag, WeeklyDigest } from "@/types";
import WeeklyAdviceCard from "./WeeklyAdviceCard";

/**
 * 週次レビュー画面(Issue #45。画面設計書8.2章)。
 * 表示はWeeklyDigest(コード側で計算済み)の値をそのまま出すだけで、この画面では集計しない。
 * 判定の配色はモックアップ準拠の3色: teal=順調 / amber(warn系)=やや遅れ・注意 / coral(error系)=要注意。
 * accent(黄のグラデーション)は達成演出専用のため常時表示のこの画面では使わない(デザインガイド)。
 */

interface WeeklyReviewProps {
  digest: WeeklyDigest;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  /** 今週を表示中は次週へ進めない */
  canGoNext: boolean;
}

const FLAG_LABELS: Record<DigestFlag, { label: string; severity: "coral" | "amber" }> = {
  PACE_TOO_AGGRESSIVE: { label: "減量ペースが速すぎます(週あたり体重の1%超)。摂取カロリーの見直しを", severity: "coral" },
  INTAKE_BELOW_BMR: { label: "平均摂取カロリーが基礎代謝を下回っています", severity: "coral" },
  BEHIND_PACE: { label: "現在のペースでは目標日に目標体重へ届かない見込みです", severity: "amber" },
  LOW_RECORDING_RATE: { label: "記録した日が5日未満です。まずは記録の再開から", severity: "amber" },
  NO_WEIGHT_DATA: { label: "この週の体重記録がありません", severity: "amber" },
  INSUFFICIENT_DATA: { label: "データが少なく、まだ週の評価には向きません", severity: "amber" },
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

// PFC系列色はカロリーカード(CalorieCard.tsx)と同じ。Fの黄はグラフ系列色としての使用(theme.tsのaccent注記参照)
const PFC_COLUMNS = [
  { label: "P", color: "#FF6B4A", avg: (d: WeeklyDigest) => d.pfc.avgProteinG, target: (d: WeeklyDigest) => d.pfc.targetProteinG },
  { label: "F", color: "#FFC145", avg: (d: WeeklyDigest) => d.pfc.avgFatG, target: (d: WeeklyDigest) => d.pfc.targetFatG },
  { label: "C", color: "#2EC4B6", avg: (d: WeeklyDigest) => d.pfc.avgCarbsG, target: (d: WeeklyDigest) => d.pfc.targetCarbsG },
] as const;

/** 逆算TDEEとGarmin計測消費の乖離がこの割合を超えたら「記録漏れの可能性」の注記を出す */
const TDEE_DISCREPANCY_RATIO = 0.15;

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export default function WeeklyReview({ digest, onPrevWeek, onNextWeek, canGoNext }: WeeklyReviewProps) {
  const [adjustApplied, setAdjustApplied] = useState(false);

  const { weight, calories, pfc, recording, flags, activity, workout, water } = digest;

  // 週内の日記(Issue #103)。画面表示はオプトインと無関係にローカルの記録をそのまま出す
  // (AIへ送るかどうか(digest.diaryEntries)とは独立。AIコンサルティング設計書7章)
  const weekDiaries = useLiveQuery(
    () => getDiaryRecordsByDateRange(digest.period.start, digest.period.end),
    [digest.period.start, digest.period.end],
  );

  // 必要ペースとの比較(体重セクションの判定)。減量が必要な週で週平均比較ができるときのみ判定する
  const paceStatus =
    weight.weeklyChangeKg !== null && weight.requiredWeeklyPaceKg < 0
      ? weight.weeklyChangeKg <= weight.requiredWeeklyPaceKg
        ? ("on" as const)
        : ("behind" as const)
      : null;

  // 実測TDEEに基づく目標カロリーの補正提案(Issue #44)。反映はユーザーの明示操作でのみ行う。
  // 計算は設定画面の自動計算パネル(ValueEditorDrawer.tsx)と同じsuggestCalorieTarget()を再利用し、BMR下限クランプと
  // ペース超過警告(要件定義書4.7.1章)の両方のガードレールを常に適用する(画面によって安全性が変わらないように)
  const calorieProposal =
    calories.estimatedTdeeKcal !== null && calories.bmrKcal !== null && weight.paceBaseKg !== null
      ? suggestCalorieTarget({
          bmrKcal: calories.bmrKcal,
          tdeeKcal: calories.estimatedTdeeKcal,
          tdeeSource: "measured",
          currentWeightKg: weight.paceBaseKg,
          goalWeightKg: digest.goal.targetWeightKg,
          remainingDays: digest.goal.remainingDays,
        })
      : null;
  const proposedTargetKcal = calorieProposal?.suggestedKcal ?? null;
  const proposalDiffers = proposedTargetKcal !== null && Math.abs(proposedTargetKcal - calories.targetKcal) >= 10;

  const handleApplyProposal = async () => {
    if (proposedTargetKcal === null) return;
    await updateSettings({ dailyCalorieTarget: proposedTargetKcal });
    setAdjustApplied(true);
  };

  const hasPfcData = pfc.avgProteinG !== null || pfc.targetProteinG !== null;

  return (
    <>
      {/* 週ナビゲーション(月曜〜日曜。デフォルトは今週) */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <ButtonBase
          onClick={onPrevWeek}
          aria-label="前の週"
          sx={{ width: 34, height: 34, borderRadius: "50%", bgcolor: "background.paper", boxShadow: tokens.fieldShadow, color: "text.secondary" }}
        >
          <IconBack size={14} />
        </ButtonBase>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 15 }}>
          {formatMonthDay(digest.period.start)}(月)〜 {formatMonthDay(digest.period.end)}(日)
        </Typography>
        <ButtonBase
          onClick={onNextWeek}
          disabled={!canGoNext}
          aria-label="次の週"
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

      {/* 体重 */}
      <Card sx={{ p: "18px" }}>
        <SectionTitle>体重</SectionTitle>
        {weight.weekAvgKg !== null ? (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: "6px" }}>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 30, lineHeight: 1 }}>
                  {weight.weekAvgKg.toFixed(1)}
                </Typography>
                <Typography sx={{ fontFamily: fontRounded, fontSize: 13, color: "text.secondary" }}>kg</Typography>
                <Typography sx={{ fontSize: 11, color: tokens.faint, ml: "2px" }}>週平均</Typography>
              </Box>
              {weight.weeklyChangeKg !== null && (
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    bgcolor: weight.weeklyChangeKg <= 0 ? tokens.secondarySoft : tokens.primarySoft,
                    color: weight.weeklyChangeKg <= 0 ? "secondary.main" : "primary.main",
                    px: "8px",
                    py: "4px",
                    borderRadius: "20px",
                  }}
                >
                  <IconArrow up={weight.weeklyChangeKg > 0} />
                  <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 12 }}>
                    前週比 {Math.abs(weight.weeklyChangeKg).toFixed(2)}kg
                  </Typography>
                </Box>
              )}
            </Box>
            {weight.weeklyChangeKg === null && (
              <Typography sx={{ fontSize: 11, color: tokens.faint, mb: "4px" }}>
                前週の記録が無いため前週比は表示できません
              </Typography>
            )}
            <Box sx={{ borderTop: `1px solid ${tokens.divider}`, mt: "8px", pt: "4px" }}>
              <StatRow
                label={`必要ペース(残り${digest.goal.remainingDays}日)`}
                value={
                  // paceBaseKg===0の場合とrequiredWeeklyPaceKg===0の場合を区別する:
                  // 基準体重が計算できない(目標日超過・体重記録皆無)ときだけ「-」とし、
                  // 既に目標体重に到達している場合は「0.00 kg/週」を表示する(「データ無し」との混同を避ける)
                  digest.goal.remainingDays > 0 && weight.paceBaseKg !== null
                    ? `${weight.requiredWeeklyPaceKg.toFixed(2)} kg/週`
                    : "-"
                }
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
                  {paceStatus === "on" ? "順調です。このペースを維持しましょう" : "必要ペースに届いていません"}
                </Typography>
              )}
              {weight.projectedKg !== null && (
                <StatRow
                  label="現在ペースでの着地予測"
                  value={`${weight.projectedKg.toFixed(1)} kg`}
                  sub={`/ 目標 ${digest.goal.targetWeightKg.toFixed(1)} kg`}
                />
              )}
            </Box>
          </>
        ) : (
          <Typography sx={{ fontSize: 12, color: tokens.faint }}>この週の体重記録はありません</Typography>
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
        <StatRow label="目標カロリー以内の日" value={`${calories.daysOnTarget}`} sub="/ 7日" />
        <StatRow label="食事を記録した日" value={`${calories.recordedDays}`} sub="/ 7日" />
        <Box sx={{ borderTop: `1px solid ${tokens.divider}`, mt: "4px", pt: "4px" }}>
          <StatRow
            label="記録率(体重または食事)"
            value={`${recording.recordedDays}`}
            sub={`/ 7日${recording.currentStreakDays > 0 ? `・連続${recording.currentStreakDays}日` : ""}`}
          />
        </Box>
      </Card>

      {/* PFC平均(実績または目標のどちらかがあれば表示) */}
      {hasPfcData && (
        <Card sx={{ p: "18px" }}>
          <SectionTitle>PFC平均(1日あたり)</SectionTitle>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            {PFC_COLUMNS.map(({ label, color, avg, target }) => {
              const avgValue = avg(digest);
              const targetValue = target(digest);
              return (
                <Box key={label}>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: "3px", mb: "6px" }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary" }}>{label}</Typography>
                    <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 17 }}>
                      {avgValue !== null ? Math.round(avgValue) : "-"}
                    </Typography>
                    <Typography sx={{ fontFamily: fontRounded, fontSize: 11, color: "text.secondary" }}>
                      {targetValue !== null ? `/ ${targetValue}g` : "g"}
                    </Typography>
                  </Box>
                  <Box sx={{ height: 5, bgcolor: tokens.track, borderRadius: "4px", overflow: "hidden" }}>
                    <Box
                      sx={{
                        height: "100%",
                        width: `${
                          avgValue !== null && targetValue !== null && targetValue > 0
                            ? Math.min(100, (avgValue / targetValue) * 100)
                            : 0
                        }%`,
                        bgcolor: color,
                        borderRadius: "4px",
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Box>
          {pfc.targetProteinG === null && (
            <Typography sx={{ fontSize: 10, color: tokens.faint, mt: "8px" }}>
              設定画面でPFC目標を設定すると目標対比が表示されます
            </Typography>
          )}
        </Card>
      )}

      {/* 活動サマリー(Garmin由来。Issue #82)。活動記録が無い週(未連携ユーザー含む)はカードごと出さない */}
      {activity && (
        <Card sx={{ p: "18px" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "4px" }}>
            <Box sx={{ color: "secondary.main", display: "flex" }}>
              <IconActivity size={15} />
            </Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary" }}>活動(Garmin)</Typography>
          </Box>
          <StatRow
            label="平均歩数"
            value={activity.avgSteps !== null ? activity.avgSteps.toLocaleString() : "-"}
            sub="歩/日"
          />
          <StatRow
            label="平均総消費カロリー"
            value={activity.avgTotalKcal !== null ? activity.avgTotalKcal.toLocaleString() : "-"}
            sub="kcal/日"
          />
          <StatRow
            label="平均睡眠時間"
            value={activity.avgSleepMinutes !== null ? formatSleepDuration(activity.avgSleepMinutes) : "-"}
          />
          <Box sx={{ borderTop: `1px solid ${tokens.divider}`, mt: "4px", pt: "4px" }}>
            <StatRow label="活動データがある日" value={`${activity.recordedDays}`} sub="/ 7日" />
          </Box>
        </Card>
      )}

      {/* 筋トレサマリー(Issue #103)。記録が無い週はカードごと出さない(活動と同じ扱い) */}
      {workout && (
        <Card sx={{ p: "18px" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "4px" }}>
            <Box sx={{ color: "primary.main", display: "flex" }}>
              <IconBarbell size={15} />
            </Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary" }}>筋トレ</Typography>
          </Box>
          <StatRow label="記録した日" value={`${workout.activeDays}`} sub="/ 7日" />
          <StatRow label="種目数" value={`${workout.exerciseCount}`} sub="種目" />
          <StatRow label="総セット数" value={`${workout.totalSets}`} sub="セット" />
        </Card>
      )}

      {/* 水分サマリー(Issue #103)。記録が無い週はカードごと出さない */}
      {water && (
        <Card sx={{ p: "18px" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "4px" }}>
            <Box sx={{ color: tokens.waterMain, display: "flex" }}>
              <IconDrop size={15} />
            </Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary" }}>水分</Typography>
          </Box>
          <StatRow
            label="平均摂取量(記録がある日)"
            value={water.avgIntakeMl.toLocaleString()}
            sub={water.targetMl !== null ? `/ 目標 ${water.targetMl.toLocaleString()} ml` : "ml/日"}
          />
          {water.daysOnTarget !== null && (
            <StatRow label="目標を達成した日" value={`${water.daysOnTarget}`} sub="/ 7日" />
          )}
          <StatRow label="記録した日" value={`${water.recordedDays}`} sub="/ 7日" />
        </Card>
      )}

      {/* 実測消費カロリー(実測TDEE。Issue #44) */}
      <Card sx={{ p: "18px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "10px" }}>
          <Box sx={{ color: "primary.main", display: "flex" }}>
            <IconFlame size={15} />
          </Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary" }}>実測消費カロリー(推定)</Typography>
        </Box>
        {calories.estimatedTdeeKcal !== null ? (
          <>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 26, lineHeight: 1 }}>
                約 {calories.estimatedTdeeKcal.toLocaleString()}
              </Typography>
              <Typography sx={{ fontFamily: fontRounded, fontSize: 12, color: "text.secondary" }}>kcal/日</Typography>
            </Box>
            <Typography sx={{ fontSize: 10, color: tokens.faint, mt: "5px", lineHeight: 1.6 }}>
              摂取カロリーと体重変化からの逆算(直近の有効週 最大3週の平均)
            </Typography>
            {/* Garmin実測との突き合わせ(Issue #82)。独立した2つの推定値の一致度が記録の信頼度の目安になる */}
            {activity?.avgTotalKcal != null && (
              <Box sx={{ borderTop: `1px solid ${tokens.divider}`, mt: "10px", pt: "6px" }}>
                <StatRow
                  label="Garmin計測(週平均)"
                  value={activity.avgTotalKcal.toLocaleString()}
                  sub="kcal/日"
                />
                {Math.abs(calories.estimatedTdeeKcal - activity.avgTotalKcal) >
                  activity.avgTotalKcal * TDEE_DISCREPANCY_RATIO && (
                  <Typography sx={{ fontSize: 11, color: tokens.warnText, bgcolor: tokens.warnBg, borderRadius: "10px", p: "7px 10px", mt: "4px", lineHeight: 1.6 }}>
                    逆算値とGarmin計測の差が大きい週です。食事の記録漏れや体重変動のノイズの可能性があります
                  </Typography>
                )}
              </Box>
            )}
            {calorieProposal && proposedTargetKcal !== null && proposalDiffers && (
              <Box sx={{ bgcolor: tokens.secondarySoft, borderRadius: "14px", p: "12px 14px", mt: "12px" }}>
                <Typography sx={{ fontSize: 12, color: tokens.secondaryDeep, lineHeight: 1.7 }}>
                  目標カロリーを{" "}
                  <Box component="span" sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 15 }}>
                    {proposedTargetKcal.toLocaleString()} kcal
                  </Box>{" "}
                  に調整すると必要ペースを維持できます(現在 {calories.targetKcal.toLocaleString()} kcal)
                  {calorieProposal.clampedToBmr && " ※基礎代謝を下限にしています"}
                </Typography>
                {calorieProposal.paceTooFast && (
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: "6px", mt: "10px", bgcolor: tokens.errorBg, borderRadius: "10px", p: "8px 10px" }}>
                    <Box sx={{ color: tokens.errorText, display: "flex", mt: "1px" }}>
                      <IconWarning size={13} />
                    </Box>
                    <Typography sx={{ fontSize: 11, color: tokens.errorText, lineHeight: 1.5 }}>
                      必要ペースが週あたり体重の1%を超えています。目標日または目標体重の見直しをおすすめします
                    </Typography>
                  </Box>
                )}
                {adjustApplied ? (
                  <Box sx={{ display: "flex", alignItems: "center", gap: "5px", mt: "8px", color: tokens.secondaryDeep }}>
                    <IconCheck size={13} />
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.secondaryDeep }}>
                      設定に反映しました
                    </Typography>
                  </Box>
                ) : (
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleApplyProposal}
                    sx={{ mt: "10px", height: 38, borderRadius: "12px", fontSize: 12, boxShadow: tokens.secondaryButtonShadow }}
                  >
                    設定に反映する
                  </Button>
                )}
              </Box>
            )}
          </>
        ) : (
          <Typography sx={{ fontSize: 12, color: tokens.faint, lineHeight: 1.7 }}>
            データ蓄積中です。食事記録が5日以上・体重記録が2件以上ある週が前後で揃うと表示されます
          </Typography>
        )}
      </Card>

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

      {/* 週の日記(Issue #103)。ロード中(undefined)と0件は非表示 */}
      {weekDiaries && weekDiaries.length > 0 && (
        <Card sx={{ p: "18px" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "10px" }}>
            <Box sx={{ color: tokens.warnIcon, display: "flex" }}>
              <IconDiary size={15} />
            </Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary" }}>この週の日記</Typography>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {weekDiaries.map((diary) => {
              const [, month, dayOfMonth] = diary.date.split("-");
              const weekday = WEEKDAY_LABELS[new Date(`${diary.date}T00:00:00`).getDay()];
              return (
                <Box key={diary.date}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "3px" }}>
                    <Typography sx={{ flex: 1, fontFamily: fontRounded, fontWeight: 700, fontSize: 13 }}>
                      {Number(month)}月{Number(dayOfMonth)}日
                      <Box component="span" sx={{ fontSize: 11, color: "text.secondary", fontWeight: 500, ml: "5px" }}>
                        {weekday}
                      </Box>
                    </Typography>
                    {diary.mood && <MoodIcon mood={diary.mood} size={20} />}
                  </Box>
                  {diary.text !== "" && (
                    <Typography sx={{ fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{diary.text}</Typography>
                  )}
                </Box>
              );
            })}
          </Box>
          {/* AIへ本文が渡るかどうかの現在の状態を明示する(オプトイン。AIコンサルティング設計書7章) */}
          <Typography sx={{ fontSize: 10, color: tokens.faint, mt: "12px", pt: "10px", borderTop: `1px solid ${tokens.divider}`, lineHeight: 1.6 }}>
            {digest.diaryEntries
              ? "設定「日記の本文をAIに送る」がONのため、本文もAIコメント生成に使われます"
              : "本文はAIコメント生成には使われません(気分タグの集計のみ)。設定でONにできます"}
          </Typography>
        </Card>
      )}

      <WeeklyAdviceCard digest={digest} />
    </>
  );
}
