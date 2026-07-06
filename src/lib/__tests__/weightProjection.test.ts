import { describe, expect, it } from "vitest";
import { MAX_EXTRAPOLATION_RATIO, MIN_PROJECTION_SPAN_DAYS, projectWeightAtDate } from "../weightProjection";

describe("projectWeightAtDate", () => {
  it("減少ペースを目標日まで外挿する", () => {
    // 10日で1.0kg減(-0.1kg/日)。最新から目標日まで20日 → 70.0 - 0.1*20 = 68.0
    const result = projectWeightAtDate(
      { date: "2026-07-01", weightKg: 71.0 },
      { date: "2026-07-11", weightKg: 70.0 },
      "2026-07-31",
    );
    expect(result).toBeCloseTo(68.0, 5);
  });

  it("増加ペースなら目標日時点で増えた値を返す", () => {
    // 10日で1.0kg増(+0.1kg/日)。最新から目標日まで10日 → 70.0 + 0.1*10 = 71.0
    const result = projectWeightAtDate(
      { date: "2026-07-01", weightKg: 69.0 },
      { date: "2026-07-11", weightKg: 70.0 },
      "2026-07-21",
    );
    expect(result).toBeCloseTo(71.0, 5);
  });

  it("スパンが最小日数未満なら予測しない(null)", () => {
    const result = projectWeightAtDate(
      { date: "2026-07-01", weightKg: 71.0 },
      { date: `2026-07-0${MIN_PROJECTION_SPAN_DAYS}`, weightKg: 70.0 },
      "2026-07-31",
    );
    // スパン = MIN-1 日
    expect(result).toBeNull();
  });

  it("起点と最新が同じ日ならnull", () => {
    const result = projectWeightAtDate(
      { date: "2026-07-01", weightKg: 71.0 },
      { date: "2026-07-01", weightKg: 71.0 },
      "2026-07-31",
    );
    expect(result).toBeNull();
  });

  it("目標日が最新記録より前ならnull", () => {
    const result = projectWeightAtDate(
      { date: "2026-07-01", weightKg: 71.0 },
      { date: "2026-07-20", weightKg: 70.0 },
      "2026-07-10",
    );
    expect(result).toBeNull();
  });

  it("スパンが最小日数ちょうどなら予測する", () => {
    const result = projectWeightAtDate(
      { date: "2026-07-01", weightKg: 70.3 },
      { date: `2026-07-0${1 + MIN_PROJECTION_SPAN_DAYS}`, weightKg: 70.0 },
      `2026-07-0${1 + MIN_PROJECTION_SPAN_DAYS}`,
    );
    // 目標日=最新日 → 最新体重そのもの
    expect(result).toBeCloseTo(70.0, 5);
  });

  it("短いスパンを何か月も先の目標日まで外挿するとnull(マイナス体重のような非現実的な値を防ぐ)", () => {
    // 3日で2.0kg減という短期的なノイズレベルの傾きを、約4か月先(要件定義書の目標日相当)まで
    // 外挿すると、対策前は 68.0 - 0.667*118 ≈ -10kg のような非現実的な値になっていた
    const result = projectWeightAtDate(
      { date: "2026-07-01", weightKg: 70.0 },
      { date: "2026-07-04", weightKg: 68.0 },
      "2026-10-31",
    );
    expect(result).toBeNull();
  });

  it("外挿日数が観測スパンのMAX_EXTRAPOLATION_RATIO倍ちょうどなら予測する", () => {
    const spanDays = 10;
    const daysToTarget = spanDays * MAX_EXTRAPOLATION_RATIO;
    const result = projectWeightAtDate(
      { date: "2026-07-01", weightKg: 71.0 },
      { date: "2026-07-11", weightKg: 70.0 }, // spanDays=10, -0.1kg/日
      "2026-08-30", // 2026-07-11から50日後(spanDays 10 * MAX_EXTRAPOLATION_RATIO 5)
    );
    expect(result).toBeCloseTo(70.0 - 0.1 * daysToTarget, 5);
  });

  it("外挿日数が観測スパンのMAX_EXTRAPOLATION_RATIO倍を1日でも超えるとnull", () => {
    const result = projectWeightAtDate(
      { date: "2026-07-01", weightKg: 71.0 },
      { date: "2026-07-11", weightKg: 70.0 }, // spanDays=10
      "2026-08-31", // 2026-07-11から51日後(10*5=50日を1日超過)
    );
    expect(result).toBeNull();
  });
});
