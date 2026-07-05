import { NavLink, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { fontRounded, tokens } from "../theme";
import { IconHome, IconSettings, IconTrends } from "./icons";

const TABS = [
  { to: "/", label: "ホーム", Icon: IconHome },
  { to: "/trends", label: "推移", Icon: IconTrends },
  { to: "/settings", label: "設定", Icon: IconSettings },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <Box
      component="nav"
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        bgcolor: "rgba(255,248,240,.92)",
        backdropFilter: "blur(12px)",
        borderTop: `1px solid ${tokens.border}`,
      }}
    >
      <Box
        sx={{
          mx: "auto",
          maxWidth: 448,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-around",
          pt: "10px",
          pb: "calc(10px + env(safe-area-inset-bottom))",
          px: 2,
        }}
      >
        {TABS.map(({ to, label, Icon }) => {
          // 食事マスタ画面(/settings/food-master)でも設定タブをアクティブ表示する(モックREADME参照)
          const isActive =
            to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
          return (
            <ButtonBase
              key={to}
              component={NavLink}
              to={to}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "5px",
                px: "18px",
                py: "7px",
                borderRadius: "16px",
                bgcolor: isActive ? tokens.primarySoft : "transparent",
                color: isActive ? "primary.main" : tokens.faint,
              }}
            >
              <Icon size={22} />
              <Typography
                sx={{ fontFamily: fontRounded, fontWeight: isActive ? 700 : 500, fontSize: 10, lineHeight: 1 }}
              >
                {label}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}
