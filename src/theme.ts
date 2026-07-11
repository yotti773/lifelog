import { createTheme } from "@mui/material/styles";

export const fontRounded = "'M PLUS Rounded 1c', sans-serif";
export const fontBody = "'Noto Sans JP', sans-serif";

/**
 * accent(サニーイエロー)はデザインガイドで「達成の瞬間」(目標達成・連続記録など)専用。
 * 誤用を防ぐためMUIのpaletteには載せず、独立したトークンとして隔離している。
 * 常時表示の静的UIに使わないこと(CLAUDE.md参照)。
 * 例外として、PFCの「F(脂質)」の系列色にはハンドオフモックの指定に従い同じ黄色を使う
 * (グラフの系列色というデータ表現であり、強調装飾ではないため)。
 */
export const accent = {
  main: "#FFC145",
  deep: "#FFB01F",
  /** 達成状態の数値・文字色 */
  ink: "#E0A62A",
  /** 達成バナー等の文字色(濃) */
  textOn: "#7A4A00",
  /** 達成時のカード背景 */
  cardBg: "#FFFBF0",
};

/** ハンドオフモック(docs/handoff_lifelog_app)のデザイントークン */
export const tokens = {
  /** テキスト(弱)。時刻・キャプションなど */
  faint: "#B7AE9F",
  /** テキスト(最弱)。プレースホルダー・非活性 */
  faint2: "#C3B29A",
  /** 入力欄などのボーダー */
  border: "#F0E7DB",
  /** カード内の区切り線 */
  divider: "#F4EEE4",
  /** プログレスバーの溝 */
  track: "#F0EBE3",
  /** セグメントコントロールの溝 */
  segmentBg: "#F1E9DE",
  /** ベージュの淡背景(未記録アイコンチップ・検索欄など) */
  beigeSoft: "#F4EEE4",
  /** primaryの淡背景(ナビ活性・アイコンチップ) */
  primarySoft: "#FFEDE6",
  /** secondaryの淡背景(チップ・バナー) */
  secondarySoft: "#E4F7F5",
  /** secondaryの濃色(淡背景上の文字) */
  secondaryDeep: "#1B8B80",
  /** 警告(未同期チップなど)の背景/文字 */
  warnBg: "#FBF1DD",
  warnText: "#C6A05A",
  warnIcon: "#E0A62A",
  /** エラー表示の背景/文字 */
  errorBg: "#FDECEA",
  errorText: "#D24A34",
  /** 食事行アイコンチップの背景(朝食) */
  breakfastBg: "#FFF1D9",
  /** 水分記録のブルー系配色(デザインプロトタイプ参照。水を想起させるため、水分のみコーラルと別系統の配色を使う) */
  waterMain: "#3AA0DB",
  waterDeep: "#2B7BB0",
  waterSoft: "#E4F3FB",
  waterCardBg: "#EFF7FC",
  waterTrack: "#DCEAF3",
  waterInk: "#5A8CA8",
  waterBarGradient: "linear-gradient(90deg,#5FB6E6,#2B7BB0)",
  waterButtonShadow: "0 4px 12px -8px rgba(43,123,176,.25)",
  /** 筋トレのアイコンチップ背景 */
  strengthBg: "#FFE6DE",
  /** 日記の気分タイル: 選択中の背景/枠、ラベル文字色 */
  moodSelectedBg: "#FFF1D9",
  moodBorder: "#E0A62A",
  moodLabel: "#A97F2E",
  /** カードの暖色系シャドウ */
  cardShadow: "0 10px 26px -14px rgba(120,60,20,.28), 0 1px 0 rgba(0,0,0,.02)",
  rowCardShadow: "0 8px 20px -14px rgba(120,60,20,.26)",
  fieldShadow: "0 4px 12px -8px rgba(120,60,20,.2)",
  segmentActiveShadow: "0 3px 8px -3px rgba(120,60,20,.35)",
  fabShadow: "0 14px 26px -8px rgba(255,90,56,.7), 0 2px 4px rgba(0,0,0,.1)",
  primaryButtonShadow: "0 12px 24px -10px rgba(255,90,56,.6)",
  secondaryButtonShadow: "0 8px 18px -10px rgba(46,196,182,.7)",
  fabGradient: "linear-gradient(145deg,#FF7B5C,#FF5A38)",
};

export const theme = createTheme({
  palette: {
    background: { default: "#FFF8F0", paper: "#FFFFFF" },
    primary: { main: "#FF6B4A", dark: "#FF5A38", contrastText: "#FFFFFF" },
    secondary: { main: "#2EC4B6", dark: "#1B8B80", contrastText: "#FFFFFF" },
    text: { primary: "#2B2B2B", secondary: "#8C8C8C" },
    divider: tokens.divider,
  },
  typography: {
    fontFamily: fontBody,
    h1: { fontFamily: fontRounded, fontWeight: 700, fontSize: 22 },
    h2: { fontFamily: fontRounded, fontWeight: 700, fontSize: 16 },
    button: { fontFamily: fontRounded, fontWeight: 700, textTransform: "none" },
  },
  shape: { borderRadius: 16 },
  components: {
    // 数値入力のブラウザ標準スピナー(▲▼)はモックに無いため全体で非表示にする
    MuiCssBaseline: {
      styleOverrides: `
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; appearance: textfield; }
      `,
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { borderRadius: 22, boxShadow: tokens.cardShadow },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 14, fontSize: 14 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backgroundColor: "#FFFFFF",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: tokens.border, borderWidth: 1.5 },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: tokens.border },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#FF6B4A", borderWidth: 2 },
        },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 22 } },
    },
    MuiChip: {
      styleOverrides: { root: { fontFamily: fontRounded, fontWeight: 700 } },
    },
  },
});
