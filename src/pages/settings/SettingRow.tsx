import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { IconChevronRight } from "@/components/icons";
import { fontRounded, tokens } from "@/theme";

interface SettingRowProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value?: string;
  divider?: boolean;
  onClick: () => void;
}

export default function SettingRow({ icon, iconBg, iconColor, label, value, divider, onClick }: SettingRowProps) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "13px",
        width: "100%",
        p: "15px 16px",
        textAlign: "left",
        borderBottom: divider ? `1px solid ${tokens.divider}` : "none",
      }}
    >
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: "11px",
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
      <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{label}</Typography>
      {value && (
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14, color: "text.secondary" }}>{value}</Typography>
      )}
      <Box sx={{ color: "#D0C3AF", display: "flex" }}>
        <IconChevronRight />
      </Box>
    </ButtonBase>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", m: "6px 4px 8px" }}>{children}</Typography>
  );
}
