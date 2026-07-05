import { describe, expect, it } from "vitest";
import { MIN_PROJECTION_SPAN_DAYS, projectWeightAtDate } from "../weightProjection";

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
});
