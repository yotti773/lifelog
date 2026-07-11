import { useState } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { IconChevronRight, IconSearch } from "@/components/icons";
import { fontRounded, tokens } from "@/theme";
import type { FoodMasterItem } from "@/types";

interface FoodMasterPickerProps {
  items: FoodMasterItem[];
  onSelect: (item: FoodMasterItem) => void;
}

const PAGE_SIZE = 6;

export default function FoodMasterPicker({ items, onSelect }: FoodMasterPickerProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  if (items.length === 0) {
    return (
      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
        まだ登録済みの品目がありません。写真判定や手入力で記録するときに「マスタに登録する」を選ぶと、次回からここで選べるようになります。
      </Typography>
    );
  }

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(0);
  };

  const filtered = query.trim() ? items.filter((item) => item.name.includes(query.trim())) : items;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <Box>
      <TextField
        fullWidth
        size="small"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="品目名で検索"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Box sx={{ color: tokens.faint, display: "flex" }}>
                  <IconSearch />
                </Box>
              </InputAdornment>
            ),
            sx: { bgcolor: tokens.beigeSoft, borderRadius: "11px", "& .MuiOutlinedInput-notchedOutline": { border: "none" } },
          },
        }}
        sx={{ mb: "8px" }}
      />
      {pageItems.map((item, index) => (
        <ButtonBase
          key={item.id}
          onClick={() => onSelect(item)}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            width: "100%",
            p: "9px 4px",
            textAlign: "left",
            borderBottom: index < pageItems.length - 1 ? `1px solid ${tokens.divider}` : "none",
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {item.name}
            </Typography>
            <Typography sx={{ fontSize: 11, color: "text.secondary", mt: "2px" }}>
              P{item.proteinG} / F{item.fatG} / C{item.carbsG}g
            </Typography>
          </Box>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            {item.kcal}
            <Box component="span" sx={{ fontSize: 10, color: "text.secondary", fontWeight: 500 }}>
              kcal
            </Box>
          </Typography>
        </ButtonBase>
      ))}
      {filtered.length === 0 && (
        <Typography sx={{ px: "4px", py: "8px", fontSize: 12, color: "text.secondary" }}>該当する品目がありません</Typography>
      )}
      {pageCount > 1 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            mt: "8px",
            pt: "8px",
            borderTop: `1px solid ${tokens.divider}`,
          }}
        >
          <IconButton
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 0}
            aria-label="前のページ"
            size="small"
            sx={{ color: currentPage === 0 ? tokens.faint2 : "primary.main" }}
          >
            <Box sx={{ transform: "rotate(180deg)", display: "flex" }}>
              <IconChevronRight />
            </Box>
          </IconButton>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 600, fontSize: 11, color: "text.secondary" }}>
            {currentPage + 1} / {pageCount} ページ
          </Typography>
          <IconButton
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === pageCount - 1}
            aria-label="次のページ"
            size="small"
            sx={{ color: currentPage === pageCount - 1 ? tokens.faint2 : "primary.main" }}
          >
            <IconChevronRight />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
