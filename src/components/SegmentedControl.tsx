import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import { fontRounded, tokens } from "../theme";

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** small: グラフの期間切替のようなコンパクト表示 */
  size?: "medium" | "small";
  /** 選択中セグメントの見た目。white=白ピル(タブ用)、primary=コーラル(選択肢用) */
  activeVariant?: "white" | "primary";
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "medium",
  activeVariant = "white",
}: SegmentedControlProps<T>) {
  const small = size === "small";
  return (
    <Box
      sx={{
        display: "flex",
        gap: small ? "3px" : "5px",
        bgcolor: tokens.segmentBg,
        p: small ? "3px" : "4px",
        borderRadius: small ? "10px" : "13px",
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <ButtonBase
            key={option.value}
            onClick={() => onChange(option.value)}
            sx={{
              flex: small ? undefined : 1,
              px: small ? "10px" : 0,
              py: small ? "4px" : "8px",
              borderRadius: small ? "7px" : "10px",
              fontFamily: fontRounded,
              fontWeight: 700,
              fontSize: small ? 11 : 13,
              color: active ? (activeVariant === "primary" ? "#fff" : "text.primary") : "text.secondary",
              bgcolor: active ? (activeVariant === "primary" ? "primary.main" : "background.paper") : "transparent",
              boxShadow: active
                ? activeVariant === "primary"
                  ? "0 6px 14px -6px rgba(255,90,56,.6)"
                  : tokens.segmentActiveShadow
                : "none",
              transition: "background-color .2s",
            }}
          >
            {option.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
