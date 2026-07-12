import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PaginationControls from "@/components/PaginationControls";
import { IconSearch } from "@/components/icons";
import { usePagedFilter } from "@/hooks/usePagedFilter";
import { fontRounded, tokens } from "@/theme";
import type { FoodMasterItem } from "@/types";

interface FoodMasterPickerProps {
  items: FoodMasterItem[];
  onSelect: (item: FoodMasterItem) => void;
}

const PAGE_SIZE = 6;

export default function FoodMasterPicker({ items, onSelect }: FoodMasterPickerProps) {
  const { query, setQuery, page, setPage, pageCount, filtered, pageItems } = usePagedFilter(
    items,
    (item) => item.name,
    PAGE_SIZE,
  );

  if (items.length === 0) {
    return (
      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
        まだ登録済みの品目がありません。写真判定や手入力で記録するときに「マスタに登録する」を選ぶと、次回からここで選べるようになります。
      </Typography>
    );
  }

  return (
    <Box>
      <TextField
        fullWidth
        size="small"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
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
            {/* 3桁同士のPFCでも折り返さず1行に収める(Issue #93) */}
            <Typography sx={{ fontSize: 11, color: "text.secondary", mt: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
      <PaginationControls
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        size="small"
        sx={{ mt: "8px", pt: "8px", borderTop: `1px solid ${tokens.divider}` }}
      />
    </Box>
  );
}
