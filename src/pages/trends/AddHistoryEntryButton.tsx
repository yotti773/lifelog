import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SegmentedControl from "@/components/SegmentedControl";
import { IconPlus } from "@/components/icons";
import { MEAL_TYPE_META, MEAL_TYPE_ORDER } from "@/components/mealTypeMeta";
import { todayDateString } from "@/lib/date";
import { fontRounded, tokens } from "@/theme";
import type { MealType } from "@/types";

const MEAL_TYPE_OPTIONS = MEAL_TYPE_ORDER.map((value) => ({ value, label: MEAL_TYPE_META[value].label }));

interface AddHistoryEntryButtonProps {
  /** 食事のときだけ区分の選択も必要になる */
  requireMealType?: boolean;
  onAdd: (date: string, mealType?: MealType) => void;
}

/**
 * 履歴確認画面から、入れ忘れた過去日の記録を新規に追加するための導線(Issue #141)。
 * 食事マスタ・種目マスタの「手動で追加」ボタン(Issue #35)と同じ、リスト下部の破線ボーダーの
 * トグルボタン+インラインフォームというUIパターンを踏襲する。
 */
export default function AddHistoryEntryButton({ requireMealType, onAdd }: AddHistoryEntryButtonProps) {
  const [isAdding, setAdding] = useState(false);
  const [date, setDate] = useState(() => todayDateString());
  const [mealType, setMealType] = useState<MealType>("breakfast");

  const close = () => {
    setAdding(false);
    setDate(todayDateString());
    setMealType("breakfast");
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
          border: "1.5px dashed #E0B7A8",
          borderRadius: "14px",
          color: "primary.main",
        }}
      >
        <IconPlus size={16} />
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, color: "primary.main" }}>
          記録を追加
        </Typography>
      </ButtonBase>
    );
  }

  return (
    <Card sx={{ p: "14px" }}>
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: "10px" }}>
        日付を選んで記録を追加
      </Typography>
      <TextField
        fullWidth
        type="date"
        size="small"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        slotProps={{ htmlInput: { max: todayDateString() } }}
        sx={{ mb: requireMealType ? "10px" : "14px" }}
      />
      {requireMealType && (
        <Box sx={{ mb: "14px" }}>
          <SegmentedControl options={MEAL_TYPE_OPTIONS} value={mealType} onChange={setMealType} size="small" />
        </Box>
      )}
      <Box sx={{ display: "flex", gap: "8px" }}>
        <Button
          fullWidth
          variant="contained"
          size="small"
          disabled={!date}
          onClick={() => {
            onAdd(date, requireMealType ? mealType : undefined);
            close();
          }}
        >
          追加
        </Button>
        <Button
          fullWidth
          variant="outlined"
          size="small"
          onClick={close}
          sx={{ color: "text.secondary", borderColor: tokens.border }}
        >
          キャンセル
        </Button>
      </Box>
    </Card>
  );
}
