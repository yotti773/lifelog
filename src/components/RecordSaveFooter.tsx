import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { tokens } from "@/theme";

interface RecordSaveFooterProps {
  /** 保存ボタンのラベル。省略時は「保存する」 */
  label?: string;
  /** フォーム内でsubmitさせる場合は"submit"(onClickは不要) */
  type?: "submit" | "button";
  onClick?: () => void;
  /** 保存ボタンの下に置く追加のアクション(食事編集の削除ボタンなど) */
  children?: React.ReactNode;
}

/** 記録フロー画面共通の下部固定保存バー(RecordHeaderと対。Issue #59)。背景のグラデーションで下部の記録を透かす */
export default function RecordSaveFooter({ label = "保存する", type = "button", onClick, children }: RecordSaveFooterProps) {
  return (
    <Box
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        p: "16px 20px 26px",
        background: "linear-gradient(180deg,rgba(255,248,240,0),#FFF8F0 30%)",
        zIndex: 10,
      }}
    >
      <Box sx={{ mx: "auto", maxWidth: 408, display: "flex", flexDirection: "column", gap: "8px" }}>
        <Button
          fullWidth
          type={type}
          variant="contained"
          onClick={onClick}
          sx={{ height: 54, borderRadius: "16px", fontSize: 16, boxShadow: tokens.primaryButtonShadow }}
        >
          {label}
        </Button>
        {children}
      </Box>
    </Box>
  );
}
