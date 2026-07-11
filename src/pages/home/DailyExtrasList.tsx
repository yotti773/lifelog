import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { moodLabel } from "@/components/MoodIcon";
import { IconBarbell, IconChevronRight, IconDiary, IconDrop } from "@/components/icons";
import { fontRounded, tokens } from "@/theme";
import type { DiaryRecord, WaterRecord, WorkoutRecord } from "@/types";

interface SummaryRowProps {
  /** タップで遷移する記録画面のパス */
  to: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  /** 中央のコンテンツ(タイトル行+サマリー) */
  children: React.ReactNode;
  /** 右端の数値表示(無い行は省略) */
  right?: React.ReactNode;
}

/** 「その他の記録」共通の行カード(アイコン+コンテンツ+シェブロン) */
function SummaryRow({ to, icon, iconBg, iconColor, children, right }: SummaryRowProps) {
  const navigate = useNavigate();
  return (
    <ButtonBase
      onClick={() => navigate(to)}
      sx={{
        bgcolor: "background.paper",
        borderRadius: "18px",
        boxShadow: tokens.rowCardShadow,
        p: "14px 15px",
        display: "flex",
        alignItems: "center",
        gap: "13px",
        textAlign: "left",
      }}
    >
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: "13px",
          bgcolor: iconBg,
          color: iconColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      {right && <Box sx={{ textAlign: "right", flexShrink: 0 }}>{right}</Box>}
      <Box sx={{ color: "text.primary", opacity: 0.35, display: "flex", flexShrink: 0 }}>
        <IconChevronRight size={13} />
      </Box>
    </ButtonBase>
  );
}

interface DailyExtrasListProps {
  waterRecords: WaterRecord[];
  /** 1日の目標水分摂取量(ml)。未設定なら進捗バーを出さず合計mlのみ表示する */
  waterTargetMl: number | undefined;
  /** 今日の日記。null=未記録 */
  diary: DiaryRecord | null;
  workoutRecords: WorkoutRecord[];
}

/** ホーム画面の「その他の記録」セクション(水分・日記・筋トレ。画面設計書2章) */
export default function DailyExtrasList({ waterRecords, waterTargetMl, diary, workoutRecords }: DailyExtrasListProps) {
  const waterTotalMl = waterRecords.reduce((sum, record) => sum + record.amountMl, 0);
  const waterProgress = waterTargetMl ? Math.max(0, Math.min(100, (waterTotalMl / waterTargetMl) * 100)) : 0;
  const workoutExerciseCount = new Set(workoutRecords.map((record) => record.exerciseOrder)).size;

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", m: "24px 0 12px", px: "2px" }}>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>その他の記録</Typography>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* 水分: 合計+進捗バー */}
        <SummaryRow
          to="/record/water"
          icon={<IconDrop size={21} />}
          iconBg={tokens.waterSoft}
          iconColor={tokens.waterMain}
          right={
            <>
              <Typography component="span" sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>
                {waterTotalMl.toLocaleString()}
              </Typography>
              <Typography component="span" sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 10, color: "text.secondary", ml: "2px" }}>
                {waterTargetMl ? `/ ${waterTargetMl.toLocaleString()}ml` : "ml"}
              </Typography>
            </>
          }
        >
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: waterTargetMl ? "5px" : 0 }}>
            水分
          </Typography>
          {waterTargetMl && (
            <Box sx={{ height: 6, bgcolor: tokens.track, borderRadius: "6px", overflow: "hidden" }}>
              <Box
                sx={{
                  height: "100%",
                  width: `${waterProgress}%`,
                  bgcolor: tokens.waterMain,
                  borderRadius: "6px",
                  transition: "width .4s",
                }}
              />
            </Box>
          )}
        </SummaryRow>

        {/* 日記: 気分タグ+本文プレビュー */}
        <SummaryRow to="/record/diary" icon={<IconDiary size={21} />} iconBg={tokens.warnBg} iconColor={tokens.warnIcon}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "7px", mb: "2px" }}>
            <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13 }}>日記</Typography>
            {diary?.mood && (
              <Typography
                sx={{
                  fontSize: 9,
                  fontWeight: 500,
                  color: tokens.warnText,
                  bgcolor: tokens.warnBg,
                  px: "6px",
                  py: "2px",
                  borderRadius: "6px",
                }}
              >
                {moodLabel(diary.mood)}
              </Typography>
            )}
          </Box>
          <Typography
            sx={{
              fontSize: 12,
              color: diary?.text ? "text.secondary" : tokens.faint,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {diary?.text ? diary.text : "未記録"}
          </Typography>
        </SummaryRow>

        {/* 筋トレ: 当日サマリー(◯種目・◯セット) */}
        <SummaryRow to="/record/strength" icon={<IconBarbell size={21} />} iconBg={tokens.strengthBg} iconColor="primary.main">
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: "2px" }}>筋トレ</Typography>
          <Typography
            sx={{
              fontSize: 12,
              color: workoutRecords.length > 0 ? "text.secondary" : tokens.faint,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {workoutRecords.length > 0 ? `${workoutExerciseCount}種目・${workoutRecords.length}セット` : "未記録"}
          </Typography>
        </SummaryRow>
      </Box>
    </>
  );
}
