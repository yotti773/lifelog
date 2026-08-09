import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { tokens } from "@/theme";

/** 記録フォームの項目ラベル。体重・血圧・周囲径の各記録画面で共用する */
export default function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", mb: "6px", mt: "4px" }}>
      {children}
      {optional && (
        <Box component="span" sx={{ color: tokens.faint2, fontWeight: 400 }}>
          (任意)
        </Box>
      )}
    </Typography>
  );
}
