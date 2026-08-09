import { describe, expect, it, vi } from "vitest";
import { resetAppShell } from "@/lib/appReset";

function fakeRegistration(unregisterResult = true) {
  return { unregister: vi.fn(async () => unregisterResult) } as unknown as ServiceWorkerRegistration;
}

describe("resetAppShell", () => {
  it("Service Workerを全て登録解除し、Cache Storageを全て削除する", async () => {
    const registrations = [fakeRegistration(), fakeRegistration()];
    const cacheDelete = vi.fn(async () => true);

    const result = await resetAppShell({
      serviceWorker: { getRegistrations: vi.fn(async () => registrations) },
      cacheStorage: { keys: vi.fn(async () => ["workbox-precache", "assets"]), delete: cacheDelete },
    });

    expect(result).toEqual({ unregisteredCount: 2, deletedCacheCount: 2 });
    for (const registration of registrations) {
      expect(registration.unregister).toHaveBeenCalled();
    }
    expect(cacheDelete).toHaveBeenCalledWith("workbox-precache");
    expect(cacheDelete).toHaveBeenCalledWith("assets");
  });

  it("Service Worker・Cache Storage非対応の環境でも失敗しない", async () => {
    await expect(resetAppShell({ serviceWorker: undefined, cacheStorage: undefined })).resolves.toEqual({
      unregisteredCount: 0,
      deletedCacheCount: 0,
    });
  });

  it("片方が失敗しても、もう片方は最後まで実行する(壊れた状態からの復旧手段のため)", async () => {
    const cacheDelete = vi.fn(async () => true);

    await expect(
      resetAppShell({
        serviceWorker: {
          getRegistrations: vi.fn(async () => {
            throw new Error("SWが壊れています");
          }),
        },
        cacheStorage: { keys: vi.fn(async () => ["precache"]), delete: cacheDelete },
      }),
    ).rejects.toThrow();

    // 失敗を伝えつつ、キャッシュ削除は最後まで実行されている
    expect(cacheDelete).toHaveBeenCalledWith("precache");
  });

  it("1つでも失敗したらthrowする(黙って成功扱いにするとリロードで直ったと誤解される)", async () => {
    await expect(
      resetAppShell({
        serviceWorker: {
          getRegistrations: vi.fn(async () => {
            throw new Error("SWが壊れています");
          }),
        },
        cacheStorage: { keys: vi.fn(async () => ["precache"]), delete: vi.fn(async () => true) },
      }),
    ).rejects.toThrow("Service Workerの登録解除");

    await expect(
      resetAppShell({
        serviceWorker: { getRegistrations: vi.fn(async () => []) },
        cacheStorage: {
          keys: vi.fn(async () => {
            throw new Error("Cacheが壊れています");
          }),
          delete: vi.fn(async () => false),
        },
      }),
    ).rejects.toThrow("キャッシュの削除");
  });

  it("登録が無ければ0件として正常終了する(未インストールのブラウザ利用)", async () => {
    await expect(
      resetAppShell({
        serviceWorker: { getRegistrations: vi.fn(async () => []) },
        cacheStorage: { keys: vi.fn(async () => []), delete: vi.fn(async () => false) },
      }),
    ).resolves.toEqual({ unregisteredCount: 0, deletedCacheCount: 0 });
  });
});
