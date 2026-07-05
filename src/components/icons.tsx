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

/** ごみ箱(削除) */
export function IconTrash(props: IconProps) {
  return (
    <svg {...base({ size: 16, ...props }, "0 0 20 20")}>
      <path d="M3.5 5.5h13M8 3h4M5 5.5 6 17h8l1-11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.2 8.5v5M11.8 8.5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
