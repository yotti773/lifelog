# Zenn記事2(下書き)

Zenn公開時は以下のfrontmatterを先頭に付ける(`published: false` のままデプロイして最終確認後にtrueへ)。スラッグ案: `dexie-uselivequery-local-first`

```yaml
---
title: "ローカルファーストPWA実践 — Dexie + useLiveQuery の設計と罠"
emoji: "📱"
type: "tech"
topics: ["react", "pwa", "indexeddb", "dexie", "typescript"]
published: false
---
```

タイトル別案(差し替え自由):

- A(採用中): ローカルファーストPWA実践 — Dexie + useLiveQuery の設計と罠
- B: サーバーを持たない健康管理アプリ — IndexedDB主体で3ヶ月運用して踏んだ罠
- C: useLiveQueryの「永久ローディング」に気づいていますか — Dexieで作るローカルファーストPWA

---

## はじめに

減量目標のために、体重・食事・水分・筋トレ・日記を記録するPWA「からだログ」を個人開発しています。構成はReact + Vite + TypeScript + MUIで、データはすべて端末内のIndexedDBに保存するローカルファースト設計です。サーバーサイドのDBはありません。

この記事では、IndexedDBラッパーの[Dexie](https://dexie.org/)と、そのReactバインディングである`useLiveQuery`を使った設計の実際を、実運用で踏んだ罠も含めて紹介します。コードはすべて公開リポジトリにあります: https://github.com/yotti773/lifelog

## なぜローカルファーストか

個人開発で一番怖いのは維持コストです。月々のサーバー代、DBの面倒、飽きたときに残る運用負債。そこで:

- データは**端末のIndexedDBが主**。オフラインでも記録でき、サーバー費用ゼロ
- バックアップはGoogleスプレッドシートへの一方向同期(これは別記事で書きます)
- サーバーレス関数(Cloudflare Workers)はAPIキーを隠す中継にだけ使う

健康記録アプリは「風呂上がりに体重計に乗って10秒で記録する」道具なので、ネットワーク待ちが無いことはUXに直結します。ローカルファーストは思想である以前に、この用途では実利です。

## Dexieのスキーマ設計 — 主キーの選択がロジックを消す

Dexieのスキーマ定義は1ファイルに集約しています。ポイントは**エンティティごとに主キーを使い分けている**ことです。

```typescript
db.version(1).stores({
  weightRecords: "date, timestamp",   // 日付(YYYY-MM-DD)が主キー
  mealRecords: "id, mealType, timestamp",  // 生成したUUIDが主キー
  settings: "id",
});
```

**体重は`date`を主キー**にしています。体重は「1日1件、記録し直したら上書き(後勝ち)」が仕様ですが、日付を主キーにすると`put()`を呼ぶだけでこれが成立します。「同じ日付の既存レコードを検索して、あれば更新、なければ挿入」という手続きロジックがゼロ行になります。

```typescript
export async function saveWeightRecord(input: SaveWeightRecordInput): Promise<WeightRecord> {
  const record: WeightRecord = {
    id: input.date,
    date: input.date,
    // ...
    synced: false,
  };
  await db.weightRecords.put(record); // 同じdateなら自動的に上書き
  return record;
}
```

一方、**食事はUUIDを主キー**にしています。同じ日の「間食」を2回記録することがあるため、1日1件の制約を掛けてはいけないからです。この非対称は型定義だけ見ても意図が読めないので、スキーマのコメントとCLAUDE.md(AI向けの案内ファイル)に理由ごと書いてあります。

同じパターンはその後の拡張でも繰り返し使っています。日記=日付キー(1日1件)、AIコメントのキャッシュ=週開始日キー(1週1件、再生成で上書き)、習慣記録=`${date}_${habitId}`の複合文字列キー(1日1習慣1件)。**「後勝ちにしたい単位」をそのまま主キーにする**のが、Dexieで一番効いた設計判断です。

## booleanはインデックスにできない — synced フラグの扱い

全レコードが`synced: boolean`を持ち、内容が変わるたびに`false`へ戻します。同期エンジンはこれを見て未送信分を拾います。

ここに一つIndexedDBの制約があります。**IndexedDBはbooleanをインデックスのキーにできません**。なので未同期レコードの絞り込みはインデックスではなくJS側のフィルタです。

```typescript
export async function getUnsyncedWeightRecords(): Promise<WeightRecord[]> {
  return db.weightRecords.filter((record) => !record.synced).toArray();
}
```

全件走査ですが、単一ユーザー・1日数件の規模では全く問題になりません。どうしてもインデックス化したければ`synced: 0 | 1`のような数値にする手はありますが、規模に対して過剰です。むしろ後から来た人(またはAI)が「非効率だ」と最適化したがる箇所なので、リポジトリには「これをインデックス化しないこと」と理由付きで明記してあります。

## useLiveQuery — 手動再取得を全廃する

画面の状態管理は`dexie-react-hooks`の`useLiveQuery`に全部任せています。

```typescript
const settings = useLiveQuery(() => getSettings(), []);
```

IndexedDBのテーブルが変化すると、そのテーブルを読んでいるコンポーネントが自動で再レンダリングされます。「保存したら一覧を再取得する」という配線コードが存在せず、記録ページで保存 → ホームの今日のサマリーも推移グラフも勝手に更新されます。ローカルファーストと`useLiveQuery`の組み合わせは、実質「IndexedDBがそのままアプリの状態ストア」になる感覚です。

## 罠: 「ロード中」と「見つからなかった」が区別できない

この構成で一番大きな罠がこれです。`useLiveQuery`は結果が出るまで`undefined`を返しますが、**クエリが`undefined`に解決した場合も同じ`undefined`**です。

空のテーブルに対する`.first()`/`.last()`は`undefined`に解決します。つまり:

```typescript
// ダメな例: 新規ユーザー(記録0件)で永久ローディングになる
const firstRecord = useLiveQuery(() => db.weightRecords.orderBy("date").first(), []);
if (firstRecord === undefined) return <Loading />; // 永遠にここから抜けない
```

記録が1件も無い新規ユーザーでは、クエリは「完了して`undefined`だった」のに、画面は「まだロード中」と解釈し続けます。開発中は自分のデータが常に入っているので気づかず、**新規ユーザーの初回起動だけで発生**する質の悪いバグになります。

対処はシンプルで、クエリ関数の中で`null`に正規化することです。

```typescript
// 「未解決」= undefined、「無かった」= null に分離する
const firstWeightRecord = useLiveQuery(
  () => db.weightRecords.orderBy("date").first().then((v) => v ?? null),
  [],
);
```

これで`undefined`だけを「まだロードされていない」として扱えます。このパターンは「見つからない」に正当に解決しうるすべての`useLiveQuery`呼び出しに適用する、というのをリポジトリの規約にしています。

## グラフの空白は空白のまま見せる

もう一つ、データ層の小さなこだわりです。カロリー推移グラフ用の集計関数`getDailyCalorieTotals(startDate, endDate)`は、食事記録が無い日も範囲内の全日を0kcalで埋めて返します。

記録がある日だけを返すと、グラフのX軸が「記録した日」だけで詰まり、サボった期間が圧縮されて見えなくなります。記録の空白は減量アプリにとって重要な情報なので、**欠測を隠さず隙間として描画する**ために、データ層の段階で全日を埋めています(体重グラフのように「欠測日は点を打たない」表現とはまた別の判断で、指標ごとに使い分けています)。

## テスト: fake-indexeddbでデータ層を丸ごとNodeで回す

IndexedDBはブラウザAPIですが、[fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB)を使うとNode上のvitestでデータ層全体をテストできます。

```typescript
// vitest.config.ts の setupFiles で読み込む
import "fake-indexeddb/auto";
```

これでDexieが本物のIndexedDBと同じAPIで動くので、「dateを主キーにした後勝ち」「syncedフラグのリセット」のようなモデリング上の約束事を、ブラウザ無しの高速なテストで固定できます。各テストファイルは`beforeEach`で自分の使うテーブルを`db.weightRecords.clear()`のように直接クリアするだけの、素朴な運用です。

## まとめ

- 「後勝ちにしたい単位」を主キーにすると、上書きロジックが`put()`1行に消える
- IndexedDBはbooleanをインデックスにできない。小規模なら`.filter()`で十分 — そして「あえてそうしている」ことを明記しておく
- `useLiveQuery`は「ロード中」と「undefinedに解決」を区別できない。`?? null`への正規化を規約にする
- 欠測をデータ層で隠さない。0埋めや隙間表示など、指標に合った見せ方を選ぶ
- fake-indexeddbでデータ層のテストはNodeで完結する

シートへのバックアップ同期(upsert・削除トゥームストーン)は別記事で書きます。開発プロセス側の話はこちら: [Claude Codeに実装を丸投げしたら、個人開発のボトルネックが「書く」から「決める」に変わった話](https://zenn.dev/yotti073/articles/spec-driven-claude-code)

---

## 執筆メモ(公開前に消す)

- コード引用は公開時点の実物(`src/db/db.ts`・`src/db/weightRecords.ts`・`src/pages/trends/TrendsPage.tsx`)と一致しているか最終確認する
- スクショ候補: ホーム画面(記録→即反映が伝わる2枚組)。無くても成立する構成にしてある
- zenn03(同期エンジン)公開後に相互リンクを追記する
- タイトル別案A/B/Cは投稿時に決定し、他は削除する
