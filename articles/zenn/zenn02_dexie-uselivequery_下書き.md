# Zenn記事2(下書き)

**状態: 公開稿を `zenn-content` のmainに反映済み**(`articles/dexie-uselivequery-pitfalls.md`、`published: false`、2026-07-22)。Zennのプレビュー確認と公開トグル操作はZenn側のweb画面で実施する運用。以下はその元原稿。

X投稿用の❌/✅コード対比画像は `zenn02_X画像_before-after.png`(本記事の核である永久ローディングの罠と`null`正規化の対処を並べた、`X投稿テンプレート.md` タイプBの添付画像)。

公開用の正本は別リポジトリ `yotti773/zenn-content` の `articles/<slug>.md` に置く。スラッグは `dexie-uselivequery-pitfalls`。frontmatterは以下(`published: false` のまま反映済み)。

```yaml
---
title: "Dexie + useLiveQuery でローカルファーストPWA — 新規ユーザーが「永久ローディング」になる罠と対処"
emoji: "🗂️"
type: "tech"
topics: ["dexie", "indexeddb", "react", "pwa", "typescript"]
published: false
---
```

タイトル別案(はてブ・検索想定・差し替え自由):

- A(採用中): Dexie + useLiveQuery でローカルファーストPWA — 新規ユーザーが「永久ローディング」になる罠と対処
- B: useLiveQuery が undefined から抜けない — Dexieの `.first()`/`.last()` で踏む罠と対処
- C: IndexedDBをDexieで実践する3つの設計判断と、useLiveQueryの罠

---

## はじめに

減量目標(10月末までに-8kg)のために、体重・食事・水分・筋トレ・日記を記録して週次レビュー+AIコーチングで振り返る、ローカルファーストなPWA「からだログ」を個人開発しています。サーバーにDBを持たず、データはスマホのブラウザ内(IndexedDB)に保存し、バックアップとしてGoogleスプレッドシートへ同期する構成です。

この「サーバーレスDB」の中心にいるのが [Dexie](https://dexie.org/)(IndexedDBのラッパー)と、その React 用フック [`dexie-react-hooks`](https://dexie.org/docs/dexie-react-hooks/useLiveQuery()) の `useLiveQuery` です。この組み合わせは非常に快適なのですが、**素直に書くと新規ユーザーだけが「永久ローディング」に陥る**という、気づきにくい罠があります。この記事では、実際にハマった罠と対処、そして選んだ設計判断を、実コードで紹介します。

対象は「ローカルファーストなWebアプリをDexieで作ってみたい/作っている」人です。

## なぜ Dexie + useLiveQuery なのか

ローカルファーストにすると、状態管理の考え方が変わります。サーバーAPIを叩いて `useState` に詰めて…という往復が消え、**「IndexedDBが唯一の状態、UIはその射影」** になります。

`useLiveQuery` はこれをそのまま実現してくれます。クエリ関数を渡すと、その結果を返し、**クエリが触れているテーブルが変化するたびに自動で再実行して再レンダリング**します。Reduxのストアも、手動の再取得(refetch)も要りません。

```tsx
import { useLiveQuery } from "dexie-react-hooks";
import { getSettings } from "@/db/settings";

const settings = useLiveQuery(() => getSettings(), []);
```

`db.weightRecords.put(...)` でどこかのコンポーネントがデータを保存すれば、`weightRecords` を読んでいる画面はすべて勝手に更新される。この気持ちよさがローカルファーストの魅力です。

ちなみにスキーマ定義はこうです(Dexie v4 + TypeScript の `EntityTable`)。

```ts
export const db = new Dexie("lifelog") as Dexie & {
  weightRecords: EntityTable<WeightRecord, "date">;
  mealRecords: EntityTable<MealRecord, "id">;
  // ...
};

// weightRecords: dateを主キーにすることで、同じ日付のput()が自動的に上書き(後勝ち)になる
db.version(1).stores({
  weightRecords: "date, timestamp",
  mealRecords: "id, mealType, timestamp",
  settings: "id",
});
```

`stores()` の文字列で先頭が主キー、以降がインデックスです。この「主キーに何を選ぶか」が後半の設計判断につながります。

## 罠①: `useLiveQuery` は「ロード中」と「undefinedに解決した」を区別できない

これが本命の罠です。まず、`useLiveQuery` の戻り値は**最初のレンダリングでは必ず `undefined`** です(まだクエリが解決していないから)。なので、ローディング表示はこう書くのが定石です。

```tsx
const records = useLiveQuery(() => getAllWeightRecords(), []);
if (records === undefined) return <Spinner />; // まだロード中
```

配列を返すクエリならこれで問題ありません。空テーブルでも `[]`(空配列)に解決するので、`undefined` から必ず抜けます。

問題は **`.first()` / `.last()` / `.get()` のように「見つからなければ `undefined` に解決する」クエリ**です。たとえば「一番古い体重記録」を取る、よくあるコード。

```tsx
// ❌ 記録が1件も無い新規ユーザーで、永久にローディングから抜けない
const firstWeightRecord = useLiveQuery(
  () => db.weightRecords.orderBy("date").first(),
  [],
);

if (firstWeightRecord === undefined) return <Spinner />;
```

既存ユーザー(記録あり)では動きます。しかし**記録が1件も無い新規ユーザー**では、`.first()` が正当に `undefined` に解決します。ところが `useLiveQuery` は「まだ解決していない `undefined`」と「`undefined` に解決した」を**同じ `undefined` でしか表現できない**ため、コンポーネントは区別できません。クエリは正常に完了しているのに、`=== undefined` の分岐から永久に抜けられず、スピナーが回り続けます。

しかも厄介なのは、**開発中は自分のブラウザにデータが入っているので絶対に踏まない**ことです。バグは「インストール直後の、まだ何も記録していない新規ユーザー」という、開発者が最も再現しにくい状態でだけ顕在化します。

### 対処: 「見つからない」を `null` に正規化する

対処はシンプルで、**クエリ側で `undefined` を `null` に畳んでから返す**だけです。こうすると「まだロードされていない」= `undefined`、「解決したが空」= `null` と、2つの状態を型でも実行時でも区別できます。

```tsx
// ✅ .first()の結果をnullに正規化する。undefinedだけを「未解決」として扱う
const firstWeightRecord = useLiveQuery(
  () => db.weightRecords.orderBy("date").first().then((v) => v ?? null),
  [],
);

if (firstWeightRecord === undefined) return <Spinner />; // 未解決だけをローディング扱い
// ここに来れば firstWeightRecord は WeightRecord | null(nullは「記録なし」)
```

`getXxx()` のようなクエリ関数の内部でやってもいいですし、上のように呼び出し側で `.then((v) => v ?? null)` を付けても構いません。要は **`undefined` に解決しうるクエリを `useLiveQuery` に渡さない**、というルールにします。

からだログではこのパターンをコードベース全体の約束事にして、条件付きクエリでも `null` を明示的に返すようにしています。

```tsx
// 基準日に記録がなければ null を返す(Promise.resolve(null) を含めて undefined を作らない)
const baselineWeightRecord = useLiveQuery(
  () =>
    settings?.baselineDate
      ? getWeightRecord(settings.baselineDate).then((v) => v ?? null)
      : Promise.resolve(null),
  [settings?.baselineDate],
);
```

「未連携なら機能ごと非表示」のようなケースでも同じで、`null` を「データが無い」の正規表現として使い、`undefined` は「ロード中」だけに予約します。

```tsx
// 活動記録(Garmin由来)が1件も無ければ null でカードごと非表示にする
const activityDailyTotals = useLiveQuery(async () => {
  const firstActivityRecord = await db.activityRecords.orderBy("date").first();
  if (!firstActivityRecord) return null; // undefinedではなくnullを返すのがポイント
  // ... 集計して返す
}, [period]);
```

**まとめると:** `useLiveQuery` で `undefined` を「ロード中」の番兵に使うなら、クエリが `undefined` に解決する経路をすべて潰し、「データが無い」は `null` で表す。これだけで永久ローディングは防げます。

## 罠②: IndexedDB は boolean をインデックスのキーにできない

もうひとつ、Dexieというより IndexedDB 由来の制約です。からだログの各レコードは同期状態を表す `synced: boolean` を持っていて、「未同期のものだけ集める」クエリが必要です。素直に考えるとインデックスを張って `where("synced").equals(false)` としたくなりますが、**IndexedDB は boolean を有効なキーにできない**ため、これはできません(キーになれるのは number / string / Date / 配列などに限られます)。

そこで、インデックスに頼らず JS 側で `.filter()` しています。

```ts
export async function getUnsyncedWeightRecords(): Promise<WeightRecord[]> {
  return db.weightRecords.filter((record) => !record.synced).toArray();
}
```

「フルスキャンで遅いのでは?」と気になりますが、このアプリは単一ユーザーで1日あたり数件という規模なので、実測上まったく問題になりません。**インデックス化して「最適化」したくなる誘惑を、規模を理由に明示的に退ける**という判断です。もし boolean で大量データを絞りたいなら、`0`/`1` の number 列や、`syncedAt` のような別のインデックス可能な列に設計し直すことになります。

## 罠に付随する設計判断: 主キーに何を選ぶか

罠②で出た「後勝ちの上書き」は、実は**主キー設計**で自動的に解いています。ここはローカルファーストで地味に効くところなので触れておきます。

体重記録は **`date`(YYYY-MM-DD)を主キー**にしています。「1日1件・後勝ち(同じ日に測り直したら上書き)」という仕様を、追加の上書きロジックなしに主キーの性質だけで成立させるためです。

```ts
// 同じdateで保存した場合は上書きされる(後勝ち)
export async function saveWeightRecord(input: SaveWeightRecordInput): Promise<WeightRecord> {
  const record: WeightRecord = {
    id: input.date,
    date: input.date,
    // ...
    synced: false, // 内容が変わるので未同期に戻す
  };
  await db.weightRecords.put(record); // 同じ主キーなら put() が黙って上書きする
  return record;
}
```

`.put()` を呼ぶだけ。「その日の記録があるか探して、あれば更新、なければ作成」という分岐は一切要りません。日記・血圧・活動記録など「1日1件」が自然なものは全部この形にしています。

一方、食事記録は **UUID を主キー**にしています。同じ日の同じ区分(朝食など)に複数件を記録したい(間食を2回、など)ので、`date` を主キーにすると2件目が1件目を潰してしまうからです。

```ts
db.version(1).stores({
  weightRecords: "date, timestamp",     // 1日1件でよい → 日付を主キー
  mealRecords: "id, mealType, timestamp", // 1日に複数件 → UUIDを主キー、mealType/timestampはインデックス
});
```

**「1日1件で後勝ち」なら日付を主キーに、「1日に複数件」ならUUIDを主キーに** — この選択が、上書きロジックの有無をまるごと決めます。型だけ見ると分かりませんが、ローカルファーストでデータ整合を自前で守るときの、いちばん効くレバーの一つです。

## まとめ

Dexie + useLiveQuery でローカルファーストPWAを作るときに、実際に効いた勘所です。

- `useLiveQuery` は「ロード中」と「undefinedに解決」を区別できない。`.first()`/`.last()`/`.get()` を素直に渡すと**新規ユーザーだけ永久ローディング**になる。対処は **`undefined` を `null` に正規化**して、`undefined` を「未解決」専用の番兵にすること。
- IndexedDB は **boolean をインデックスできない**。小規模なら JS の `.filter()` で割り切ってよい。
- **主キー設計で「後勝ち」を無料で手に入れる**。1日1件なら日付、複数件ならUUID。

どれも派手ではありませんが、開発中の自分のブラウザでは踏まない=リリース後に新規ユーザーだけが踏む、という種類のバグを未然に潰せます。

このアプリのコード・仕様書は [GitHubで公開](https://github.com/yotti773/lifelog) しています。ローカルファースト設計やスプレッドシート同期エンジンの詳細は、続きの記事で書いていく予定です。

<!-- 公開前の執筆メモ(公開時に削除):
- 相互リンク: 前回のZenn記事(仕様書駆動)と、note初回記事へのリンクを「まとめ」か末尾に足すか検討
- 図: 罠①の「undefinedが2つの状態を兼ねる」図を1枚入れると理解が早い(任意)
- コードは 2026-07-22 時点の src/db/db.ts / weightRecords.ts / pages/trends/TrendsPage.tsx から引用
-->
