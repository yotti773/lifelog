import { describe, expect, it } from "vitest";
import { createAutoSyncRunner } from "../autoSync";
import type { SyncOutcome } from "../syncEngine";

/** run・時計を注入してrunnerを組み立てるテストヘルパー */
function setup(outcomes: SyncOutcome[] | SyncOutcome = { status: "success", syncedCount: 1 }) {
  let currentTime = 0;
  let runCount = 0;
  const queue = Array.isArray(outcomes) ? [...outcomes] : null;
  const fixed = Array.isArray(outcomes) ? null : outcomes;
  const runner = createAutoSyncRunner({
    run: async () => {
      runCount++;
      return queue ? queue.shift()! : fixed!;
    },
    minIntervalMs: 1000,
    now: () => currentTime,
  });
  return {
    runner,
    advance: (ms: number) => {
      currentTime += ms;
    },
    getRunCount: () => runCount,
  };
}

describe("createAutoSyncRunner", () => {
  it("最小間隔内の再トリガーは実行しない(タブ切り替えの連続発火の抑止)", async () => {
    const { runner, advance, getRunCount } = setup();

    expect(await runner.trigger()).toEqual({ status: "success", syncedCount: 1 });
    expect(await runner.trigger()).toBeNull();
    advance(999);
    expect(await runner.trigger()).toBeNull();
    expect(getRunCount()).toBe(1);

    advance(1); // ちょうど最小間隔が経過
    expect(await runner.trigger()).not.toBeNull();
    expect(getRunCount()).toBe(2);
  });

  it("bypassInterval(オンライン復帰)は最小間隔を待たずに実行する", async () => {
    const { runner, getRunCount } = setup();

    await runner.trigger();
    expect(await runner.trigger({ bypassInterval: true })).not.toBeNull();
    expect(getRunCount()).toBe(2);
  });

  it("オフラインでスキップした試行は間隔に数えない(復帰直後のトリガーを抑止しない)", async () => {
    const { runner, getRunCount } = setup([
      { status: "skipped-offline" },
      { status: "success", syncedCount: 1 },
    ]);

    expect(await runner.trigger()).toEqual({ status: "skipped-offline" });
    // 時間を進めなくても次のトリガーは実行される
    expect(await runner.trigger()).toEqual({ status: "success", syncedCount: 1 });
    expect(getRunCount()).toBe(2);
  });

  it("エラーになった試行は間隔に数える(失敗直後の連打でWorkerを叩き続けない)", async () => {
    const { runner, getRunCount } = setup({ status: "error", message: "boom" });

    expect(await runner.trigger()).toEqual({ status: "error", message: "boom" });
    expect(await runner.trigger()).toBeNull();
    expect(getRunCount()).toBe(1);
  });

  it("実行中の再トリガーは実行しない(再入抑止)", async () => {
    let release: (outcome: SyncOutcome) => void = () => {};
    const runner = createAutoSyncRunner({
      run: () => new Promise<SyncOutcome>((resolve) => (release = resolve)),
      minIntervalMs: 1000,
      now: () => 0,
    });

    const first = runner.trigger();
    expect(await runner.trigger({ bypassInterval: true })).toBeNull();
    release({ status: "success", syncedCount: 1 });
    expect(await first).toEqual({ status: "success", syncedCount: 1 });
  });
});
