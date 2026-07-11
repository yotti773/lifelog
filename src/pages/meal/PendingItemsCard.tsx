import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { fontRounded, tokens } from "@/theme";
import ItemRowLabel from "./ItemRowLabel";

export interface PendingMealItem {
  name: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  aiEstimatedName?: string;
  aiEstimatedKcal?: number;
  aiEstimatedProteinG?: number;
  aiEstimatedFatG?: number;
  aiEstimatedCarbsG?: number;
  registerToMaster: boolean;
  // 由来が写真判定の場合、PhotoJudgeState.items内のindex。リストから削除したときに
  // 検出品目の「追加済み」を解除して再選択できるようにするために持つ
  detectedIndex?: number;
}

interface PendingItemsCardProps {
  items: PendingMealItem[];
  onRemove: (index: number) => void;
  /** カードの見出し。省略時は新規記録用の「今回まとめて記録する品目」 */
  title?: string;
  /** リスト下の注記(編集時の「追加分は新規レコードとして保存」の説明など。Issue #71) */
  footnote?: string;
}

/** 「今回まとめて記録する品目」リスト。保存前の複数品目を一覧し、個別に取り消せる */
export default function PendingItemsCard({ items, onRemove, title = "今回まとめて記録する品目", footnote }: PendingItemsCardProps) {
  return (
    <Card sx={{ p: "15px", mb: "14px", borderRadius: "18px", boxShadow: tokens.rowCardShadow }}>
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: "8px" }}>
        {title}({items.length}件)
      </Typography>
      {items.map((item, index) => (
        <Box
          key={index}
          sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", py: "6px", borderBottom: index < items.length - 1 ? `1px solid ${tokens.divider}` : "none" }}
        >
          <ItemRowLabel name={item.name} kcal={item.kcal} />
          <Button size="small" onClick={() => onRemove(index)} sx={{ fontSize: 12, color: "primary.main", flexShrink: 0 }}>
            削除
          </Button>
        </Box>
      ))}
      {footnote && (
        <Typography sx={{ fontSize: 10.5, color: tokens.faint, mt: "6px" }}>{footnote}</Typography>
      )}
    </Card>
  );
}
