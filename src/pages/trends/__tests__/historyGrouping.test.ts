import { describe, expect, it } from "vitest";
import { groupWaterHistoryDays } from "../WaterHistoryList";
import { groupWorkoutHistoryDays } from "../WorkoutHistoryList";
import type { WaterRecord, WorkoutRecord } from "@/types";

function waterRecord(timestamp: string, amountMl: number): WaterRecord {
  return { id: crypto.randomUUID(), timestamp, amountMl, synced: false };
}

function workoutRecord(
  date: string,
  exerciseName: string,
  exerciseOrder: number,
  setNumber: number,
): WorkoutRecord {
  return {
    id: crypto.randomUUID(),
    date,
    timestamp: `${date}T20:00:00.000Z`,
    exerciseName,
    exerciseOrder,
    setNumber,
    weightKg: 50,
    reps: 10,
    synced: false,
  };
}

describe("groupWaterHistoryDays", () => {
  it("ローカル日付ごとに合計と回数を集約し、入力の降順を維持する", () => {
    const records = [
      waterRecord(new Date("2026-07-02T09:00:00").toISOString(), 500),
      waterRecord(new Date("2026-07-01T18:00:00").toISOString(), 350),
      waterRecord(new Date("2026-07-01T08:00:00").toISOString(), 200),
    ];

    expect(groupWaterHistoryDays(records)).toEqual([
      { date: "2026-07-02", totalMl: 500, count: 1 },
      { date: "2026-07-01", totalMl: 550, count: 2 },
    ]);
  });

  it("記録が無ければ空配列を返す", () => {
    expect(groupWaterHistoryDays([])).toEqual([]);
  });
});

describe("groupWorkoutHistoryDays", () => {
  it("日付ごとに種目名(exerciseOrder順)と総セット数を集約する", () => {
    const records = [
      workoutRecord("2026-07-02", "スクワット", 1, 1),
      workoutRecord("2026-07-01", "ベンチプレス", 1, 1),
      workoutRecord("2026-07-01", "ベンチプレス", 1, 2),
      workoutRecord("2026-07-01", "ラットプルダウン", 2, 1),
    ];

    expect(groupWorkoutHistoryDays(records)).toEqual([
      { date: "2026-07-02", exerciseNames: ["スクワット"], setCount: 1 },
      { date: "2026-07-01", exerciseNames: ["ベンチプレス", "ラットプルダウン"], setCount: 3 },
    ]);
  });

  it("インデックス由来で日付内の並びが乱れていても種目順を復元する", () => {
    const records = [
      workoutRecord("2026-07-01", "ラットプルダウン", 2, 1),
      workoutRecord("2026-07-01", "ベンチプレス", 1, 2),
      workoutRecord("2026-07-01", "ベンチプレス", 1, 1),
    ];

    expect(groupWorkoutHistoryDays(records)[0].exerciseNames).toEqual(["ベンチプレス", "ラットプルダウン"]);
  });
});
