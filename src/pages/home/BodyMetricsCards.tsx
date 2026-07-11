import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { IconArrow } from "@/components/icons";
import { formatTime } from "@/lib/date";
import { fontRounded, tokens } from "@/theme";
import type { WeightRecord } from "@/types";

/** 前回比チップ(体重/体脂肪率カードで共通の見た目)。diffが正=増加、負以下=減少として色分けする */
function DiffChip({ diff, unit }: { diff: number; unit: string }) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        bgcolor: diff <= 0 ? tokens.secondarySoft : tokens.primarySoft,
        color: diff <= 0 ? "secondary.main" : "primary.main",
        px: "8px",
        py: "4px",
        borderRadius: "20px",
      }}
    >
      <IconArrow up={diff > 0} />
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 12 }}>
        前回比 {Math.abs(diff).toFixed(1)}
        {unit}
      </Typography>
    </Box>
  );
}

interface BodyMetricsCardsProps {
  /** 今日の体重記録。未記録(またはロード中)ならundefined */
  weight: WeightRecord | undefined;
  /** 前回比の基準になる、今日より前の直近の記録。null=記録なし、undefined=ロード中 */
  previousWeight: WeightRecord | null | undefined;
  /** カードタップで体重記録画面へ(当日分の記録があれば編集、なければ新規入力) */
  onOpen: () => void;
}

/** ホーム画面の体重・体脂肪率カード */
export default function BodyMetricsCards({ weight, previousWeight, onOpen }: BodyMetricsCardsProps) {
  const weightDiff = weight && previousWeight ? weight.weightKg - previousWeight.weightKg : null;
  const bodyFatDiff =
    weight?.bodyFatPercent !== undefined && previousWeight?.bodyFatPercent !== undefined
      ? weight.bodyFatPercent - previousWeight.bodyFatPercent
      : null;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: "14px", mb: "22px" }}>
      <ButtonBase onClick={onOpen} sx={{ display: "block", textAlign: "left", borderRadius: "22px" }}>
        <Card sx={{ p: "18px", width: "100%" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "10px" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 500, color: "text.secondary" }}>体重</Typography>
            {weight && <Typography sx={{ fontSize: 11, color: tokens.faint }}>{formatTime(weight.timestamp)}</Typography>}
          </Box>
          {weight ? (
            <>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: "4px", mb: "8px" }}>
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 34, lineHeight: 1 }}>
                  {weight.weightKg}
                </Typography>
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 14, color: "text.secondary" }}>kg</Typography>
              </Box>
              {weightDiff !== null && <DiffChip diff={weightDiff} unit="kg" />}
            </>
          ) : (
            <Typography sx={{ fontSize: 13, color: tokens.faint }}>未記録</Typography>
          )}
        </Card>
      </ButtonBase>
      <ButtonBase onClick={onOpen} sx={{ display: "block", textAlign: "left", borderRadius: "22px" }}>
        <Card sx={{ p: "18px", width: "100%" }}>
          <Typography sx={{ fontSize: 13, fontWeight: 500, color: "text.secondary", mb: "10px" }}>体脂肪率</Typography>
          {weight?.bodyFatPercent !== undefined ? (
            <>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: "4px", mb: "8px" }}>
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 34, lineHeight: 1 }}>
                  {weight.bodyFatPercent}
                </Typography>
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 14, color: "text.secondary" }}>%</Typography>
              </Box>
              {bodyFatDiff !== null ? (
                <DiffChip diff={bodyFatDiff} unit="%" />
              ) : (
                <Typography sx={{ fontSize: 11, color: tokens.faint }}>体組成計より</Typography>
              )}
            </>
          ) : (
            <Typography sx={{ fontSize: 13, color: tokens.faint }}>未計測</Typography>
          )}
        </Card>
      </ButtonBase>
    </Box>
  );
}
