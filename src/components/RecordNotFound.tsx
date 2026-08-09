import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import RecordHeader from "@/components/RecordHeader";
import { tokens } from "@/theme";

interface RecordNotFoundProps {
  /** 「指定された日付の◯◯は見つかりませんでした」の◯◯部分(例: "体重記録") */
  recordLabel: string;
  /** 履歴確認画面で開くタブ(体重は指定なし=既定タブ) */
  historyKind?: string;
}

/**
 * ?date= で開いた日付の記録が見つからないときの案内画面。
 * タップ後に別端末で削除された場合に出る(useDailyRecordEditor参照)。
 */
export default function RecordNotFound({ recordLabel, historyKind }: RecordNotFoundProps) {
  const navigate = useNavigate();
  const goToHistory = () =>
    navigate("/trends", { state: { viewMode: "history", ...(historyKind !== undefined && { historyKind }) } });

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "40px" }}>
      <RecordHeader title="記録が見つかりません" onBack={goToHistory} />
      <Card sx={{ p: "16px", mb: "16px" }}>
        <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
          指定された日付の{recordLabel}は見つかりませんでした。別の端末で削除された可能性があります。
        </Typography>
      </Card>
      <Button
        fullWidth
        variant="contained"
        onClick={goToHistory}
        sx={{ height: 50, borderRadius: "14px", boxShadow: tokens.primaryButtonShadow }}
      >
        履歴に戻る
      </Button>
    </Box>
  );
}
