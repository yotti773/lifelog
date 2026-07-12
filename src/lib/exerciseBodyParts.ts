import type { ExerciseBodyPart } from "@/types";

/**
 * 種目マスタの部位分類(Issue #104)の表示順とラベル。
 * シートへの書き出し・取り込みではworker側の複製(worker/exerciseBodyPartLabels.ts)を使う —
 * worker/はsrc/に依存しない独立ビルドのため、変更時は両方を揃えること。
 */

export const EXERCISE_BODY_PART_ORDER: ExerciseBodyPart[] = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "core",
  "other",
];

export const EXERCISE_BODY_PART_LABELS: Record<ExerciseBodyPart, string> = {
  chest: "胸",
  back: "背中",
  shoulders: "肩",
  arms: "腕",
  legs: "脚",
  core: "体幹",
  other: "その他",
};

export function bodyPartLabel(bodyPart: ExerciseBodyPart): string {
  return EXERCISE_BODY_PART_LABELS[bodyPart];
}
