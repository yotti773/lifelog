import Typography from "@mui/material/Typography";

interface PfcSummaryProps {
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/**
 * 食事マスタの一覧・選択で共通の「P◯ / F◯ / C◯g」1行サマリ表示。
 * 3桁同士のPFC値でも折り返さず1行に収める(Issue #93)。
 */
export default function PfcSummary({ proteinG, fatG, carbsG }: PfcSummaryProps) {
  return (
    <Typography
      sx={{ fontSize: 11, color: "text.secondary", mt: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
    >
      P{proteinG} / F{fatG} / C{carbsG}g
    </Typography>
  );
}
