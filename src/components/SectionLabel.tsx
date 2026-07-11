import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

/**
 * セクション見出しの小ラベル(設定・水分・日記などで共通。Issue #59)。
 * 余白はデフォルト(mt 4px / mb 8px)を使い、画面固有の調整が必要な場合のみsxで上書きする
 */
export default function SectionLabel({ children, sx }: { children: React.ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Typography
      sx={[
        { fontSize: 12, fontWeight: 700, color: "text.secondary", mt: "4px", mb: "8px" },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Typography>
  );
}
