import type { ChangeEvent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { IconCamera, IconLibrary, IconWarning } from "@/components/icons";
import { fontRounded, tokens } from "@/theme";

interface PhotoJudgeCardProps {
  isJudging: boolean;
  note: string;
  onNoteChange: (note: string) => void;
  onPhotoSelected: (e: ChangeEvent<HTMLInputElement>) => void;
  judgeError: string | null;
  /** 判定の自信が低い場合の注意表示(判定結果をフォームに反映中のときのみ出す) */
  showUncertainWarning: boolean;
}

/** 食事記録画面の「写真から記録する」カード。撮影/ライブラリ選択と補足入力、判定エラー・低確度警告の表示を持つ */
export default function PhotoJudgeCard({
  isJudging,
  note,
  onNoteChange,
  onPhotoSelected,
  judgeError,
  showUncertainWarning,
}: PhotoJudgeCardProps) {
  return (
    <Card sx={{ p: "15px", mb: "14px", borderRadius: "18px", boxShadow: tokens.rowCardShadow }}>
      <Typography sx={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: "12px" }}>
        <Box component="span" sx={{ color: "primary.main", display: "flex" }}>
          <IconCamera size={16} />
        </Box>
        写真から記録する
      </Typography>
      <Box sx={{ display: "flex", gap: "8px", mb: "12px" }}>
        <Button
          component="label"
          disabled={isJudging}
          startIcon={<IconCamera />}
          sx={{ flex: 1, height: 44, borderRadius: "11px", bgcolor: tokens.primarySoft, color: "primary.main", fontSize: 12, "&:hover": { bgcolor: tokens.primarySoft } }}
        >
          {isJudging ? "判定中..." : "撮影"}
          <input type="file" accept="image/*" capture="environment" onChange={onPhotoSelected} disabled={isJudging} hidden />
        </Button>
        <Button
          component="label"
          disabled={isJudging}
          startIcon={<IconLibrary />}
          sx={{ flex: 1, height: 44, borderRadius: "11px", bgcolor: tokens.beigeSoft, color: "text.secondary", fontSize: 12, "&:hover": { bgcolor: tokens.beigeSoft } }}
        >
          {isJudging ? "判定中..." : "ライブラリ"}
          <input type="file" accept="image/*" onChange={onPhotoSelected} disabled={isJudging} hidden />
        </Button>
      </Box>
      <TextField
        fullWidth
        size="small"
        type="text"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="補足(任意): 唐揚げ弁当、ご飯少なめ など"
      />
      {judgeError && <Typography sx={{ mt: "10px", fontSize: 12, color: "primary.main" }}>{judgeError}</Typography>}
      {showUncertainWarning && (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: "7px", mt: "10px", bgcolor: tokens.warnBg, borderRadius: "10px", p: "9px 11px" }}>
          <Box sx={{ color: "#B07E1E", display: "flex", mt: "1px" }}>
            <IconWarning />
          </Box>
          <Typography sx={{ fontSize: 11, fontWeight: 500, color: "#B07E1E", lineHeight: 1.5 }}>
            量や内容の判定の自信が低いため、誤差が大きい場合があります。内容を確認・修正してください
          </Typography>
        </Box>
      )}
    </Card>
  );
}
