import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { IconBack, IconCheck, IconEdit, IconPlus, IconTrash } from "@/components/icons";
import {
  addHabitMasterItem,
  deleteHabitMasterItem,
  DuplicateHabitNameError,
  getAllHabitMasterItems,
  updateHabitMasterItem,
} from "@/db/habitMaster";
import { fontRounded, tokens } from "@/theme";
import type { HabitMasterItem } from "@/types";

/** 週あたり目標頻度の選択肢(0=目標なし)。チェックリストの達成率の分母に使う */
const FREQUENCY_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

function FrequencySelector({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary", mb: "6px" }}>
        目標頻度(任意)
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {FREQUENCY_OPTIONS.map((freq) => {
          const selected = (value ?? 0) === freq;
          return (
            <ButtonBase
              key={freq}
              onClick={() => onChange(freq === 0 ? undefined : freq)}
              aria-pressed={selected}
              sx={{
                px: "12px",
                py: "6px",
                borderRadius: "20px",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: fontRounded,
                border: `1.5px solid ${selected ? "transparent" : tokens.border}`,
                bgcolor: selected ? tokens.secondarySoft : "transparent",
                color: selected ? "secondary.main" : "text.secondary",
              }}
            >
              {freq === 0 ? "なし" : `週${freq}`}
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}

/** 習慣マスタ管理画面(Issue #113)。食事マスタ・種目マスタと同じ構成で、習慣名+任意の目標頻度を扱う。 */
export default function HabitMasterPage() {
  const navigate = useNavigate();
  const items = useLiveQuery(() => getAllHabitMasterItems(), []);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editFrequency, setEditFrequency] = useState<number | undefined>(undefined);
  const [editError, setEditError] = useState<string | null>(null);
  const [isAdding, setAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [addFrequency, setAddFrequency] = useState<number | undefined>(undefined);
  const [addError, setAddError] = useState<string | null>(null);

  if (items === undefined) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  const activeItems = items.filter((item) => !item.archived);
  const archivedItems = items.filter((item) => item.archived);

  const startEdit = (item: HabitMasterItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditFrequency(item.targetWeeklyFrequency);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await updateHabitMasterItem(editingId, { name: editName.trim(), targetWeeklyFrequency: editFrequency });
    } catch (e) {
      if (e instanceof DuplicateHabitNameError) {
        setEditError("同じ名前の習慣が既に登録されています");
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
      await addHabitMasterItem({ name, targetWeeklyFrequency: addFrequency });
    } catch (e) {
      if (e instanceof DuplicateHabitNameError) {
        setAddError("同じ名前の習慣が既に登録されています");
        return;
      }
      throw e;
    }
    setAddName("");
    setAddFrequency(undefined);
    setAdding(false);
    setAddError(null);
  };

  const renderRow = (item: HabitMasterItem, index: number, count: number) =>
    editingId === item.id ? (
      <Box key={item.id} sx={{ p: "12px 14px", borderBottom: index < count - 1 ? `1px solid ${tokens.divider}` : "none" }}>
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
          <FrequencySelector value={editFrequency} onChange={setEditFrequency} />
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
          borderBottom: index < count - 1 ? `1px solid ${tokens.divider}` : "none",
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "10px",
            bgcolor: tokens.secondarySoft,
            color: "secondary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <IconCheck size={16} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.name}
          </Typography>
          {item.targetWeeklyFrequency !== undefined && (
            <Typography sx={{ fontSize: 10, color: "text.secondary" }}>目標 週{item.targetWeeklyFrequency}日</Typography>
          )}
        </Box>
        <Button
          size="small"
          variant="text"
          onClick={() => updateHabitMasterItem(item.id, { archived: !item.archived })}
          sx={{ flexShrink: 0, fontSize: 11, color: "text.secondary", minWidth: 0, px: "6px" }}
        >
          {item.archived ? "戻す" : "休止"}
        </Button>
        <IconButton
          onClick={() => startEdit(item)}
          aria-label={`${item.name}を編集`}
          sx={{ width: 30, height: 30, borderRadius: "9px", border: `1px solid ${tokens.border}`, color: "text.secondary" }}
        >
          <IconEdit size={14} />
        </IconButton>
        <IconButton
          onClick={() => deleteHabitMasterItem(item.id)}
          aria-label={`${item.name}を削除`}
          sx={{ width: 30, height: 30, borderRadius: "9px", border: `1px solid ${tokens.border}`, color: "primary.main" }}
        >
          <IconTrash size={14} />
        </IconButton>
      </Box>
    );

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "16px", pb: "130px" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "14px" }}>
        <IconButton
          onClick={() => navigate("/settings")}
          aria-label="設定に戻る"
          sx={{ width: 38, height: 38, borderRadius: "12px", bgcolor: "background.paper", boxShadow: tokens.fieldShadow, color: "text.primary" }}
        >
          <IconBack />
        </IconButton>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>習慣マスタ</Typography>
        <Box sx={{ width: 38 }} />
      </Box>

      <Typography sx={{ fontSize: 11, color: "text.secondary", mb: "12px", px: "4px", lineHeight: 1.6 }}>
        「ストレッチ」「読書」「血圧の薬」など、やった/やらないだけを記録する習慣を登録します。ホームのチェックリストに表示されます。
      </Typography>

      {activeItems.length === 0 && archivedItems.length === 0 ? (
        <Card sx={{ p: "20px" }}>
          <Typography sx={{ fontSize: 13, color: "text.secondary", textAlign: "center" }}>
            まだ登録がありません。「手動で追加」から習慣を登録すると、ホームのチェックリストに表示されます。
          </Typography>
        </Card>
      ) : (
        <>
          {activeItems.length > 0 && (
            <Card sx={{ overflow: "hidden", mb: "14px" }}>
              {activeItems.map((item, index) => renderRow(item, index, activeItems.length))}
            </Card>
          )}
          {archivedItems.length > 0 && (
            <>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", m: "10px 4px 8px" }}>
                休止中(チェックリストに出しません)
              </Typography>
              <Card sx={{ overflow: "hidden", mb: "14px", opacity: 0.7 }}>
                {archivedItems.map((item, index) => renderRow(item, index, archivedItems.length))}
              </Card>
            </>
          )}
        </>
      )}

      {isAdding ? (
        <Card sx={{ p: "14px", mt: "4px" }}>
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
            placeholder="習慣名(例: ストレッチ)"
            autoFocus
            sx={{ mb: "10px" }}
          />
          <Box sx={{ mb: "12px" }}>
            <FrequencySelector value={addFrequency} onChange={setAddFrequency} />
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
                setAddFrequency(undefined);
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
