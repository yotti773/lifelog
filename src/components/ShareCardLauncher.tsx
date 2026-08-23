import { useEffect, useRef, useState, type RefObject } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Drawer from "@mui/material/Drawer";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { IconDownload, IconShare } from "@/components/icons";
import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  drawShareCard,
  shareCardFileName,
  shareCardToBlob,
} from "@/lib/shareCardCanvas";
import { fontRounded, tokens } from "@/theme";
import type { ShareCardModel, ShareCardOptions } from "@/lib/shareCard";

/** 画像のフッターに入れる署名。アイコンは描画側がPWAアイコンのマスターから読む */
const APP_NAME = "からだログ";

interface ShareCardLauncherProps {
  /**
   * オプションを受け取ってカードの内容を組み立てる。
   * 「体重を隠す」トグルの状態はこのコンポーネントが持ち、切り替えのたびに呼び直す
   */
  buildModel: (options: ShareCardOptions) => ShareCardModel;
  /** カードに添える一行の説明(週次・日次で文言が変わる) */
  description: string;
}

type Status = { kind: "idle" } | { kind: "done"; message: string } | { kind: "error"; message: string };

/**
 * SNS共有カード(Issue #235)の入口。カードの導線 + プレビューのボトムシートをまとめて持つ。
 *
 * 週次レビューとホーム(今日)の両方から同じ見た目・同じ操作で使えるよう、
 * 「何を載せるか」だけを`buildModel`で受け取り、描画・保存・共有はここに閉じている。
 */
/**
 * プレビューのcanvas。**描画をこのコンポーネントの中に置いているのは、
 * MUIのDrawerが中身をシートの表示と同時ではなく次のレンダーでマウントするため** —
 * 親のエフェクトから描こうとすると、その時点ではcanvasがまだ生成されておらず何も描かれない。
 * 自分のマウント後に描けば、refは必ず張られている
 */
function ShareCardPreview({
  model,
  canvasRef,
  onDrawn,
}: {
  model: ShareCardModel;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onDrawn: (error: string | null) => void;
}) {
  // 親がインラインで渡すコールバックを依存配列に入れると、再レンダリングのたびに描き直しが走る
  const onDrawnRef = useRef(onDrawn);
  onDrawnRef.current = onDrawn;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const canvas = canvasRef.current;
      if (canvas === null) {
        onDrawnRef.current("画像を作れませんでした");
        return;
      }
      try {
        await drawShareCard(canvas, model, { appName: APP_NAME });
        if (!cancelled) onDrawnRef.current(null);
      } catch (error) {
        if (!cancelled) {
          onDrawnRef.current(error instanceof Error ? error.message : "画像を作れませんでした");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [model, canvasRef]);

  return (
    <Box
      component="canvas"
      ref={canvasRef}
      aria-label="SNS共有用の画像プレビュー"
      sx={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}

export default function ShareCardLauncher({ buildModel, description }: ShareCardLauncherProps) {
  const [open, setOpen] = useState(false);
  const [hideWeight, setHideWeight] = useState(false);
  const [model, setModel] = useState<ShareCardModel | null>(null);
  const [isDrawing, setDrawing] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 最新のbuildModelを描画エフェクトから参照する。依存配列に入れると、親の再レンダリングのたびに
  // (同じ内容でも関数の同一性が変わるため)描き直しが走ってしまう
  const buildModelRef = useRef(buildModel);
  buildModelRef.current = buildModel;

  // シートを開いた時とトグル切り替え時にカードを組み直す。描画自体はプレビュー側が行う
  useEffect(() => {
    if (!open) {
      setModel(null);
      return;
    }
    setModel(buildModelRef.current({ hideWeightValue: hideWeight }));
    setStatus({ kind: "idle" });
    setDrawing(true);
  }, [open, hideWeight]);

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (canvas === null || model === null) return;
    try {
      const blob = await shareCardToBlob(canvas);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = shareCardFileName(model);
      anchor.click();
      // click()直後にrevokeするとダウンロードが失敗しうるため、十分長い猶予の後に解放する
      // (完全バックアップの書き出しと同じ理由。LocalBackupCard.tsx参照)
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus({ kind: "done", message: "画像を保存しました" });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "保存に失敗しました" });
    }
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (canvas === null || model === null) return;
    try {
      const blob = await shareCardToBlob(canvas);
      const file = new File([blob], shareCardFileName(model), { type: "image/png" });
      if (navigator.canShare?.({ files: [file] }) !== true) {
        setStatus({ kind: "error", message: "この端末は画像の共有に対応していません。保存してから投稿してください" });
        return;
      }
      await navigator.share({ files: [file] });
      setStatus({ kind: "done", message: "共有しました" });
    } catch (error) {
      // 共有シートを閉じただけ(AbortError)はエラー表示にしない
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "共有に失敗しました" });
    }
  };

  return (
    <>
      <Card sx={{ p: "18px" }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", mb: "6px" }}>
          SNSに共有
        </Typography>
        <Typography sx={{ fontSize: 12, color: tokens.faint, lineHeight: 1.7, mb: "12px" }}>{description}</Typography>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<IconShare size={16} />}
          onClick={() => setOpen(true)}
          sx={{ fontFamily: fontRounded, fontWeight: 700, py: "10px" }}
        >
          画像をつくる
        </Button>
      </Card>

      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "background.default",
              borderRadius: "28px 28px 0 0",
              p: "18px 20px 30px",
              mx: "auto",
              maxWidth: 448,
              width: "100%",
            },
          },
        }}
      >
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16, mb: "12px" }}>
          SNS用の画像
        </Typography>

        <Box
          sx={{
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow: tokens.rowCardShadow,
            bgcolor: "background.paper",
            aspectRatio: `${SHARE_CARD_WIDTH} / ${SHARE_CARD_HEIGHT}`,
          }}
        >
          {model !== null && (
            <ShareCardPreview
              model={model}
              canvasRef={canvasRef}
              onDrawn={(error) => {
                setDrawing(false);
                if (error !== null) setStatus({ kind: "error", message: error });
              }}
            />
          )}
        </Box>

        {model?.hasWeightValue === true && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: "12px" }}>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>体重の数値を隠す</Typography>
              <Typography sx={{ fontSize: 11, color: tokens.faint, mt: "2px" }}>
                増減(前週比・前回比)だけを残します
              </Typography>
            </Box>
            <Switch
              checked={hideWeight}
              onChange={(event) => setHideWeight(event.target.checked)}
              color="secondary"
              slotProps={{ input: { "aria-label": "体重の数値を隠す" } }}
            />
          </Box>
        )}

        <Box sx={{ display: "flex", gap: "10px", mt: "14px" }}>
          <Button
            fullWidth
            variant="contained"
            disabled={isDrawing}
            startIcon={<IconDownload size={16} />}
            onClick={handleSave}
            sx={{ fontFamily: fontRounded, fontWeight: 700, py: "11px", boxShadow: tokens.primaryButtonShadow }}
          >
            画像を保存
          </Button>
          {/* Web Share APIが無い環境(PC等)では保存だけを出す */}
          {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
            <Button
              fullWidth
              variant="outlined"
              disabled={isDrawing}
              startIcon={<IconShare size={16} />}
              onClick={handleShare}
              sx={{ fontFamily: fontRounded, fontWeight: 700, py: "11px" }}
            >
              共有
            </Button>
          )}
        </Box>

        {status.kind !== "idle" && (
          <Typography
            sx={{
              fontSize: 12,
              mt: "10px",
              color: status.kind === "error" ? tokens.errorText : tokens.secondaryDeep,
              lineHeight: 1.6,
            }}
          >
            {status.message}
          </Typography>
        )}
      </Drawer>
    </>
  );
}
