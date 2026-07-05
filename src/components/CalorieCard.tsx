import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { accent, fontRounded, tokens } from "../theme";

interface CalorieCardProps {
  consumedKcal: number;
  targetKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

// PFC系列色(ハンドオフモックの指定)。Fの黄色はグラフ系列色としての使用(theme.tsのaccent注記参照)
const PFC_ROWS = [
  { label: "P", color: "#FF6B4A" },
  { label: "F", color: accent.main },
  { label: "C", color: "#2EC4B6" },
] as const;

export default function CalorieCard({ consumedKcal, targetKcal, proteinG, fatG, carbsG }: CalorieCardProps) {
  const pct = targetKcal > 0 ? Math.min(100, (consumedKcal / targetKcal) * 100) : 0;
  const over = consumedKcal > targetKcal;
  const diff = Math.abs(targetKcal - consumedKcal);

  const grams = [proteinG, fatG, carbsG];
  const maxGrams = Math.max(...grams);

  return (
    <Card sx={{ p: "20px" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "12px" }}>
        <Typography sx={{ fontSize: 13, fontWeight: 500, color: "text.secondary" }}>今日の摂取カロリー</Typography>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 500,
            color: "secondary.main",
            bgcolor: tokens.secondarySoft,
            px: "9px",
            py: "4px",
            borderRadius: "20px",
          }}
        >
          目標 {targetKcal.toLocaleString()} kcal
        </Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: "6px", mb: "14px" }}>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 46, lineHeight: 1, letterSpacing: "-.01em" }}>
          {consumedKcal.toLocaleString()}
        </Typography>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 16, color: "text.secondary" }}>kcal</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 14,
          borderRadius: "10px",
          bgcolor: tokens.track,
          mb: "9px",
          "& .MuiLinearProgress-bar": {
            borderRadius: "10px",
            bgcolor: over ? "primary.main" : "secondary.main",
          },
        }}
      />
      <Typography sx={{ fontSize: 13, fontWeight: 500, color: over ? "primary.main" : "text.secondary", mb: "16px" }}>
        {over ? `${diff.toLocaleString()}kcal オーバーしています` : `あと ${diff.toLocaleString()}kcal 食べられます`}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "10px",
          pt: "14px",
          borderTop: `1px solid ${tokens.divider}`,
        }}
      >
        {PFC_ROWS.map(({ label, color }, i) => (
          <Box key={label}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: "3px", mb: "6px" }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary" }}>{label}</Typography>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 18 }}>{grams[i]}</Typography>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 11, color: "text.secondary" }}>g</Typography>
            </Box>
            {/* バーは3栄養素間のバランスの目安(最大値に対する比)。目標量に対する充足率ではない */}
            <Box sx={{ height: 5, bgcolor: tokens.track, borderRadius: "4px", overflow: "hidden" }}>
              <Box
                sx={{
                  height: "100%",
                  width: `${maxGrams > 0 ? (grams[i] / maxGrams) * 100 : 0}%`,
                  bgcolor: color,
                  borderRadius: "4px",
                }}
              />
            </Box>
          </Box>
        ))}
      </Box>
    </Card>
  );
}
