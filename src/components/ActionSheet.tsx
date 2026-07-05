import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Drawer from "@mui/material/Drawer";
import Typography from "@mui/material/Typography";
import { fontRounded, tokens } from "../theme";
import { IconChevronRight, IconFork, IconScale } from "./icons";

interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
}

const ACTIONS = [
  {
    to: "/record/weight",
    label: "体重を記録",
    caption: "体重・体脂肪率・メモ",
    Icon: IconScale,
    iconColor: "secondary.main",
    iconBg: tokens.secondarySoft,
  },
  {
    to: "/record/meal",
    label: "食事を記録",
    caption: "写真AI判定・手入力・マスタ",
    Icon: IconFork,
    iconColor: "primary.main",
    iconBg: tokens.primarySoft,
  },
];

export default function ActionSheet({ open, onClose }: ActionSheetProps) {
  const navigate = useNavigate();

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      sx={{ zIndex: 30 }}
      slotProps={{
        paper: {
          sx: {
            bgcolor: "background.default",
            borderRadius: "28px 28px 0 0",
            p: "12px 20px 30px",
            mx: "auto",
            maxWidth: 448,
          },
        },
      }}
    >
      <Box sx={{ width: 40, height: 5, borderRadius: "3px", bgcolor: "#E2D8C9", mx: "auto", mb: "18px" }} />
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16, textAlign: "center", mb: "18px" }}>
        記録する
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {ACTIONS.map(({ to, label, caption, Icon, iconColor, iconBg }) => (
          <ButtonBase
            key={to}
            onClick={() => {
              onClose();
              navigate(to);
            }}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              bgcolor: "background.paper",
              borderRadius: "18px",
              p: "16px 18px",
              boxShadow: tokens.rowCardShadow,
              textAlign: "left",
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "15px",
                bgcolor: iconBg,
                color: iconColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon size={24} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 15 }}>{label}</Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary", mt: "2px" }}>{caption}</Typography>
            </Box>
            <Box sx={{ color: tokens.faint2, display: "flex" }}>
              <IconChevronRight size={18} />
            </Box>
          </ButtonBase>
        ))}
        <ButtonBase
          onClick={onClose}
          sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14, color: "text.secondary", p: "13px", borderRadius: "14px", mt: "2px" }}
        >
          キャンセル
        </ButtonBase>
      </Box>
    </Drawer>
  );
}
