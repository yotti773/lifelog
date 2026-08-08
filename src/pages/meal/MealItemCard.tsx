import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { IconTrash } from "@/components/icons";
import { accent, fontRounded, tokens } from "@/theme";

/** 品目カード1枚分の下書き。数値は入力途中を保つため文字列で持つ(保存時に数値化) */
export interface MealItemDraft {
  name: string;
  kcal: string;
  proteinG: string;
  fatG: string;
  carbsG: string;
  /** 保存時にこの品目を食事マスタへ登録するか */
  registerToMaster: boolean;
  /** 写真AI判定由来の品目のみ持つ推定値(保存時にaiEstimated*として引き継ぐ) */
  ai?: { name: string; kcal: number; proteinG: number; fatG: number; carbsG: number };
}

export const emptyMealItem = (): MealItemDraft => ({
  name: "",
  kcal: "",
  proteinG: "",
  fatG: "",
  carbsG: "",
  registerToMaster: false,
});

// PFC入力欄のラベル色(ハンドオフモックの系列色。theme.tsのaccent注記参照)
const MACRO_FIELDS = [
  { key: "proteinG", label: "P", color: "#FF6B4A" },
  { key: "fatG", label: "F", color: accent.main },
  { key: "carbsG", label: "C", color: "#2EC4B6" },
] as const;

interface MealItemCardProps {
  index: number;
  item: MealItemDraft;
  onChange: (patch: Partial<MealItemDraft>) => void;
  onRemove: () => void;
}

/**
 * 食事記録画面の品目カード(筋トレのセット/種目カードに相当。Issue #126)。
 * 料理名・カロリー・PFCをインライン編集し、カードごとに削除・マスタ登録できる。
 */
export default function MealItemCard({ index, item, onChange, onRemove }: MealItemCardProps) {
  return (
    <Card sx={{ p: "13px 13px 10px", borderRadius: "16px", boxShadow: tokens.rowCardShadow }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: "9px", mb: "11px" }}>
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: "9px",
            bgcolor: tokens.primarySoft,
            color: "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: fontRounded,
            fontWeight: 700,
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {index + 1}
        </Box>
        <TextField
          fullWidth
          size="small"
          variant="standard"
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="料理名を入力"
          slotProps={{
            htmlInput: { style: { fontFamily: fontRounded, fontWeight: 700, fontSize: 14.5 } },
            input: { disableUnderline: true },
          }}
        />
        <IconButton
          onClick={onRemove}
          aria-label={`品目${index + 1}を削除`}
          sx={{ width: 28, height: 28, borderRadius: "9px", bgcolor: tokens.beigeSoft, color: tokens.faint, flexShrink: 0 }}
        >
          <IconTrash size={13} />
        </IconButton>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "1.35fr 1fr 1fr 1fr", gap: "8px" }}>
        {/* カロリー */}
        <Box
          sx={{
            bgcolor: "background.paper",
            border: `1.5px solid ${tokens.border}`,
            borderRadius: "13px",
            p: "7px 6px 6px",
            textAlign: "center",
          }}
        >
          <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: "text.secondary", mb: "2px" }}>カロリー</Typography>
          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "2px", whiteSpace: "nowrap" }}>
            <InputBase
              type="number"
              value={item.kcal}
              onChange={(e) => onChange({ kcal: e.target.value })}
              placeholder="0"
              inputProps={{
                "aria-label": `品目${index + 1}のカロリー(kcal)`,
                inputMode: "numeric",
                style: { textAlign: "center", fontFamily: fontRounded, fontWeight: 700, fontSize: 18, padding: 0 },
              }}
              sx={{ maxWidth: 64 }}
            />
            <Typography sx={{ fontSize: 10, fontWeight: 500, color: "text.secondary" }}>kcal</Typography>
          </Box>
        </Box>
        {/* PFC */}
        {MACRO_FIELDS.map(({ key, label, color }) => (
          <Box
            key={key}
            sx={{
              bgcolor: "background.paper",
              border: `1.5px solid ${tokens.border}`,
              borderRadius: "13px",
              p: "7px 4px 6px",
              textAlign: "center",
            }}
          >
            <Typography sx={{ fontSize: 9.5, fontWeight: 700, color, mb: "2px" }}>{label}</Typography>
            <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "1px", whiteSpace: "nowrap" }}>
              <InputBase
                type="number"
                value={item[key]}
                onChange={(e) => onChange({ [key]: e.target.value })}
                placeholder="0"
                inputProps={{
                  "aria-label": `品目${index + 1}の${label}(g)`,
                  inputMode: "numeric",
                  style: { textAlign: "center", fontFamily: fontRounded, fontWeight: 700, fontSize: 18, padding: 0 },
                }}
                sx={{ minWidth: 0 }}
              />
              <Typography sx={{ fontSize: 10, fontWeight: 500, color: "text.secondary" }}>g</Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={item.registerToMaster}
            onChange={(e) => onChange({ registerToMaster: e.target.checked })}
            sx={{ py: "4px", "&.Mui-checked": { color: "primary.main" } }}
          />
        }
        label={<Typography sx={{ fontSize: 11.5, fontWeight: 500, color: "text.secondary" }}>この品目をマスタに登録</Typography>}
        sx={{ m: 0, mt: "4px", ml: "-4px" }}
      />
    </Card>
  );
}
