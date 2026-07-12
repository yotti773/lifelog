// 種目マスタの部位分類(Issue #104)のシート表示ラベル。
// worker/はsrc/に依存しない独立ビルドのため、src/lib/exerciseBodyParts.ts の複製。変更時は両方を揃えること。
export const EXERCISE_BODY_PART_LABELS: Record<string, string> = {
  chest: "胸",
  back: "背中",
  shoulders: "肩",
  arms: "腕",
  legs: "脚",
  core: "体幹",
  other: "その他",
};
