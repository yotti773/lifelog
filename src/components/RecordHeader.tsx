import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { fontRounded, tokens } from "@/theme";
import { IconBack } from "./icons";

interface RecordHeaderProps {
  title: string;
  onBack: () => void;
}

/** 記録フロー画面のヘッダー(戻るボタン+中央タイトル)。モックのnav部参照 */
export default function RecordHeader({ title, onBack }: RecordHeaderProps) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "14px" }}>
      <IconButton
        onClick={onBack}
        aria-label="戻る"
        sx={{ width: 38, height: 38, borderRadius: "12px", bgcolor: "background.paper", boxShadow: tokens.fieldShadow, color: "text.primary" }}
      >
        <IconBack />
      </IconButton>
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>{title}</Typography>
      <Box sx={{ width: 38 }} />
    </Box>
  );
}
