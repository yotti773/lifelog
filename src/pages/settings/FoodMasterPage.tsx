import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PaginationControls from "@/components/PaginationControls";
import {
  IconBack,
  IconEdit,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@/components/icons";
import {
  addFoodMasterItem,
  deleteFoodMasterItem,
  getAllFoodMasterItems,
  updateFoodMasterItem,
} from "@/db/foodMaster";
import { usePagedFilter } from "@/hooks/usePagedFilter";
import { fontRounded, tokens } from "@/theme";
import type { FoodMasterItem } from "@/types";

const PAGE_SIZE = 8;

// 追加・編集で共通の品目下書き(Issue #42)。入力途中の値を文字列のまま保持する
interface ItemDraft {
  name: string;
  kcal: string;
  proteinG: string;
  fatG: string;
  carbsG: string;
}

const EMPTY_DRAFT: ItemDraft = { name: "", kcal: "", proteinG: "", fatG: "", carbsG: "" };

function draftFromItem(item: FoodMasterItem): ItemDraft {
  return {
    name: item.name,
    kcal: String(item.kcal),
    proteinG: String(item.proteinG),
    fatG: String(item.fatG),
    carbsG: String(item.carbsG),
  };
}

/** 下書きを保存用の値に変換する。数値欄は空欄・数値以外を0として扱う(追加・編集で共通) */
function draftToInput(draft: ItemDraft) {
  return {
    name: draft.name.trim(),
    kcal: Number(draft.kcal) || 0,
    proteinG: Number(draft.proteinG) || 0,
    fatG: Number(draft.fatG) || 0,
    carbsG: Number(draft.carbsG) || 0,
  };
}

/** kcal・PFCの4項目入力グリッド(追加・編集で共通の見た目) */
function NutrientFieldsGrid({ draft, onChange }: { draft: ItemDraft; onChange: (draft: ItemDraft) => void }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", mb: "8px" }}>
      <TextField size="small" type="number" value={draft.kcal} onChange={(e) => onChange({ ...draft, kcal: e.target.value })} placeholder="kcal" />
      <TextField size="small" type="number" value={draft.proteinG} onChange={(e) => onChange({ ...draft, proteinG: e.target.value })} placeholder="P" />
      <TextField size="small" type="number" value={draft.fatG} onChange={(e) => onChange({ ...draft, fatG: e.target.value })} placeholder="F" />
      <TextField size="small" type="number" value={draft.carbsG} onChange={(e) => onChange({ ...draft, carbsG: e.target.value })} placeholder="C" />
    </Box>
  );
}

export default function FoodMasterPage() {
  const navigate = useNavigate();
  const items = useLiveQuery(() => getAllFoodMasterItems(), []);
  const { query, setQuery, page, setPage, pageCount, filtered, pageItems, reset } = usePagedFilter(
    items ?? [],
    (item) => item.name,
    PAGE_SIZE,
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ItemDraft>(EMPTY_DRAFT);
  const [isAdding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<ItemDraft>(EMPTY_DRAFT);

  if (items === undefined) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  const startEdit = (item: FoodMasterItem) => {
    setEditingId(item.id);
    setEditDraft(draftFromItem(item));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateFoodMasterItem(editingId, draftToInput(editDraft));
    setEditingId(null);
  };

  const cancelAdd = () => {
    setAddDraft(EMPTY_DRAFT);
    setAdding(false);
  };

  const saveAdd = async () => {
    const input = draftToInput(addDraft);
    if (!input.name) return;
    await addFoodMasterItem(input);
    setAddDraft(EMPTY_DRAFT);
    setAdding(false);
    // 追加直後の品目を一覧で見つけやすいよう、絞り込みを解除して先頭ページへ戻す
    reset();
  };

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "130px" }}>
      {/* ヘッダー */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "14px" }}>
        <IconButton
          onClick={() => navigate("/settings")}
          aria-label="設定に戻る"
          sx={{ width: 38, height: 38, borderRadius: "12px", bgcolor: "background.paper", boxShadow: tokens.fieldShadow, color: "text.primary" }}
        >
          <IconBack />
        </IconButton>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>食事マスタ</Typography>
        <Box sx={{ width: 38 }} />
      </Box>

      {/* 検索 */}
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
          },
        }}
        sx={{ mb: "14px" }}
      />

      {/* 件数 */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", m: "10px 4px 8px" }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary" }}>
          登録済み {filtered.length}件
        </Typography>
        <Typography sx={{ fontSize: 11, color: tokens.faint }}>名前順</Typography>
      </Box>

      {/* リスト */}
      {items.length === 0 ? (
        <Card sx={{ p: "20px" }}>
          <Typography sx={{ fontSize: 13, color: "text.secondary", textAlign: "center" }}>
            まだ登録がありません。食事記録の保存時に「マスタに登録する」を選ぶと追加されます。
          </Typography>
        </Card>
      ) : (
        <Card sx={{ overflow: "hidden" }}>
          {pageItems.map((item, index) =>
            editingId === item.id ? (
              <Box key={item.id} sx={{ p: "12px 14px", borderBottom: index < pageItems.length - 1 ? `1px solid ${tokens.divider}` : "none" }}>
                <TextField
                  fullWidth
                  size="small"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  sx={{ mb: "8px" }}
                />
                <NutrientFieldsGrid draft={editDraft} onChange={setEditDraft} />
                <Box sx={{ display: "flex", gap: "8px" }}>
                  <Button fullWidth variant="contained" size="small" onClick={saveEdit}>
                    保存
                  </Button>
                  <Button fullWidth variant="outlined" size="small" onClick={() => setEditingId(null)} sx={{ color: "text.secondary", borderColor: tokens.border }}>
                    キャンセル
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box
                key={item.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  p: "12px 14px",
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
                <IconButton
                  onClick={() => startEdit(item)}
                  aria-label={`${item.name}を編集`}
                  sx={{ width: 30, height: 30, borderRadius: "9px", border: `1px solid ${tokens.border}`, color: "text.secondary" }}
                >
                  <IconEdit size={14} />
                </IconButton>
                <IconButton
                  onClick={() => deleteFoodMasterItem(item.id)}
                  aria-label={`${item.name}を削除`}
                  sx={{ width: 30, height: 30, borderRadius: "9px", border: `1px solid ${tokens.border}`, color: "primary.main" }}
                >
                  <IconTrash size={14} />
                </IconButton>
              </Box>
            ),
          )}
          {filtered.length === 0 && (
            <Typography sx={{ p: "16px", fontSize: 12, color: "text.secondary", textAlign: "center" }}>
              該当する品目がありません
            </Typography>
          )}
        </Card>
      )}

      <PaginationControls page={page} pageCount={pageCount} onPageChange={setPage} />

      {/* 手動で追加 */}
      {isAdding ? (
        <Card sx={{ p: "14px", mt: "14px" }}>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: "10px" }}>手動で追加</Typography>
          <TextField
            fullWidth
            size="small"
            value={addDraft.name}
            onChange={(e) => setAddDraft({ ...addDraft, name: e.target.value })}
            placeholder="品目名(例: 【モス】モスバーガー)"
            autoFocus
            sx={{ mb: "4px" }}
          />
          <Typography sx={{ fontSize: 11, color: "text.secondary", mb: "8px", px: "2px" }}>
            外食チェーン・コンビニの商品は店名を含めておくと一覧で見分けやすくなります
          </Typography>
          <NutrientFieldsGrid draft={addDraft} onChange={setAddDraft} />
          <Box sx={{ display: "flex", gap: "8px" }}>
            <Button fullWidth variant="contained" size="small" onClick={saveAdd} disabled={!addDraft.name.trim()}>
              追加
            </Button>
            <Button fullWidth variant="outlined" size="small" onClick={cancelAdd} sx={{ color: "text.secondary", borderColor: tokens.border }}>
              キャンセル
            </Button>
          </Box>
        </Card>
      ) : (
        <ButtonBase
          onClick={() => setAdding(true)}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "7px",
            width: "100%",
            height: 48,
            mt: "14px",
            border: "1.5px dashed #E0B7A8",
            borderRadius: "14px",
            color: "primary.main",
          }}
        >
          <IconPlus size={16} />
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, color: "primary.main" }}>
            手動で追加
          </Typography>
        </ButtonBase>
      )}
    </Box>
  );
}
