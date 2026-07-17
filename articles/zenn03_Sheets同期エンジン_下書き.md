# Zenn記事3(下書き)

Zenn公開時は以下のfrontmatterを先頭に付ける(`published: false` のままデプロイして最終確認後にtrueへ)。スラッグ案: `google-sheets-personal-db-sync`

```yaml
---
title: "Google Sheets を個人用DBにする — upsert・削除トゥームストーンの同期エンジン"
emoji: "🔄"
type: "tech"
topics: ["googlesheets", "cloudflareworkers", "typescript", "pwa", "個人開発"]
published: false
---
```

タイトル別案(差し替え自由):

- A(採用中): Google Sheets を個人用DBにする — upsert・削除トゥームストーンの同期エンジン
- B: クラウドDBを持たない同期設計 — IndexedDB→スプレッドシートの一方向同期で困らない理由
- C: 「追記だけ」の同期は必ず破綻する — 編集と削除をスプレッドシートに反映する設計

---

## はじめに

ローカルファーストPWA「からだログ」では、端末内のIndexedDBを主のデータストアにし、バックアップと閲覧用にGoogleスプレッドシートへ同期しています。クラウドDBはありません。

「スプレッドシートをDB代わりにする」はよくあるネタですが、雑にやると必ず壊れるポイントが2つあります。**編集すると行が重複する**ことと、**削除がシートに残り続ける**ことです。この記事では、この2つを upsert と削除トゥームストーンで解決した同期エンジンの設計を紹介します。コードは公開しています: https://github.com/yotti773/lifelog

## 全体構成

```
[PWA (IndexedDB)] --POST /api/sync-sheets--> [Cloudflare Worker] --Sheets API--> [スプレッドシート]
```

- 同期は**アプリ→シートの一方向push**が基本。シート→アプリは手動の取り込み(後述)だけ
- クライアントはGoogleの認証情報を持たない。Workerがサービスアカウントで署名する
- シートは1レコード=1行。人間がそのまま読める形式なので、アプリが死んでもデータは残る

なぜGoogleスプレッドシートか。バックアップ先として無料で、可用性をGoogleが担保してくれて、**閲覧・集計ツールとしてそのまま使える**からです。「バックアップはあるが読めない」状態にならないのが、個人の健康データ置き場として一番効きます。

## 同期エンジン本体はトランスポート非依存

クライアント側の`runSync()`は「未同期レコードを集めて、transportに渡して、成功した分だけ同期済みにする」だけの関数で、通信先を知りません。

```typescript
const result = await transport.push({
  weightRecords: unsyncedWeightRecords,
  mealRecords: unsyncedMealRecords,
  // ...
  deletedWeightIds,
  deletedMealIds,
  // ...
});

// transportが成功を報告したレコードだけを synced: true にする
await markWeightRecordsSynced(result.syncedWeightDates);
```

設計上のポイントは3つ:

1. **全レコードが`synced: boolean`を持ち、内容が変わるたびに`false`へ戻る。** 同期後に編集されたレコードも、次の同期で自動的に再送対象になる
2. **部分的な成功は想定内。** Workerは「実際に書けた分」のIDだけを返し、クライアントはその分だけフラグを立てる。失敗分は未同期のまま残る
3. **リトライキューは無い。** エラー時は何も同期済みにせず、次のトリガー(起動時・アプリ復帰時・オンライン復帰時・手動ボタン)がそのままリトライになる。「未同期フラグ+定期的なトリガー」だけで、リトライ機構は別途持たない

## 問題1: 編集 → ID列をキーにupsert

追記(`values.append`)だけの同期は、同期済みレコードを編集した瞬間に破綻します。`synced: false`に戻った編集済みレコードが再送され、シートに**同じ記録の行が2本**できるからです。

そこで各タブにID列を設け、Worker側でupsertにしました。手順は:

1. 対象タブのID列を1回読み、`ID値 → 行番号のリスト`のマップを作る
2. 送られてきた各レコードを「既存行の上書き」と「新規追記」に振り分ける

```typescript
export function planUpserts(rows: RowWrite[], idToRows: Map<string, number[]>): UpsertPlan {
  const updates: { rowNumber: number; cells: (string | number)[] }[] = [];
  const appends: (string | number)[][] = [];
  for (const row of rows) {
    const existing = idToRows.get(row.id);
    if (existing && existing.length > 0) {
      updates.push({ rowNumber: existing[0], cells: row.cells });
    } else {
      appends.push(row.cells);
    }
  }
  return { updates, appends };
}
```

更新は`values:batchUpdate`でまとめて書き、追記は`values.append`。この振り分けを**純関数として切り出して単体テストを書いてある**のがポイントで、Sheets APIを一切モックせずに「同じIDが重複していたら最初の行を更新する」のような分岐を固定できます。

## 問題2: 削除 → トゥームストーン + 行の物理削除

ローカルでレコードを消しても、何もしなければシート側の行は永遠に残ります。「消したはずの記録がバックアップに生きている」のはバックアップとして嘘なので、削除も同期対象にします。

削除時にレコード本体は消しつつ、**トゥームストーン(墓標)**を専用テーブルに残します。

```typescript
export async function deleteWeightRecord(date: string): Promise<void> {
  await db.weightRecords.delete(date);
  await enqueueDeletion("weight", date); // どのタブの・どのIDを消すか、だけを残す
}
```

次回同期で、Workerがトゥームストーンに対応する行を探して`deleteDimension`(行の物理削除)を実行し、確定した分だけクライアントがトゥームストーンを消します。

ここに罠が2つあります。

**罠1: 行削除は必ず下から。** 複数行を削除するとき、上の行から消すと下の行番号がずれます。削除対象の行番号は降順ソートしてから消します。

```typescript
export function planRowDeletions(ids: string[], idToRows: Map<string, number[]>): number[] {
  const rowNumbers = new Set<number>();
  for (const id of ids) {
    for (const rowNumber of idToRows.get(id) ?? []) {
      rowNumbers.add(rowNumber);
    }
  }
  return [...rowNumbers].sort((a, b) => b - a); // 下の行から先に削除する
}
```

**罠2: 削除→再登録の競合。** 体重は日付が主キーなので、「7/10の記録を削除 → 同じ7/10に登録し直す」があり得ます。このとき削除トゥームストーンが残っていると、次の同期で「新しい行をupsert」と「同じIDの行を削除」が同時に走って事故になります。なので保存時に、同じキーの保留中トゥームストーンを取り消します(`cancelDeletion`)。シート側から見ると、削除+再登録は単なる「更新」になります。

## Workerの認証: ライブラリ無しのJWT Bearerフロー

Cloudflare WorkersからSheets APIを叩くための認証は、googleapis系のnpmパッケージを使わず、Web Crypto APIで直接やっています。サービスアカウントの秘密鍵でJWTを署名し、OAuth2のJWT Bearerフローでアクセストークンを取得するだけです。

```typescript
const key = await crypto.subtle.importKey(
  "pkcs8",
  pemToPkcs8ArrayBuffer(privateKeyPem),
  { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  false,
  ["sign"],
);
const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
```

Workers環境はNodeのcryptoが無い(または互換レイヤに頼ることになる)ので、最初から`crypto.subtle`で書くのが一番素直です。ハマりどころは秘密鍵のPEMで、Cloudflareのシークレットに1行で貼ると改行がリテラルな`\n`として保存されることがあるため、`\\n → 改行`の正規化を入れています。地味ですがこれが無いと本番だけ署名に失敗します。

## 逆方向(シート→アプリ)は「追加のみ・ローカル優先」

機種変更や新しい端末への復元用に、シートからの取り込みも作りました。ただし双方向同期にはしていません。**取り込みは追加のみで、既存キーはスキップ(ローカル優先)**です。

双方向同期は競合解決という難問を持ち込みます。個人用途では「主はアプリ、シートは写し」と役割を固定してしまえば、競合はそもそも発生しません。例外はGarmin連携が書き込む活動記録タブだけで、これはシート側が真実の情報源なので常にシートで上書き、と**タブごとに真実の情報源を1つに決める**のが競合を殺す設計です。

取り込みで一つ重要なのが、手入力の過去データなどID列が空の行の扱いです。Workerが取り込み時にIDを採番し、**シートに書き戻します**。書き戻せないと、以後のupsert・行削除がその行を見つけられず重複行を生むため、書き戻し失敗は取り込み全体の失敗として扱います。

## 既存シートに合わせなかった話

実はこのアプリを作る前から、手動運用のスプレッドシートがありました。当初はそこへ同期するつもりでしたが、やめて新規シートを作りました。

既存シートは「1日1行、その日の合計カロリー」という**集計形式**で、アプリの「1食事=1レコード」とは粒度が違います。合わせるには「日付で行を検索→既存値と合算→上書き」という集計ロジックが必要で、「1レコード=1行、IDでupsert・削除」というシンプルな設計と両立しません。**同期先のスキーマはアプリのデータモデルに合わせて新規に切る**。ここで妥協しなかったことが、上記の全設計を成立させています。

## まとめ

- スプレッドシート同期は「追記のみ」だと編集の重複と削除の残留で必ず破綻する。ID列を設けてupsert、削除はトゥームストーンで
- 行の物理削除は降順で。削除→再登録はトゥームストーンの取り消しでカバー
- リトライは「未同期フラグ+次回トリガー」で十分。キューは要らない
- 双方向同期はしない。タブごとに真実の情報源を1つ決めれば競合は消える
- upsert・行削除の計画部分を純関数に切り出すと、Sheets APIをモックせずにテストできる

データ層(Dexie)側の設計は別記事: ローカルファーストPWA実践(公開後にリンク)。開発プロセスの話はこちら: [Claude Codeに実装を丸投げしたら、個人開発のボトルネックが「書く」から「決める」に変わった話](https://zenn.dev/yotti073/articles/spec-driven-claude-code)

---

## 執筆メモ(公開前に消す)

- コード引用は公開時点の実物(`src/sync/syncEngine.ts`・`src/db/syncDeletions.ts`・`worker/sheetsSync.ts`・`worker/googleSheetsAuth.ts`)と一致しているか最終確認する
- スクショ候補: 同期先スプレッドシートの体重記録タブ(シートIDが写らないようURL・タイトルバーはマスク。公開ラインの固定ルール)
- zenn02(データ層)公開後に本文中の「別記事」へ実リンクを入れる
- 共有トークン認証(Issue #87)の話は入れなかった(記事の焦点がぼける)。反響次第で「WorkerのAPIを最小コストで守る」小ネタとして別記事化を検討
- タイトル別案A/B/Cは投稿時に決定し、他は削除する
