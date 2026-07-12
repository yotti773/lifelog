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
  IconBarbell,
  IconEdit,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@/components/icons";
import {
  addExerciseMasterItem,
  deleteExerciseMasterItem,
  DuplicateExerciseNameError,
  getAllExerciseMasterItems,
  updateExerciseMasterItem,
} from "@/db/exerciseMaster";
import { usePagedFilter } from "@/hooks/usePagedFilter";
import { EXERCISE_BODY_PART_LABELS, EXERCISE_BODY_PART_ORDER } from "@/lib/exerciseBodyParts";
import { fontRounded, tokens } from "@/theme";
import type { ExerciseBodyPart, ExerciseMasterItem } from "@/types";

const PAGE_SIZE = 8;

/** 部位分類の選択チップ(任意項目。選択中をもう一度タップすると解除=分類なし。Issue #104) */
function BodyPartSelector({
  value,
  onChange,
}: {
  value: ExerciseBodyPart | undefined;
  onChange: (bodyPart: ExerciseBodyPart | undefined) => void;
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary", mb: "6px" }}>部位(任意)</Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {EXERCISE_BODY_PART_ORDER.map((bodyPart) => {
          const selected = value === bodyPart;
          return (
            <ButtonBase
              key={bodyPart}
              onClick={() => onChange(selected ? undefined : bodyPart)}
              aria-pressed={selected}
              sx={{
                px: "12px",
                py: "6px",
                borderRadius: "20px",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: fontRounded,
                border: `1.5px solid ${selected ? "transparent" : tokens.border}`,
                bgcolor: selected ? tokens.strengthBg : "transparent",
                color: selected ? "primary.main" : "text.secondary",
              }}
            >
              {EXERCISE_BODY_PART_LABELS[bodyPart]}
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}

/** 種目マスタ管理画面。食事マスタ(FoodMasterPage)と同じ構成だが、数値項目を持たず種目名のみを扱う(画面設計書7.1章) */
export default function ExerciseMasterPage() {
  const navigate = useNavigate();
  const items = useLiveQuery(() => getAllExerciseMasterItems(), []);
  const { query, setQuery, page, setPage, pageCount, filtered, pageItems, reset } = usePagedFilter(
    items ?? [],
    (item) => item.name,
    PAGE_SIZE,
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBodyPart, setEditBodyPart] = useState<ExerciseBodyPart | undefined>(undefined);
  const [isAdding, setAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [addBodyPart, setAddBodyPart] = useState<ExerciseBodyPart | undefined>(undefined);
  const [editError, setEditError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  if (items === undefined) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  const startEdit = (item: ExerciseMasterItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditBodyPart(item.bodyPart);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await updateExerciseMasterItem(editingId, editName.trim(), editBodyPart);
    } catch (e) {
      if (e instanceof DuplicateExerciseNameError) {
        setEditError("同じ名前の種目が既に登録されています");
        return;
      }
      throw e;
    }
    setEditingId(null);
  };

  const saveAdd = async () => {
    const name = addName.trim();
    if (!name) return;
    try {
      await addExerciseMasterItem(name, addBodyPart);
    } catch (e) {
      if (e instanceof DuplicateExerciseNameError) {
        setAddError("同じ名前の種目が既に登録されています");
        return;
      }
      throw e;
    }
    setAddName("");
    setAddBodyPart(undefined);
    setAdding(false);
    setAddError(null);
    // 追加直後の種目を一覧で見つけやすいよう、絞り込みを解除して先頭ページへ戻す
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
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>種目マスタ</Typography>
        <Box sx={{ width: 38 }} />
      </Box>

      {/* 検索 */}
      <TextField
        fullWidth
        size="small"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="種目名で検索"
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
            まだ登録がありません。「手動で追加」から種目名を登録すると、筋トレ記録の入力候補に表示されます。
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
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setEditError(null);
                  }}
                  error={editError !== null}
                  helperText={editError ?? undefined}
                  sx={{ mb: "8px" }}
                />
                <Box sx={{ mb: "10px" }}>
                  <BodyPartSelector value={editBodyPart} onChange={setEditBodyPart} />
                </Box>
                <Box sx={{ display: "flex", gap: "8px" }}>
                  <Button fullWidth variant="contained" size="small" onClick={saveEdit} disabled={!editName.trim()}>
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
                  gap: "12px",
                  p: "14px 15px",
                  borderBottom: index < pageItems.length - 1 ? `1px solid ${tokens.divider}` : "none",
                }}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "10px",
                    bgcolor: tokens.strengthBg,
                    color: "primary.main",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IconBarbell size={15} />
                </Box>
                <Typography sx={{ flex: 1, minWidth: 0, fontFamily: fontRounded, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.name}
                </Typography>
                {item.bodyPart && (
                  <Typography
                    sx={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "primary.main",
                      bgcolor: tokens.strengthBg,
                      px: "8px",
                      py: "3px",
                      borderRadius: "20px",
                      flexShrink: 0,
                    }}
                  >
                    {EXERCISE_BODY_PART_LABELS[item.bodyPart]}
                  </Typography>
                )}
                <IconButton
                  onClick={() => startEdit(item)}
                  aria-label={`${item.name}を編集`}
                  sx={{ width: 30, height: 30, borderRadius: "9px", border: `1px solid ${tokens.border}`, color: "text.secondary" }}
                >
                  <IconEdit size={14} />
                </IconButton>
                <IconButton
                  onClick={() => deleteExerciseMasterItem(item.id)}
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
              該当する種目がありません
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
            value={addName}
            onChange={(e) => {
              setAddName(e.target.value);
              setAddError(null);
            }}
            error={addError !== null}
            helperText={addError ?? undefined}
            placeholder="種目名(例: ベンチプレス)"
            autoFocus
            sx={{ mb: "8px" }}
          />
          <Box sx={{ mb: "10px" }}>
            <BodyPartSelector value={addBodyPart} onChange={setAddBodyPart} />
          </Box>
          <Box sx={{ display: "flex", gap: "8px" }}>
            <Button fullWidth variant="contained" size="small" onClick={saveAdd} disabled={!addName.trim()}>
              追加
            </Button>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={() => {
                setAddName("");
                setAddBodyPart(undefined);
                setAdding(false);
                setAddError(null);
              }}
              sx={{ color: "text.secondary", borderColor: tokens.border }}
            >
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
