import Typography from "@mui/material/Typography";

/** 検出品目リストと「まとめて記録する品目」リストで共通の品目名表示 */
export default function ItemRowLabel({ name, kcal }: { name: string; kcal: number }) {
  return (
    <Typography sx={{ fontSize: 13, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {name}({Math.round(kcal)}kcal)
    </Typography>
  );
}
