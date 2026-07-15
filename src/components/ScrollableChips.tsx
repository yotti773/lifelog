import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import { fontRounded, tokens } from "@/theme";

interface ScrollableChipsProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** スクリーンリーダー用のグループ名(例: 履歴の種別) */
  ariaLabel?: string;
}

/**
 * 横スクロールのチップ列。項目数が多くて等幅の`SegmentedControl`では潰れてしまう選択肢に使う
 * (履歴の種別サブタブなど。項目が増えても各チップはラベル幅のまま破綻しない)。
 * 選択中のチップは切り替えのたびに自動で中央付近へスクロールして見える位置に保つ。
 */
export default function ScrollableChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: ScrollableChipsProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef(new Map<T, HTMLButtonElement>());

  // 選択が変わるたびに、その項目が画面内に収まるよう横スクロール位置を合わせる。
  // scrollIntoViewはブラウザによっては縦方向のページスクロールも起こすため、
  // コンテナのscrollLeftを直接計算して横方向だけ動かす(縦はいじらない)。
  useEffect(() => {
    const container = containerRef.current;
    const chip = chipRefs.current.get(value);
    if (!container || !chip) return;
    const target = chip.offsetLeft - container.clientWidth / 2 + chip.clientWidth / 2;
    const max = container.scrollWidth - container.clientWidth;
    container.scrollTo({ left: Math.max(0, Math.min(target, max)), behavior: "smooth" });
  }, [value]);

  return (
    <Box
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      sx={{
        position: "relative",
        display: "flex",
        gap: "8px",
        overflowX: "auto",
        // スクロールバーは出さない(モバイル前提。はみ出したチップの見切れがスクロール可能の合図になる)
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        "&::-webkit-scrollbar": { display: "none" },
        // タッチのスワイプ後に各チップへ吸着させ、中途半端な位置で止まりにくくする
        scrollSnapType: "x proximity",
        py: "2px",
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <ButtonBase
            key={option.value}
            ref={(el) => {
              if (el) chipRefs.current.set(option.value, el);
              else chipRefs.current.delete(option.value);
            }}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            sx={{
              flexShrink: 0,
              scrollSnapAlign: "center",
              px: "16px",
              py: "8px",
              borderRadius: "20px",
              fontFamily: fontRounded,
              fontWeight: 700,
              fontSize: 13,
              whiteSpace: "nowrap",
              color: active ? "#fff" : "text.secondary",
              bgcolor: active ? "primary.main" : "background.paper",
              border: active ? "1.5px solid transparent" : `1.5px solid ${tokens.border}`,
              boxShadow: active ? "0 6px 14px -6px rgba(255,90,56,.6)" : "none",
              transition: "background-color .2s, color .2s",
            }}
          >
            {option.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
