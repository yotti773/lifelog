/**
 * Service Worker・キャッシュの作り直し(Issue #203)。
 *
 * 2026-08-09、インストール済みPWAのService Workerが壊れて /api/* への通信が全て
 * "Failed to fetch" になる事象が起きた。当時アプリ側にSWを扱うコードが無く、復旧手段が
 * 「PWAの再インストール」しかなかった — Android Chromeではアンインストールでサイトの
 * ストレージごと消えることがあり、記録が全てIndexedDBにある本アプリでは危険な操作になる。
 *
 * **IndexedDBには一切触れない。** SW登録とCache Storageだけを捨てて取り直すことで、
 * 記録を保ったまま同じ復旧を行えるようにするのがこの関数の目的。
 */

export interface AppResetResult {
  /** 登録解除したService Workerの数 */
  unregisteredCount: number;
  /** 削除したCache Storageの数 */
  deletedCacheCount: number;
}

export interface AppResetDeps {
  /** 省略時は navigator.serviceWorker。未対応ブラウザ・テストではundefinedを渡す */
  serviceWorker?: Pick<ServiceWorkerContainer, "getRegistrations"> | undefined;
  /** 省略時は globalThis.caches。未対応ブラウザ・テストではundefinedを渡す */
  cacheStorage?: Pick<CacheStorage, "keys" | "delete"> | undefined;
}

function defaultDeps(): AppResetDeps {
  return {
    serviceWorker: typeof navigator !== "undefined" ? navigator.serviceWorker : undefined,
    cacheStorage: typeof globalThis !== "undefined" ? globalThis.caches : undefined,
  };
}

/**
 * SWの登録解除とCache Storageの削除を行う。呼び出し元はこの後にリロードして、
 * まっさらな状態でSWを登録し直させること(この関数自体はリロードしない — テスト可能にするため)。
 *
 * 片方が失敗しても、もう片方は最後まで実行する(一部でも捨てられたほうが復旧の見込みが上がる)。
 * ただし**1つでも失敗したらthrowする** — 呼び出し元は成功時にリロードするため、
 * 黙って成功扱いにすると「リセットしたのに直っていない」状態をユーザーが正常だと思ってしまう。
 * 未対応ブラウザ(APIが無い)は失敗ではなく、何もせず成功として扱う。
 */
export async function resetAppShell(deps: AppResetDeps = defaultDeps()): Promise<AppResetResult> {
  const { serviceWorker, cacheStorage } = deps;

  let unregisteredCount = 0;
  let deletedCacheCount = 0;
  const failedSteps: string[] = [];

  if (serviceWorker) {
    try {
      const registrations = await serviceWorker.getRegistrations();
      const results = await Promise.all(registrations.map((registration) => registration.unregister()));
      unregisteredCount = results.filter(Boolean).length;
    } catch {
      failedSteps.push("Service Workerの登録解除");
    }
  }

  if (cacheStorage) {
    try {
      const keys = await cacheStorage.keys();
      const results = await Promise.all(keys.map((key) => cacheStorage.delete(key)));
      deletedCacheCount = results.filter(Boolean).length;
    } catch {
      failedSteps.push("キャッシュの削除");
    }
  }

  if (failedSteps.length > 0) {
    throw new Error(`アプリのリセットに失敗しました(${failedSteps.join("・")})`);
  }

  return { unregisteredCount, deletedCacheCount };
}
