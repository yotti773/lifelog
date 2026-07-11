import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";
import { IconChevronRight } from "@/components/icons";
import { fontRounded, tokens } from "@/theme";

interface PaginationControlsProps {
  /** 現在ページ(0始まり) */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** ピッカー内などコンパクトに出す場合は"small" */
  size?: "small" | "medium";
  /** コンテナ余白の画面固有調整(デフォルトは mt 12px) */
  sx?: SxProps<Theme>;
}

/** ページ送りUI(マスタ一覧・マスタピッカー共通。Issue #59)。2ページ以上あるときだけ表示する */
export default function PaginationControls({ page, pageCount, onPageChange, size = "medium", sx }: PaginationControlsProps) {
  if (pageCount <= 1) return null;
  const iconButtonSize = size === "small" ? { size: "small" as const } : {};
  return (
    <Box
      sx={[
        { display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", mt: "12px" },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <IconButton
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        aria-label="前のページ"
        {...iconButtonSize}
        sx={{ color: page === 0 ? tokens.faint2 : "primary.main" }}
      >
        <Box sx={{ transform: "rotate(180deg)", display: "flex" }}>
          <IconChevronRight />
        </Box>
      </IconButton>
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 600, fontSize: 11, color: "text.secondary" }}>
        {page + 1} / {pageCount} ページ
      </Typography>
      <IconButton
        onClick={() => onPageChange(page + 1)}
        disabled={page === pageCount - 1}
        aria-label="次のページ"
        {...iconButtonSize}
        sx={{ color: page === pageCount - 1 ? tokens.faint2 : "primary.main" }}
      >
        <IconChevronRight />
      </IconButton>
    </Box>
  );
}
