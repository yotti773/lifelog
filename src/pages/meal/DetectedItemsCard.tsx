import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import type { MealJudgmentItem } from "@/api/judgeMeal";
import { fontRounded, tokens } from "@/theme";
import ItemRowLabel from "./ItemRowLabel";

interface DetectedItemsCardProps {
  items: MealJudgmentItem[];
  /** フォームに反映中の品目のindex(手入力・マスタ選択に切り替えたらnull) */
  activeIndex: number | null;
  /** 「まとめて記録リスト」に追加済みの品目のindex */
  addedIndexes: ReadonlySet<number>;
  onSelect: (index: number) => void;
}

/** 写真AIが複数品目を検出したときの選択リスト。追加済みの品目は選択不可として薄く表示する */
export default function DetectedItemsCard({ items, activeIndex, addedIndexes, onSelect }: DetectedItemsCardProps) {
  return (
    <Card sx={{ p: "15px", mb: "14px", borderRadius: "18px", boxShadow: tokens.rowCardShadow }}>
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: "4px" }}>
        検出した品目({items.length}件)
      </Typography>
      <Typography sx={{ fontSize: 11, color: "text.secondary", mb: "10px" }}>
        タップしてフォームに反映し、内容を確認してから下の「この品目を追加してもう1品記録」でリストに入れてください
      </Typography>
      {items.map((item, index) => {
        const isAdded = addedIndexes.has(index);
        const isActive = activeIndex === index;
        return (
          <ButtonBase
            key={index}
            onClick={() => onSelect(index)}
            disabled={isAdded}
            sx={{
              width: "100%",
              justifyContent: "space-between",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              py: "9px",
              px: "8px",
              borderRadius: "10px",
              bgcolor: isActive ? tokens.secondarySoft : "transparent",
              opacity: isAdded ? 0.5 : 1,
              borderBottom: index < items.length - 1 ? `1px solid ${tokens.divider}` : "none",
            }}
          >
            <ItemRowLabel name={item.dishName} kcal={item.kcal} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: isAdded ? "text.secondary" : "primary.main", flexShrink: 0 }}>
              {isAdded ? "追加済み" : isActive ? "選択中" : "選ぶ"}
            </Typography>
          </ButtonBase>
        );
      })}
    </Card>
  );
}
