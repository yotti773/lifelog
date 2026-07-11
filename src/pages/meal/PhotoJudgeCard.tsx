import { useEffect, useMemo, type ChangeEvent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { IconCamera, IconLibrary, IconSparkle, IconWarning } from "@/components/icons";
import { fontRounded, tokens } from "@/theme";

interface PhotoJudgeCardProps {
  isJudging: boolean;
  /** 選択済みの写真。解析は写真選択と分離されており、解析ボタンで明示的に実行する(Issue #71) */
  photo: File | null;
  note: string;
  onNoteChange: (note: string) => void;
  onPhotoSelected: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearPhoto: () => void;
  onJudge: () => void;
  judgeError: string | null;
  /** 判定の自信が低い場合の注意表示(判定結果をフォームに反映中のときのみ出す) */
  showUncertainWarning: boolean;
}

/**
 * 食事記録画面の「写真から記録する」カード。
 * 写真を選ぶ→備考を入力→「AIで解析する」ボタンで実行、の流れ(Issue #71)。
 * 以前は写真選択と同時に解析していたが、備考を解析に反映できるよう分離した
 */
export default function PhotoJudgeCard({
  isJudging,
  photo,
  note,
  onNoteChange,
  onPhotoSelected,
  onClearPhoto,
  onJudge,
  judgeError,
  showUncertainWarning,
}: PhotoJudgeCardProps) {
  const previewUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  return (
    <Card sx={{ p: "15px", mb: "14px", borderRadius: "18px", boxShadow: tokens.rowCardShadow }}>
      <Typography sx={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: "12px" }}>
        <Box component="span" sx={{ color: "primary.main", display: "flex" }}>
          <IconCamera size={16} />
        </Box>
        写真から記録する
      </Typography>
      <Box sx={{ display: "flex", gap: "8px", mb: "10px" }}>
        <Button
          component="label"
          disabled={isJudging}
          startIcon={<IconCamera />}
          sx={{ flex: 1, height: 44, borderRadius: "11px", bgcolor: tokens.primarySoft, color: "primary.main", fontSize: 12, "&:hover": { bgcolor: tokens.primarySoft } }}
        >
          撮影
          <input type="file" accept="image/*" capture="environment" onChange={onPhotoSelected} disabled={isJudging} hidden />
        </Button>
        <Button
          component="label"
          disabled={isJudging}
          startIcon={<IconLibrary />}
          sx={{ flex: 1, height: 44, borderRadius: "11px", bgcolor: tokens.beigeSoft, color: "text.secondary", fontSize: 12, "&:hover": { bgcolor: tokens.beigeSoft } }}
        >
          ライブラリ
          <input type="file" accept="image/*" onChange={onPhotoSelected} disabled={isJudging} hidden />
        </Button>
      </Box>
      {photo && previewUrl && (
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", bgcolor: tokens.beigeSoft, borderRadius: "12px", p: "9px 11px", mb: "10px" }}>
          <Box
            component="img"
            src={previewUrl}
            alt="選択した食事の写真"
            sx={{ width: 44, height: 44, borderRadius: "10px", objectFit: "cover", flexShrink: 0 }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700 }}>写真を選択済み</Typography>
            <Typography sx={{ fontSize: 10, color: "text.secondary", mt: "2px" }}>
              補足を書いてから解析すると精度が上がります
            </Typography>
          </Box>
          <ButtonBase
            onClick={onClearPhoto}
            disabled={isJudging}
            sx={{ fontSize: 11, color: "text.secondary", bgcolor: "background.paper", borderRadius: "8px", px: "9px", py: "5px", flexShrink: 0 }}
          >
            取り消し
          </ButtonBase>
        </Box>
      )}
      <TextField
        fullWidth
        size="small"
        type="text"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="補足(任意): 唐揚げ弁当、ご飯少なめ など"
      />
      <Button
        fullWidth
        disabled={photo === null || isJudging}
        onClick={onJudge}
        startIcon={<IconSparkle />}
        sx={{
          mt: "10px",
          height: 46,
          borderRadius: "12px",
          bgcolor: "secondary.main",
          color: "#fff",
          fontSize: 13,
          boxShadow: tokens.secondaryButtonShadow,
          "&:hover": { bgcolor: "secondary.dark" },
          "&.Mui-disabled": { bgcolor: tokens.beigeSoft, color: tokens.faint2, boxShadow: "none" },
        }}
      >
        {isJudging ? "解析中..." : "AIで解析する"}
      </Button>
      {photo === null && (
        <Typography sx={{ mt: "7px", fontSize: 10, color: tokens.faint, textAlign: "center" }}>
          写真を選ぶと解析できます
        </Typography>
      )}
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
