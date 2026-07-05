import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { accent, fontRounded, tokens } from "@/theme";

interface GoalBarProps {
  startWeightKg: number;
  currentWeightKg: number;
  goalWeightKg: number;
  goalDate: string; // YYYY-MM-DD
}

function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86_400_000));
}

export default function GoalBar({ startWeightKg, currentWeightKg, goalWeightKg, goalDate }: GoalBarProps) {
  const total = startWeightKg - goalWeightKg;
  const progressed = startWeightKg - currentWeightKg;
  const ratio = total > 0 ? Math.min(1, Math.max(0, progressed / total)) : 0;
  // 達成時のみaccent(イエロー)を使う(デザインガイドの「達成の瞬間」演出)
  const achieved = currentWeightKg <= goalWeightKg;
  const remainingDays = daysUntil(goalDate);
  const [month, day] = goalDate.split("-").slice(1);
  const diff = currentWeightKg - startWeightKg;

  return (
    <Card sx={{ p: "18px", bgcolor: achieved ? accent.cardBg : "background.paper" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "14px" }}>
        <Typography sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary" }}>目標体重まで</Typography>
        <Typography
          sx={{
            fontFamily: fontRounded,
            fontWeight: 700,
            fontSize: 11,
            color: achieved ? tokens.warnText : "text.secondary",
            bgcolor: achieved ? tokens.warnBg : tokens.secondarySoft,
            px: "9px",
            py: "4px",
            borderRadius: "20px",
          }}
        >
          {achieved ? "🎉 目標達成!" : `${Number(month)}/${Number(day)}まで あと${remainingDays}日`}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: "6px", mb: "16px" }}>
        <Typography
          sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 38, lineHeight: 1, color: achieved ? accent.ink : "text.primary" }}
        >
          {currentWeightKg.toFixed(1)}
        </Typography>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 14, color: "text.secondary" }}>kg</Typography>
        {!achieved && diff !== 0 && (
          <Typography
            sx={{
              fontFamily: fontRounded,
              fontWeight: 700,
              fontSize: 13,
              ml: "8px",
              color: diff <= 0 ? "secondary.main" : "primary.main",
            }}
          >
            基準比 {diff > 0 ? "+" : ""}
            {diff.toFixed(1)}kg
          </Typography>
        )}
      </Box>
      <Box sx={{ position: "relative", height: 16, bgcolor: tokens.track, borderRadius: "10px", mb: "9px" }}>
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${ratio * 100}%`,
            borderRadius: "10px",
            background: achieved ? `linear-gradient(90deg,${accent.main},${accent.deep})` : undefined,
            bgcolor: achieved ? undefined : "secondary.main",
            transition: "width .5s",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: `${ratio * 100}%`,
            transform: "translate(-50%,-50%)",
            width: 22,
            height: 22,
            borderRadius: "50%",
            bgcolor: "#fff",
            boxShadow: "0 3px 8px rgba(0,0,0,.18)",
            border: `3px solid ${achieved ? accent.deep : "#2EC4B6"}`,
          }}
        />
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 600, fontSize: 11, color: tokens.faint }}>
          基準 {startWeightKg.toFixed(1)}kg
        </Typography>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 600, fontSize: 11, color: tokens.faint }}>
          目標 {goalWeightKg.toFixed(1)}kg
        </Typography>
      </Box>
    </Card>
  );
}
