import { fontBody, fontRounded, theme, tokens } from "@/theme";
import type { ShareCardBadge, ShareCardModel } from "./shareCard";

/**
 * SNS共有カード(Issue #235)の描画。canvas 2Dで手描きする。
 *
 * チャートライブラリを使わず手書きSVGでグラフを描いているのと同じ理由で、
 * デザインガイドのパレット・字送りを厳密に制御するために外部ライブラリを足していない。
 * **アクセントの黄色(達成の瞬間専用)は使わない。絵文字も使わない**(CLAUDE.md)。
 *
 * 内容の決定はsrc/lib/shareCard.tsの純関数が済ませており、ここは受け取ったモデルを置くだけ。
 */

/** Xのタイムラインで切り取られない16:9。2倍解像度で書き出す */
export const SHARE_CARD_WIDTH = 1200;
export const SHARE_CARD_HEIGHT = 675;
const SCALE = 2;

const INK = theme.palette.text.primary;
const SUB = theme.palette.text.secondary;
const PRIMARY = theme.palette.primary.main;
const CREAM = theme.palette.background.default;

const CARD_INSET = 40;
const PAD_X = 96;
const CONTENT_LEFT = PAD_X;
const CONTENT_RIGHT = SHARE_CARD_WIDTH - PAD_X;

/**
 * 描画前に読み込ませるフォント。Webフォント(M PLUS Rounded 1c / Noto Sans JP)は
 * 画面に出ていない字形が未読み込みのことがあり、その状態でcanvasに描くと既定のsans-serifで
 * 描かれてしまう(画面と別のフォントの画像が出来上がる)ため、明示的に読み込んでから描く
 */
const REQUIRED_FONTS = [
  `800 112px ${fontRounded}`,
  `700 44px ${fontRounded}`,
  `700 36px ${fontRounded}`,
  `700 24px ${fontRounded}`,
  `400 24px ${fontBody}`,
  `400 20px ${fontBody}`,
];

async function ensureFontsLoaded(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    // 第2引数は「その字形が使えるか」の判定に使うサンプル。数字・単位・かなを混ぜて両フォントを起こす
    await Promise.all(REQUIRED_FONTS.map((font) => document.fonts.load(font, "0123456789kgcal記録今週日")));
  } catch {
    // 読み込みに失敗しても描画自体は続ける(フォールバックのsans-serifで描かれる)
  }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface TextStyle {
  font: string;
  color: string;
  align?: CanvasTextAlign;
}

/** 文字を置いて、その幅を返す(単位やバッジを右に続けて置くため) */
function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, style: TextStyle): number {
  ctx.font = style.font;
  ctx.fillStyle = style.color;
  ctx.textAlign = style.align ?? "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
  return ctx.measureText(text).width;
}

/** 前週比・前回比のバッジ。減=teal(順調)、増=coral、変化なし=ベージュ */
function badgeColors(tone: ShareCardBadge["tone"]) {
  if (tone === "down") return { bg: tokens.secondarySoft, fg: tokens.secondaryDeep };
  if (tone === "up") return { bg: tokens.primarySoft, fg: PRIMARY };
  return { bg: tokens.beigeSoft, fg: SUB };
}

/** 数値欄の既定の文字サイズ。列に収まらない値はfitScale()で縮める */
const STAT_VALUE_SIZE = 44;
const STAT_UNIT_SIZE = 22;
/** 数値欄の列と列の間に必ず空ける幅。隣の値とくっついて1つの数字に見えるのを防ぐ */
const STAT_GUTTER = 40;

/** 値+単位が列幅に収まる倍率(1.0=既定サイズのまま)。極端に小さくならないよう下限を設ける */
function fitScale(ctx: CanvasRenderingContext2D, stat: ShareCardModel["stats"][number], maxWidth: number): number {
  ctx.font = `700 ${STAT_VALUE_SIZE}px ${fontRounded}`;
  let width = ctx.measureText(stat.value).width;
  if (stat.unit !== undefined) {
    ctx.font = `700 ${STAT_UNIT_SIZE}px ${fontRounded}`;
    width += 6 + ctx.measureText(stat.unit).width;
  }
  return width <= maxWidth ? 1 : Math.max(0.62, maxWidth / width);
}

/**
 * モデルの内容をcanvasへ描く。canvasのサイズもここで設定する(呼び出し側は空の<canvas>を渡す)。
 * hostは画像のフッターに入れる配信元(location.host)。URLを直書きしないための引数
 */
export async function drawShareCard(
  canvas: HTMLCanvasElement,
  model: ShareCardModel,
  brand: { appName: string; host: string },
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("この端末では画像を生成できませんでした");

  canvas.width = SHARE_CARD_WIDTH * SCALE;
  canvas.height = SHARE_CARD_HEIGHT * SCALE;
  await ensureFontsLoaded();
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

  // 背景(クリーム)+ 白カード
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);
  ctx.save();
  ctx.shadowColor = "rgba(120,60,20,.18)";
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#FFFFFF";
  roundRectPath(
    ctx,
    CARD_INSET,
    CARD_INSET,
    SHARE_CARD_WIDTH - CARD_INSET * 2,
    SHARE_CARD_HEIGHT - CARD_INSET * 2,
    40,
  );
  ctx.fill();
  ctx.restore();

  // 見出し(何の記録か)と期間
  drawText(ctx, model.title, CONTENT_LEFT, 124, { font: `700 36px ${fontRounded}`, color: INK });
  drawText(ctx, model.period, CONTENT_LEFT, 168, { font: `400 24px ${fontBody}`, color: SUB });

  // 主数値
  if (model.headline !== null) {
    drawText(ctx, model.headline.caption, CONTENT_LEFT, 262, { font: `400 22px ${fontBody}`, color: tokens.faint });
    const valueWidth = drawText(ctx, model.headline.value, CONTENT_LEFT, 372, {
      font: `800 112px ${fontRounded}`,
      color: INK,
    });
    const unitWidth = drawText(ctx, model.headline.unit, CONTENT_LEFT + valueWidth + 10, 372, {
      font: `700 34px ${fontRounded}`,
      color: SUB,
    });

    if (model.badge !== null) {
      const { bg, fg } = badgeColors(model.badge.tone);
      ctx.font = `700 26px ${fontRounded}`;
      const textWidth = ctx.measureText(model.badge.text).width;
      const badgeX = CONTENT_LEFT + valueWidth + unitWidth + 40;
      const badgeH = 58;
      const badgeY = 372 - 34 - badgeH / 2;
      ctx.fillStyle = bg;
      roundRectPath(ctx, badgeX, badgeY, textWidth + 56, badgeH, badgeH / 2);
      ctx.fill();
      drawText(ctx, model.badge.text, badgeX + 28, badgeY + badgeH / 2 + 9, {
        font: `700 26px ${fontRounded}`,
        color: fg,
      });
    }
  }

  // 数値の並び(最大4項目。等幅の列に左揃えで置く)
  if (model.stats.length > 0) {
    const columnWidth = (CONTENT_RIGHT - CONTENT_LEFT) / model.stats.length;
    model.stats.forEach((stat, i) => {
      const x = CONTENT_LEFT + columnWidth * i;
      drawText(ctx, stat.label, x, 470, { font: `400 20px ${fontBody}`, color: SUB });
      // 桁数の多い値(PFCの「180/120/450」など)が隣の列に食い込まないよう、収まる大きさまで縮める
      const scale = fitScale(ctx, stat, columnWidth - STAT_GUTTER);
      const valueFont = `700 ${Math.round(STAT_VALUE_SIZE * scale)}px ${fontRounded}`;
      const valueWidth = drawText(ctx, stat.value, x, 528, { font: valueFont, color: INK });
      if (stat.unit !== undefined) {
        drawText(ctx, stat.unit, x + valueWidth + 6, 528, {
          font: `700 ${Math.round(STAT_UNIT_SIZE * scale)}px ${fontRounded}`,
          color: SUB,
        });
      }
      if (stat.sub !== undefined) {
        drawText(ctx, stat.sub, x, 560, { font: `400 19px ${fontBody}`, color: tokens.faint });
      }
    });
  }

  // フッター(アプリ名と配信元)
  ctx.strokeStyle = tokens.divider;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CONTENT_LEFT, 586);
  ctx.lineTo(CONTENT_RIGHT, 586);
  ctx.stroke();
  drawText(ctx, brand.appName, CONTENT_LEFT, 620, { font: `700 24px ${fontRounded}`, color: PRIMARY });
  drawText(ctx, brand.host, CONTENT_RIGHT, 620, { font: `400 20px ${fontBody}`, color: tokens.faint, align: "right" });
}

export function shareCardToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob !== null ? resolve(blob) : reject(new Error("画像の書き出しに失敗しました"))),
      "image/png",
    );
  });
}

export function shareCardFileName(model: ShareCardModel): string {
  return `karadalog-${model.kind === "weekly" ? "week" : "day"}-${model.fileDate}.png`;
}
