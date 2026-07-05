import MuiFab from "@mui/material/Fab";
import { tokens } from "../theme";
import { IconPlus } from "./icons";

interface FabProps {
  onClick: () => void;
}

export default function Fab({ onClick }: FabProps) {
  return (
    <MuiFab
      onClick={onClick}
      aria-label="記録する"
      sx={{
        position: "fixed",
        right: 20,
        bottom: 96,
        zIndex: 20,
        width: 60,
        height: 60,
        color: "#fff",
        background: tokens.fabGradient,
        boxShadow: tokens.fabShadow,
        "&:hover": { background: tokens.fabGradient },
        "&:active": { boxShadow: tokens.fabShadow },
      }}
    >
      <IconPlus />
    </MuiFab>
  );
}
