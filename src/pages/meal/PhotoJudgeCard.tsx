import { useEffect, useMemo, type ChangeEvent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { MAX_MEAL_PHOTOS } from "@/api/judgeMeal";
import { IconCamera, IconClose, IconLibrary, IconSparkle, IconWarning } from "@/components/icons";
import { fontRounded, tokens } from "@/theme";

interface PhotoJudgeCardProps {
  isJudging: boolean;
  /** 選択済みの写真(最大MAX_MEAL_PHOTOS枚。Issue #110)。解析は写真選択と分離されており、解析ボタンで明示的に実行する(Issue #71) */
  photos: File[];
  note: string;
  onNoteChange: (note: string) => void;
  onPhotosSelected: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (index: number) => void;
  onJudge: () => void;
  judgeError: string | null;
  /** 判定の自信が低い場合の注意表示(判定結果をフォームに反映中のときのみ出す) */
  showUncertainWarning: boolean;
}

/**
 * 食事記録画面の「写真から記録する」カード。
 * 写真を選ぶ→備考を入力→「AIで解析する」ボタンで実行、の流れ(Issue #71)。
 * 以前は写真選択と同時に解析していたが、備考を解析に反映できるよう分離した。
 * 写真は複数枚(最大MAX_MEAL_PHOTOS枚)添付でき、1回の解析にまとめて送られる(Issue #110)
 */
export default function PhotoJudgeCard({
  isJudging,
  photos,
  note,
  onNoteChange,
  onPhotosSelected,
  onRemovePhoto,
  onJudge,
  judgeError,
  showUncertainWarning,
}: PhotoJudgeCardProps) {
  const previewUrls = useMemo(() => photos.map((photo) => URL.createObjectURL(photo)), [photos]);
  useEffect(
    () => () => {
      for (const url of previewUrls) URL.revokeObjectURL(url);
    },
    [previewUrls],
  );

  const isFull = photos.length >= MAX_MEAL_PHOTOS;
  const canAdd = !isJudging && !isFull;

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
          disabled={!canAdd}
          startIcon={<IconCamera />}
          sx={{ flex: 1, height: 44, borderRadius: "11px", bgcolor: tokens.primarySoft, color: "primary.main", fontSize: 12, "&:hover": { bgcolor: tokens.primarySoft } }}
        >
          撮影
          <input type="file" accept="image/*" capture="environment" onChange={onPhotosSelected} disabled={!canAdd} hidden />
        </Button>
        <Button
          component="label"
          disabled={!canAdd}
          startIcon={<IconLibrary />}
          sx={{ flex: 1, height: 44, borderRadius: "11px", bgcolor: tokens.beigeSoft, color: "text.secondary", fontSize: 12, "&:hover": { bgcolor: tokens.beigeSoft } }}
        >
          ライブラリ
          <input type="file" accept="image/*" multiple onChange={onPhotosSelected} disabled={!canAdd} hidden />
        </Button>
      </Box>
      {photos.length > 0 && (
        <Box sx={{ bgcolor: tokens.beigeSoft, borderRadius: "12px", p: "9px 11px", mb: "10px" }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: "8px", mb: "8px" }}>
            {previewUrls.map((url, index) => (
              <Box key={url} sx={{ position: "relative" }}>
                <Box
                  component="img"
                  src={url}
                  alt={`選択した食事の写真 ${index + 1}枚目`}
                  sx={{ display: "block", width: 56, height: 56, borderRadius: "10px", objectFit: "cover" }}
                />
                <ButtonBase
                  onClick={() => onRemovePhoto(index)}
                  disabled={isJudging}
                  aria-label={`${index + 1}枚目の写真を取り消す`}
                  sx={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    bgcolor: "background.paper",
                    color: "text.secondary",
                    boxShadow: tokens.fieldShadow,
                  }}
                >
                  <IconClose size={12} />
                </ButtonBase>
              </Box>
            ))}
          </Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
            写真を{photos.length}枚選択済み
            {isFull && (
              <Box component="span" sx={{ fontWeight: 400, color: "text.secondary" }}>
                (最大{MAX_MEAL_PHOTOS}枚)
              </Box>
            )}
          </Typography>
          <Typography sx={{ fontSize: 10, color: "text.secondary", mt: "2px" }}>
            同じ食事の写真をまとめて解析します。補足を書いてから解析すると精度が上がります
          </Typography>
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
        disabled={photos.length === 0 || isJudging}
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
      {photos.length === 0 && (
        <Typography sx={{ mt: "7px", fontSize: 10, color: tokens.faint, textAlign: "center" }}>
          写真を選ぶと解析できます(最大{MAX_MEAL_PHOTOS}枚)
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
