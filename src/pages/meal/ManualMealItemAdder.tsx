import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { IconPlus } from "@/components/icons";
import { fontRounded, tokens } from "@/theme";
import type { PendingMealItem } from "./PendingItemsCard";

interface ItemDraft {
  name: string;
  kcal: string;
  proteinG: string;
  fatG: string;
  carbsG: string;
}

const EMPTY_DRAFT: ItemDraft = { name: "", kcal: "", proteinG: "", fatG: "", carbsG: "" };

interface ManualMealItemAdderProps {
  onAdd: (item: PendingMealItem) => void;
}

/**
 * 食事編集時に、写真判定・マスタ選択に頼らず品目を手入力して「追加で記録する品目」へ加える入力欄(Issue #99)。
 * 編集フォーム本体は編集対象レコードを指すため、追加分はこの独立した下書きから積む。
 * 数値欄は空欄・数値以外を0として扱う(食事マスタの手動追加と同じ寛容さ)。
 */
export default function ManualMealItemAdder({ onAdd }: ManualMealItemAdderProps) {
  const [isAdding, setAdding] = useState(false);
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT);

  const reset = () => {
    setDraft(EMPTY_DRAFT);
    setAdding(false);
  };

  const handleAdd = () => {
    const name = draft.name.trim();
    if (!name) return;
    onAdd({
      name,
      kcal: Number(draft.kcal) || 0,
      proteinG: Number(draft.proteinG) || 0,
      fatG: Number(draft.fatG) || 0,
      carbsG: Number(draft.carbsG) || 0,
      registerToMaster: false,
    });
    reset();
  };

  if (!isAdding) {
    return (
      <ButtonBase
        onClick={() => setAdding(true)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "7px",
          width: "100%",
          height: 48,
          mb: "14px",
          border: "1.5px dashed #E0B7A8",
          borderRadius: "14px",
          color: "primary.main",
        }}
      >
        <IconPlus size={16} />
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, color: "primary.main" }}>
          手動で入力して追加
        </Typography>
      </ButtonBase>
    );
  }

  return (
    <Card sx={{ p: "15px", mb: "14px", borderRadius: "18px", boxShadow: tokens.rowCardShadow }}>
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: "10px" }}>手動で入力して追加</Typography>
      <TextField
        fullWidth
        size="small"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder="料理名(例: 鶏肉と野菜炒め)"
        autoFocus
        sx={{ mb: "8px" }}
      />
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", mb: "10px" }}>
        <TextField size="small" type="number" value={draft.kcal} onChange={(e) => setDraft({ ...draft, kcal: e.target.value })} placeholder="kcal" />
        <TextField size="small" type="number" value={draft.proteinG} onChange={(e) => setDraft({ ...draft, proteinG: e.target.value })} placeholder="P" />
        <TextField size="small" type="number" value={draft.fatG} onChange={(e) => setDraft({ ...draft, fatG: e.target.value })} placeholder="F" />
        <TextField size="small" type="number" value={draft.carbsG} onChange={(e) => setDraft({ ...draft, carbsG: e.target.value })} placeholder="C" />
      </Box>
      <Box sx={{ display: "flex", gap: "8px" }}>
        <Button fullWidth variant="contained" size="small" onClick={handleAdd} disabled={!draft.name.trim()}>
          追加
        </Button>
        <Button fullWidth variant="outlined" size="small" onClick={reset} sx={{ color: "text.secondary", borderColor: tokens.border }}>
          キャンセル
        </Button>
      </Box>
    </Card>
  );
}
