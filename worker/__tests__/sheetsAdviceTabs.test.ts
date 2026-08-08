import { describe, expect, it } from "vitest";
import { planAdviceImport, planMonthlyAdviceImport, planSettingsImport } from "../sheetsImport";
import {
  ADVICE_HEADER,
  MONTHLY_ADVICE_HEADER,
  monthToSheetId,
  SETTINGS_FIELDS,
  SETTINGS_HEADER,
  monthToSheetLabel,
  VERDICT_FROM_LABEL,
  VERDICT_LABELS,
} from "../sheetsSync";

// 週次・月次AIコメントタブの取り込みパーサ(Issue #164)。
// AIコメントは生成が非決定的で再生成しても同じものが得られないため、往復で壊れないことが要。

describe("VERDICT_LABELS", () => {
  it("ラベルと値が1対1で往復する", () => {
    for (const [value, label] of Object.entries(VERDICT_LABELS)) {
      expect(VERDICT_FROM_LABEL[label]).toBe(value);
    }
    expect(Object.keys(VERDICT_FROM_LABEL)).toHaveLength(Object.keys(VERDICT_LABELS).length);
  });
});

describe("planAdviceImport", () => {
  it("週開始日・判定・総評が揃った行を取り込み、ID列が空なら週開始日を採番する", () => {
    const rows = [
      ADVICE_HEADER,
      [
        "2026年08月03日",
        "やや遅れ",
        "週平均は下がっていますが、目標ペースには届いていません。",
        "記録率100%\n water 目標達成",
        "朝の体重測定を継続\n間食を1回に減らす",
        "2026年08月10日 09:30",
        "",
      ],
    ];

    const plan = planAdviceImport(rows);

    expect(plan.records).toEqual([
      {
        weekStart: "2026-08-03",
        createdAt: "2026-08-10T00:30:00.000Z",
        advice: {
          verdict: "slightly_behind",
          summary: "週平均は下がっていますが、目標ペースには届いていません。",
          wins: ["記録率100%", "water 目標達成"],
          actions: ["朝の体重測定を継続", "間食を1回に減らす"],
        },
      },
    ]);
    expect(plan.idBackfills).toEqual([{ rowNumber: 2, id: "2026-08-03" }]);
    expect(plan.skippedRowCount).toBe(0);
  });

  it("wins・actionsが空でも取り込む(AIが返さない週がある)", () => {
    const rows = [ADVICE_HEADER, ["2026年08月03日", "順調", "順調です。", "", "", "2026年08月10日 09:30", "2026-08-03"]];
    const plan = planAdviceImport(rows);
    expect(plan.records[0].advice.wins).toEqual([]);
    expect(plan.records[0].advice.actions).toEqual([]);
    expect(plan.idBackfills).toEqual([]);
  });

  it("判定が読めない行はスキップする(画面のバッジが未定義になるため)", () => {
    const rows = [ADVICE_HEADER, ["2026年08月03日", "不明な判定", "総評", "", "", "", ""]];
    const plan = planAdviceImport(rows);
    expect(plan.records).toEqual([]);
    expect(plan.skippedRowCount).toBe(1);
  });

  it("総評が空の行はスキップする", () => {
    const rows = [ADVICE_HEADER, ["2026年08月03日", "順調", "  ", "", "", "", ""]];
    const plan = planAdviceImport(rows);
    expect(plan.records).toEqual([]);
    expect(plan.skippedRowCount).toBe(1);
  });

  it("同じ週の2行目以降は重複としてスキップする(1週1件・後勝ちの不変条件)", () => {
    const rows = [
      ADVICE_HEADER,
      ["2026年08月03日", "順調", "1件目", "", "", "", "2026-08-03"],
      ["2026年08月03日", "遅れ", "2件目", "", "", "", "2026-08-03"],
    ];
    const plan = planAdviceImport(rows);
    expect(plan.records).toHaveLength(1);
    expect(plan.records[0].advice.summary).toBe("1件目");
    expect(plan.skippedRowCount).toBe(1);
  });

  it("見出し行はスキップ件数に数えない", () => {
    expect(planAdviceImport([ADVICE_HEADER]).skippedRowCount).toBe(0);
  });

  it("タブが空(取り込み対象なし)でも壊れない", () => {
    expect(planAdviceImport([])).toEqual({ records: [], idBackfills: [], skippedRowCount: 0 });
  });
});

describe("月キーのシート表現", () => {
  it("表示は漢字入り・IDはフル日付にする(Sheetsに日付として解釈し直されるのを防ぐ)", () => {
    expect(monthToSheetLabel("2026-07")).toBe("2026年07月");
    expect(monthToSheetId("2026-07")).toBe("2026-07-01");
  });
});

describe("planMonthlyAdviceImport", () => {
  it("月・判定・総評が揃った行を取り込み、ID列が空なら月を採番する", () => {
    const rows = [
      MONTHLY_ADVICE_HEADER,
      ["2026年07月", "順調", "7月は順調に減量できました。", "記録が途切れなかった", "夏場の水分量を増やす", "2026年08月01日 10:00", ""],
    ];

    const plan = planMonthlyAdviceImport(rows);

    expect(plan.records).toEqual([
      {
        month: "2026-07",
        createdAt: "2026-08-01T01:00:00.000Z",
        advice: {
          verdict: "on_track",
          summary: "7月は順調に減量できました。",
          wins: ["記録が途切れなかった"],
          actions: ["夏場の水分量を増やす"],
        },
      },
    ]);
    // ID列は体重記録と同じ「フル日付」の形。月キーそのままだとSheetsが日付へ解釈し直してしまう
    expect(plan.idBackfills).toEqual([{ rowNumber: 2, id: "2026-07-01" }]);
  });

  it("月の表示形式(YYYY年MM月)でない行はスキップする", () => {
    const rows = [MONTHLY_ADVICE_HEADER, ["2026年7月", "順調", "総評", "", "", "", ""]];
    const plan = planMonthlyAdviceImport(rows);
    expect(plan.records).toEqual([]);
    expect(plan.skippedRowCount).toBe(1);
  });

  it("生成日時が読めなければ月初にフォールバックする", () => {
    const rows = [MONTHLY_ADVICE_HEADER, ["2026年07月", "順調", "総評", "", "", "", "2026-07-01"]];
    const plan = planMonthlyAdviceImport(rows);
    expect(plan.records[0].createdAt).toBe("2026-06-30T15:00:00.000Z");
  });
});

describe("planSettingsImport", () => {
  it("ID列のキーで項目を特定し、型に沿って値を復元する", () => {
    const rows = [
      SETTINGS_HEADER,
      ["目標体重(kg)", "64", "goalWeightKg"],
      ["目標日", "2026年10月31日", "goalDate"],
      ["性別", "male", "sex"],
      ["日記本文をAIに送る", "はい", "sendDiaryTextToAi"],
    ];

    const plan = planSettingsImport(rows);

    expect(plan.records).toEqual([
      { key: "goalWeightKg", value: 64 },
      { key: "goalDate", value: "2026-10-31" },
      { key: "sex", value: "male" },
      { key: "sendDiaryTextToAi", value: true },
    ]);
    // ID列は書き出し時に必ずキーが入るため採番は発生しない
    expect(plan.idBackfills).toEqual([]);
    expect(plan.skippedRowCount).toBe(0);
  });

  it("「いいえ」はfalseとして復元する(未設定と区別する)", () => {
    const rows = [SETTINGS_HEADER, ["日記本文をAIに送る", "いいえ", "sendDiaryTextToAi"]];
    expect(planSettingsImport(rows).records).toEqual([{ key: "sendDiaryTextToAi", value: false }]);
  });

  it("未知のキー・空値の行はスキップする", () => {
    const rows = [
      SETTINGS_HEADER,
      ["知らない項目", "1", "unknownKey"],
      ["目標体重(kg)", "", "goalWeightKg"],
    ];
    const plan = planSettingsImport(rows);
    expect(plan.records).toEqual([]);
    expect(plan.skippedRowCount).toBe(2);
  });

  it("apiToken・lastSyncedAtは対象外なので取り込まない", () => {
    // シートに書かれていても復元しない(認証情報・端末ごとの同期状態のため)
    const rows = [
      SETTINGS_HEADER,
      ["APIトークン", "secret-value", "apiToken"],
      ["最終同期日時", "2026年08月08日 10:00", "lastSyncedAt"],
    ];
    const plan = planSettingsImport(rows);
    expect(plan.records).toEqual([]);
    expect(SETTINGS_FIELDS.map((f) => f.key)).not.toContain("apiToken");
    expect(SETTINGS_FIELDS.map((f) => f.key)).not.toContain("lastSyncedAt");
  });

  it("同じキーの2行目以降は重複としてスキップする", () => {
    const rows = [
      SETTINGS_HEADER,
      ["目標体重(kg)", "64", "goalWeightKg"],
      ["目標体重(kg)", "70", "goalWeightKg"],
    ];
    const plan = planSettingsImport(rows);
    expect(plan.records).toEqual([{ key: "goalWeightKg", value: 64 }]);
    expect(plan.skippedRowCount).toBe(1);
  });
});

describe("planSettingsImport: text型の候補検証(Issue #164)", () => {
  it("性別に候補外の値が手書きされていたらスキップする", () => {
    // シートは人が編集できる写し。「男性」等に直されるとSettings.sexのunion型に
    // 任意文字列が入り、BMR計算の sex === "male" 比較が黙って女性側の式になる
    const rows = [
      SETTINGS_HEADER,
      ["性別", "男性", "sex"],
      ["性別", "female", "sex"],
    ];
    const plan = planSettingsImport(rows);
    expect(plan.records).toEqual([{ key: "sex", value: "female" }]);
    expect(plan.skippedRowCount).toBe(1);
  });
});
