// DexieはブラウザのIndexedDBを前提にしているため、Node上のテストではfake-indexeddbで
// globalThis.indexedDBをポリフィルする。db.tsがDexieインスタンスを生成する前に読み込む必要がある。
import "fake-indexeddb/auto";
