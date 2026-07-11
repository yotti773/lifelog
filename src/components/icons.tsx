import type { SVGProps } from "react";

/**
 * ハンドオフモック(docs/handoff_lifelog_app)の手描きSVGアイコン集。
 * 絵文字は使わず、ストローク1.6〜1.9・丸みのあるlinecap/linejoinで統一する(モックのAssets節参照)。
 * 色は親要素のcolor(currentColor)を継承する。
 */

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function base({ size = 22, ...props }: IconProps, viewBox: string) {
  return { width: size, height: size, viewBox, fill: "none", ...props } as const;
}

export function IconHome(props: IconProps) {
  return (
    <svg {...base(props, "0 0 24 24")}>
      <path d="M3 10.5 12 3l9 7.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 9.5V20h13V9.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconTrends(props: IconProps) {
  return (
    <svg {...base(props, "0 0 24 24")}>
      <path d="M4 18V6M4 18h16M8 15l4-5 3 3 4-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...base(props, "0 0 24 24")}>
      <path
        d="M6 8h12M6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm12 8H6m12 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base({ size: 16, ...props }, "0 0 16 16")}>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBack(props: IconProps) {
  return (
    <svg {...base({ size: 18, ...props }, "0 0 18 18")}>
      <path d="M11 4l-5 5 5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base({ size: 26, ...props }, "0 0 26 26")}>
      <path d="M13 5V21M5 13H21" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** フォーク(食事関連) */
export function IconFork(props: IconProps) {
  return (
    <svg {...base({ size: 24, ...props }, "0 0 24 24")}>
      <path
        d="M7 3v7a2 2 0 0 0 2 2v9M9 3v6M5 3v6M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 朝食(日の出) */
export function IconBreakfast(props: IconProps) {
  return (
    <svg {...base(props, "0 0 24 24")}>
      <path
        d="M12 4v2M5.5 9.5 7 11M18.5 9.5 17 11M4 20h16M8 20a4 4 0 0 1 8 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 昼食(丼と湯気) */
export function IconLunch(props: IconProps) {
  return (
    <svg {...base(props, "0 0 24 24")}>
      <path
        d="M3.5 11h17M5 11a7 7 0 0 0 14 0M12 5c0 1.1 1 1.4 1 2.4M9.2 6.2c0 .8.6 1 .6 1.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 夕食(フォークとナイフ) */
export function IconDinner(props: IconProps) {
  return (
    <svg {...base(props, "0 0 24 24")}>
      <path
        d="M7 3v7a2 2 0 0 0 4 0V3M9 3v18M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 間食(クッキー) */
export function IconSnack(props: IconProps) {
  return (
    <svg {...base(props, "0 0 24 24")}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9.5" cy="10" r="1" fill="currentColor" />
      <circle cx="14.2" cy="9.6" r="1" fill="currentColor" />
      <circle cx="13" cy="14.2" r="1" fill="currentColor" />
      <circle cx="9.3" cy="14.4" r="1" fill="currentColor" />
    </svg>
  );
}

/** 上下矢印(前回比チップ)。up=trueで上向き */
export function IconArrow({ up = false, ...props }: IconProps & { up?: boolean }) {
  return (
    <svg {...base({ size: 10, ...props }, "0 0 10 10")} style={{ transform: up ? "rotate(180deg)" : undefined, ...props.style }}>
      <path d="M5 8V2M5 8L2.5 5.5M5 8L7.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 時計(設定・目標体重の行) */
export function IconClock(props: IconProps) {
  return (
    <svg {...base({ size: 18, ...props }, "0 0 20 20")}>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10 6v4l2.5 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** カレンダー(設定・目標日の行) */
export function IconCalendar(props: IconProps) {
  return (
    <svg {...base({ size: 18, ...props }, "0 0 20 20")}>
      <rect x="3" y="4" width="14" height="13" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 8h14M7 2v3M13 2v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** 太陽(設定・基準日の行) */
export function IconSun(props: IconProps) {
  return (
    <svg {...base({ size: 18, ...props }, "0 0 20 20")}>
      <path
        d="M10 2v3M10 15v3M4 10H2M18 10h-2M4.9 4.9 3.5 3.5M16.5 16.5l-1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

/** 人(設定・目標カロリーの行) */
export function IconPerson(props: IconProps) {
  return (
    <svg {...base({ size: 18, ...props }, "0 0 20 20")}>
      <path
        d="M10 3c-1.5 0-2 2-2 3.5S9 9 10 9s2-1 2-2.5S11.5 3 10 3ZM4 17c0-3 2.5-5 6-5s6 2 6 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 同期(矢印の循環) */
export function IconSync(props: IconProps) {
  return (
    <svg {...base({ size: 17, ...props }, "0 0 18 18")}>
      <path d="M15 4v4h-4M3 14v-4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.5 8a5.5 5.5 0 0 0-10-2M3.5 10a5.5 5.5 0 0 0 10 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** ダウンロード(定番メニュー一括登録) */
export function IconDownload(props: IconProps) {
  return (
    <svg {...base({ size: 18, ...props }, "0 0 20 20")}>
      <path d="M10 3v9M6.5 8.5 10 12l3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** カメラ(写真撮影) */
export function IconCamera(props: IconProps) {
  return (
    <svg {...base({ size: 16, ...props }, "0 0 20 20")}>
      <rect x="2" y="5" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="11" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 5l1.5-2h3L13 5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** 画像ライブラリ */
export function IconLibrary(props: IconProps) {
  return (
    <svg {...base({ size: 16, ...props }, "0 0 20 20")}>
      <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
      <path d="M4 14l4-4 4 4 3-3 2 2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base({ size: 15, ...props }, "0 0 16 16")}>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** 鉛筆(編集) */
export function IconEdit(props: IconProps) {
  return (
    <svg {...base({ size: 16, ...props }, "0 0 20 20")}>
      <path
        d="M13.5 3.5a2 2 0 0 1 3 3L7 16l-4 1 1-4 9.5-9.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 水滴(水分記録) */
export function IconDrop(props: IconProps) {
  return (
    <svg {...base({ size: 21, ...props }, "0 0 24 24")}>
      <path
        d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** ノート(日記) */
export function IconDiary(props: IconProps) {
  return (
    <svg {...base({ size: 21, ...props }, "0 0 24 24")}>
      <path
        d="M5 4h11a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 9h7M8 12.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** バーベル(筋トレ) */
export function IconBarbell(props: IconProps) {
  return (
    <svg {...base({ size: 21, ...props }, "0 0 24 24")}>
      <path
        d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** ×(リスト行の削除) */
export function IconClose(props: IconProps) {
  return (
    <svg {...base({ size: 13, ...props }, "0 0 14 14")}>
      <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** ごみ箱(削除) */
export function IconTrash(props: IconProps) {
  return (
    <svg {...base({ size: 16, ...props }, "0 0 20 20")}>
      <path d="M3.5 5.5h13M8 3h4M5 5.5 6 17h8l1-11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.2 8.5v5M11.8 8.5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** 警告(注意喚起の三角) */
export function IconWarning(props: IconProps) {
  return (
    <svg {...base({ size: 16, ...props }, "0 0 20 20")}>
      <path
        d="M10 3.2 18 16.5H2L10 3.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 8.2v3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.9" fill="currentColor" />
    </svg>
  );
}

/** きらめき(AI判定結果の反映など、自動処理の目印) */
export function IconSparkle(props: IconProps) {
  return (
    <svg {...base({ size: 15, ...props }, "0 0 18 18")}>
      <path
        d="M9 2.5c.4 2.6 1.4 3.6 4 4-2.6.4-3.6 1.4-4 4-.4-2.6-1.4-3.6-4-4 2.6-.4 3.6-1.4 4-4Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M14.5 12v2.4M13.3 13.2h2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** 身長(ものさし。身体プロフィール設定用) */
export function IconRuler(props: IconProps) {
  return (
    <svg {...base({ size: 18, ...props }, "0 0 20 20")}>
      <rect x="7.2" y="2.5" width="5.6" height="15" rx="1.6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7.2 6h2.6M7.2 10h3.6M7.2 14h2.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** チェックマーク(AIコメントの「続けたいこと」、提案の反映済み表示など) */
export function IconCheck(props: IconProps) {
  return (
    <svg {...base({ size: 15, ...props }, "0 0 16 16")}>
      <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 炎(消費カロリー・実測TDEEの目印) */
export function IconFlame(props: IconProps) {
  return (
    <svg {...base({ size: 18, ...props }, "0 0 20 20")}>
      <path
        d="M10 2.8c.5 2.4-.8 3.7-2.2 5.1C6.4 9.3 5.4 10.7 5.4 12.6a4.6 4.6 0 0 0 9.2 0c0-1.6-.7-2.9-1.5-4-.3 1-.9 1.6-1.7 2 .3-2.7-.3-5.6-1.4-7.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 達成演出(紙吹雪・スター) */
/** 活動(Garmin由来の歩数・消費カロリー等)。心拍の脈波モチーフ(Issue #82) */
export function IconActivity(props: IconProps) {
  return (
    <svg {...base(props, "0 0 24 24")}>
      <path
        d="M3 12h4l2.5-6 4.5 12 2.5-6H21"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconCelebrate(props: IconProps) {
  return (
    <svg {...base({ size: 16, ...props }, "0 0 20 20")}>
      <path
        d="M9 2.5l1 2.3 2.4.4-1.7 1.8.3 2.4-2-1.2-2 1.2.3-2.4L5.6 5.2l2.4-.4L9 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M15.5 8.5v2.4M18 11.2h-2.4M4 13.5l1.3 1.3M2.7 16.1l1.3-1.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** 鍵(API保護。Issue #87) */
export function IconKey(props: IconProps) {
  return (
    <svg {...base(props, "0 0 24 24")}>
      <circle cx="8" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M11.5 12H20m-2.5 0v3M14.5 12v2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
