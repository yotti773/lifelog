import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";

/** kcal・PFCの数値入力欄(文字列のまま保持する下書きの一部) */
export interface NutrientFields {
  kcal: string;
  proteinG: string;
  fatG: string;
  carbsG: string;
}

interface NutrientFieldsGridProps {
  values: NutrientFields;
  /** 変更のあった項目だけを差分(patch)で通知する。呼び出し側で下書き全体へマージする */
  onChange: (patch: Partial<NutrientFields>) => void;
}

/**
 * kcal・P・F・Cの4項目入力グリッド。食事マスタの追加・編集(FoodMasterPage)で使う共通の見た目・挙動(Issue #93)。
 */
export default function NutrientFieldsGrid({ values, onChange }: NutrientFieldsGridProps) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", mb: "8px" }}>
      <TextField size="small" type="number" value={values.kcal} onChange={(e) => onChange({ kcal: e.target.value })} placeholder="kcal" />
      <TextField size="small" type="number" value={values.proteinG} onChange={(e) => onChange({ proteinG: e.target.value })} placeholder="P" />
      <TextField size="small" type="number" value={values.fatG} onChange={(e) => onChange({ fatG: e.target.value })} placeholder="F" />
      <TextField size="small" type="number" value={values.carbsG} onChange={(e) => onChange({ carbsG: e.target.value })} placeholder="C" />
    </Box>
  );
}
