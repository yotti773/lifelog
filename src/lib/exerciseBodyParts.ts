import type { ExerciseBodyPart } from "@/types";

/**
 * 種目マスタの部位分類(Issue #104)の表示順とラベル。
 * シートへの書き出し・取り込みではworker側の複製(worker/exerciseBodyPartLabels.ts)を使う —
 * worker/はsrc/に依存しない独立ビルドのため、変更時は両方を揃えること。
 */

export const EXERCISE_BODY_PART_LABELS: Record<ExerciseBodyPart, string> = {
  chest: "胸",
  back: "背中",
  shoulders: "肩",
  arms: "腕",
  legs: "脚",
  core: "体幹",
  other: "その他",
};

/** 選択チップの表示順(ラベル定義のキー順をそのまま使う) */
export const EXERCISE_BODY_PART_ORDER = Object.keys(EXERCISE_BODY_PART_LABELS) as ExerciseBodyPart[];
