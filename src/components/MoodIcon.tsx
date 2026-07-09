import type { DiaryMood } from "@/types";

/**
 * 日記の気分タグ(5段階)の定義と手描きSVG表情アイコン。
 * パスはデザインプロトタイプ(docs/handoff_lifelog_app/prototype.dc.html)のmoodDefsをそのまま移植している。
 */

interface MoodDef {
  label: string;
  eyes: "dot" | "closed";
  eyeR?: number;
  eyeLeft?: string;
  eyeRight?: string;
  browLeft?: string;
  browRight?: string;
  mouth: string;
}

export const MOOD_ORDER: DiaryMood[] = ["great", "good", "ok", "tired", "bad"];

export const MOOD_DEFS: Record<DiaryMood, MoodDef> = {
  great: { label: "絶好調", eyes: "dot", eyeR: 1.3, mouth: "M8 13 Q12 18.5 16 13" },
  good: { label: "良い", eyes: "dot", eyeR: 1, mouth: "M8.5 14 Q12 16.8 15.5 14" },
  ok: { label: "普通", eyes: "dot", eyeR: 1, mouth: "M8.5 15 L15.5 15" },
  tired: {
    label: "眠い",
    eyes: "closed",
    eyeLeft: "M7.7 10 Q9 11.2 10.3 10",
    eyeRight: "M13.7 10 Q15 11.2 16.3 10",
    mouth: "M9 15.2 Q12 15.8 15 15.2",
  },
  bad: {
    label: "不調",
    eyes: "dot",
    eyeR: 1,
    browLeft: "M7.8 8.2 L10.2 9.3",
    browRight: "M16.2 8.2 L13.8 9.3",
    mouth: "M8.5 16.3 Q12 13.3 15.5 16.3",
  },
};

export function moodLabel(mood: DiaryMood): string {
  return MOOD_DEFS[mood].label;
}

interface MoodIconProps {
  mood: DiaryMood;
  size?: number;
  color?: string;
}

export default function MoodIcon({ mood, size = 26, color = "#E0A62A" }: MoodIconProps) {
  const def = MOOD_DEFS[mood];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" role="img" aria-label={def.label}>
      <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.7" />
      {def.browLeft && <path d={def.browLeft} stroke={color} strokeWidth="1.5" strokeLinecap="round" />}
      {def.browRight && <path d={def.browRight} stroke={color} strokeWidth="1.5" strokeLinecap="round" />}
      {def.eyes === "dot" ? (
        <>
          <circle cx="9.3" cy="10" r={def.eyeR} fill={color} />
          <circle cx="14.7" cy="10" r={def.eyeR} fill={color} />
        </>
      ) : (
        <>
          <path d={def.eyeLeft} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d={def.eyeRight} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      <path d={def.mouth} stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
