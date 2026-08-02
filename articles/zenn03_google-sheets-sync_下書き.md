# Zenn記事3(下書き)

Zenn公開時は以下のfrontmatterを先頭に付ける(`published: false` のままデプロイして最終確認後にtrueへ)。公開用の正本は別リポジトリ `yotti773/zenn-content` の `articles/cloudflare-workers-google-sheets-sync.md` に置く。

本文中の概念図は `zenn03_図1_upsert概念図.png`(「罠」節、upsertのビフォーアフター)。`zenn-content` 側は `images/cloudflare-workers-google-sheets-sync/upsert-diagram.png` に同じ画像を配置し、本文から `/images/cloudflare-workers-google-sheets-sync/upsert-diagram.png` で参照している。

X投稿用の画像は2枚ある(`X投稿テンプレート.md` タイプBの添付画像。投稿文の記入例も同ファイルにある)。

- **初回投稿用: `zenn03_X画像_upsert.png`** — 「個人開発のDB、スプレッドシートで十分だった/ただし追記だけで同期すると壊れる」を見出しに置き、追記オンリー ❌ とupsert ✅ を並べたもの。画像単体でフックが完結する形にしてある
- **再放流用: `zenn03_X画像_行削除順序.png`** — 「`deleteDimension`は降順で削除しないと行番号がズレて事故る」を行の視覚図で示したもの。公開1〜2週間後に切り口を変えてもう一度投稿するとき用

```yaml
---
title: "Google Sheets を個人用DBにする — Cloudflare Workers + upsert・削除トゥームストーンで同期する"
emoji: "🔄"
type: "tech"
topics: ["cloudflareworkers", "googlesheets", "typescript", "pwa", "個人開発"]
published: false
---
```

タイトル別案(はてブ・検索想定・差し替え自由):

- A(採用中): Google Sheets を個人用DBにする — Cloudflare Workers + upsert・削除トゥームストーンで同期する
- B: サーバー無しでオフライン編集を同期する — Google Sheets API で upsert・削除を実現する
- C: 個人開発のDBにGoogle Sheetsを選んだ話 — サービスアカウントJWTをcrypto.subtleで署名する

---

## はじめに

減量目標(10月末までに-8kg)のために、体重・食事・水分・筋トレ・日記を記録して週次レビュー+AIコーチングで振り返る、ローカルファーストなPWA「からだログ」を個人開発しています。[前回の記事](https://zenn.dev/yotti073/articles/dexie-uselivequery-pitfalls)では、データをブラウザのIndexedDB(Dexie)に持つ設計と、そこで踏んだ罠を紹介しました。

ローカルファーストにすると次に来る問題が「バックアップと可搬性」です。スマホを機種変更したら? ブラウザのストレージが消えたら? からだログでは専用のDBサーバーを立てず、代わりに**Googleスプレッドシートを個人用DB兼バックアップ先**にしました。この記事では、その同期の中身 — サービスアカウントでの認証、追記だけでは壊れる問題とupsert設計、削除を扱うための「トゥームストーン」パターン — を実コードで紹介します。

対象は「個人開発でサーバーレスにDBを持ちたい/Google Sheets APIをバックエンド代わりに使ってみたい」人です。

## なぜGoogle Sheetsなのか

選択肢としては専用DB(Cloudflare D1やSupabaseなど)もありましたが、単一ユーザーの個人開発では過剰でした。Google Sheetsなら:

- 見るためのUIがタダで付いてくる(自分でデータを確認・手直しできる)
- 権限管理・バックアップがGoogleアカウント側に乗る
- スプレッドシート単体で完結し、追加のインフラ運用が要らない
- **アプリという「システムの外」からでも自分の記録をAIに読ませられる。** 専用DBに閉じ込めると読み出しにAPI経由のエクスポート機能が要りますが、スプレッドシートならNotebookLMやGeminiにファイルとして直接読み込ませるだけで済みます。実際、このアプリを作る前は体重・食事の記録をNotebookLMに読ませて壁打ちする運用をしていて、その延長として「元々読ませていた場所と同じ形式のまま残しておきたい」という動機もありました

という理由で採用しています。ただし1点だけ注意が必要で、**このデータモデル専用に新規作成したスプレッドシートであり、以前から手動運用していた集計用シートとは別物**です。手動運用シートは「1日1行、その日の合計カロリー」という集計形式でしたが、アプリの `MealRecord` は「1食事=1レコード、1日に複数件」という粒度です。既存シートに合わせるには「日付で行を検索→既存値に合算→上書き」という集計ロジックが必要になり、これから説明する「レコード単位でID列をキーにupsertする」設計と相性が悪いため、素直に新規シートを切りました。

## 認証: サービスアカウントのJWTをWeb Crypto APIで署名する

同期はクライアント(PWA)から直接Sheets APIを叩くのではなく、間にCloudflare Workersを挟みます。認証情報(サービスアカウントの秘密鍵、スプレッドシートID)をクライアントに一切渡さないためです。

Workerは起動のたびにサービスアカウントのJWTを組み立てて署名し、Google OAuth2のJWT Bearerフローでアクセストークンと交換します。ここでハマりやすいのが、**Cloudflare WorkersにはNode.jsの`crypto`もブラウザの`SubtleCrypto`をラップした専用ライブラリも無く、標準の`Web Crypto API`(`crypto.subtle`)だけで完結させる必要がある**ことです。

```ts
// worker/googleSheetsAuth.ts
export async function buildSignedJwt(email: string, privateKeyPem: string, nowSec: number): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSec,
    exp: nowSec + 3600,
  };
  const signingInput = `${base64UrlEncodeString(JSON.stringify(header))}.${base64UrlEncodeString(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8ArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncodeBuffer(signature)}`;
}
```

`crypto.subtle.importKey` は鍵をPKCS8のバイナリ(`ArrayBuffer`)で要求するので、サービスアカウントJSONに入っているPEM文字列(`-----BEGIN PRIVATE KEY-----`〜)をヘッダ・改行を剥がしてBase64デコードするだけの変換関数を自前で用意しています。もう1つの落とし穴は、**CloudflareのシークレットにPEMを1行で貼り付けると改行がリテラルな`\n`という2文字として保存される**ことです。これを直さずに`atob()`へ渡すと鍵のパースに失敗するので、`\\n` → 実改行への正規化を先頭で必ず通します。

```ts
export function normalizePemNewlines(raw: string): string {
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}
```

署名したJWTを`https://oauth2.googleapis.com/token`に投げてアクセストークンを取得すれば、あとは通常のSheets API呼び出しに`Authorization: Bearer <token>`を付けるだけです。認証情報(`GOOGLE_SERVICE_ACCOUNT_EMAIL`・`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`・`GOOGLE_SHEETS_SPREADSHEET_ID`)はWorkerのシークレットとしてのみ保持し、クライアントには一切渡しません。

## 罠: 追記だけでは「編集」と「削除」が反映されない

最初の実装は素朴に「未同期のレコードをSheets APIの`values.append`で末尾に追記する」だけでした。これは初回はうまく動きますが、すぐに2つの問題にぶつかります。

1. **編集すると行が重複する。** 同期済みレコードを編集すると、Dexie側は`synced: false`に戻って次回また送信されます。追記だけだと同じレコードの新しい状態が新しい行として増え、シートには古い値の行が残り続けます。
2. **削除がシートに反映されない。** アプリ側で削除しても、追記オンリーの設計にはシートから行を消す手段がありません。

対処は「ID列を主キー代わりに使い、既存行を見つけて上書き(upsert)、無ければ追記」という方式に切り替えることでした。

![追記オンリーだと編集で行が重複するが、ID列でupsertすると同じ行を上書きできる](zenn03_図1_upsert概念図.png)

各タブにID列を1つ割り当てています(体重=F列、食事=H列、水分=C列など)。

```ts
// worker/sheetsSync.ts
export interface SheetConfig {
  name: string;
  /** ID列の列記号(体重記録=F列、食事記録=H列) */
  idColumnLetter: string;
}

export const WEIGHT_CONFIG: SheetConfig = { name: "体重記録", idColumnLetter: "F" };
export const MEAL_CONFIG: SheetConfig = { name: "食事記録", idColumnLetter: "H" };
```

同期のたびにまずID列だけを読み(`values/{tab}!F:F`のような1列指定の範囲取得なので軽い)、「ID→行番号」のマップを作ります。

```ts
async function readIdRows(
  accessToken: string,
  spreadsheetId: string,
  config: SheetConfig,
): Promise<Map<string, number[]>> {
  const range = encodeURIComponent(`${config.name}!${config.idColumnLetter}:${config.idColumnLetter}`);
  const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${range}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as { values?: (string | undefined)[][] };
  const map = new Map<string, number[]>();
  (data.values ?? []).forEach((cells, index) => {
    const id = cells?.[0];
    if (!id) return;
    const list = map.get(id) ?? [];
    list.push(index + 1); // 1始まりの行番号
    map.set(id, list);
  });
  return map;
}
```

このマップさえあれば、送信対象の各レコードは「既存行があれば上書き対象、無ければ追記対象」に振り分けられます。ここは副作用の無い純粋関数として切り出してあり、ネットワークに触れずにテストできます。

```ts
// worker/sheetsSync.ts
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

`updates`は`values:batchUpdate`で個別セル範囲(`{タブ名}!A{行番号}`)を一括更新し、`appends`は`values.append`でまとめて末尾に追記します。更新を先に、追記を後に実行するのがポイントで、追記は既存の行番号を一切動かさないため、削除計画で使う行番号マップを追記の前後どちらで作っても矛盾が起きません。

## 削除: 「消してすぐ消す」ではなく「トゥームストーンを残して次回同期で消す」

削除はもう少し工夫が要ります。アプリを開いていないときに削除しても同期は走らないので、**削除の意思そのものを記録しておいて、次にオンラインになったときに反映する**必要があります。ここで「トゥームストーン(墓標)」パターンを使っています。

```ts
// src/db/syncDeletions.ts
export async function enqueueDeletion(sheet: SyncSheet, recordId: string): Promise<void> {
  await db.syncDeletions.put({
    id: `${sheet}:${recordId}`,
    sheet,
    recordId,
    deletedAt: new Date().toISOString(),
  });
}
```

`deleteWeightRecord`/`deleteMealRecord`などの削除関数は、レコードをDexieから消すのと同時に、この`syncDeletions`テーブルに「どのタブの・どのIDを消してほしいか」を1行残します。次回の同期でこの一覧をWorkerに送り、Worker側は該当行を`spreadsheets:batchUpdate`の`deleteDimension`で物理削除します。

```ts
async function deleteRows(
  accessToken: string,
  spreadsheetId: string,
  sheetId: number,
  rowNumbersDesc: number[],
): Promise<void> {
  await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      requests: rowNumbersDesc.map((rowNumber) => ({
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber },
        },
      })),
    }),
  });
}
```

ここでの罠は**削除する順番**です。`deleteDimension`は指定した行を物理的に詰めるので、上の行から順に消すと、まだ消していない下の行の番号が1つずつズレていきます。対処は単純で、**行番号を降順(下から上)に並べてから削除する**だけです。

```ts
export function planRowDeletions(ids: string[], idToRows: Map<string, number[]>): number[] {
  const rowNumbers = new Set<number>();
  for (const id of ids) {
    for (const rowNumber of idToRows.get(id) ?? []) {
      rowNumbers.add(rowNumber);
    }
  }
  return [...rowNumbers].sort((a, b) => b - a); // 降順。上の行を先に消すと下の行番号がズレるため
}
```

`planUpserts`と同じく、ここも「ID一覧+行番号マップ→削除すべき行番号の配列」という純粋関数にしてあるので、実際にシートを叩かなくても単体テストで境界条件(同じIDが複数行に重複している、削除対象がシートに存在しない等)を検証できます。

削除が確定したら、`syncDeletions`テーブルからそのトゥームストーンを消します。逆に、**削除した直後に同じキーで登録し直した場合**(体重記録は日付が主キーなので「消してから同じ日付で測り直す」がありえる)は、保留中のトゥームストーンを取り消す`cancelDeletion`を呼び、次回同期では削除ではなく上書きとして扱われるようにしています。

## クライアント側: 部分成功を前提にする

Worker側の1回のリクエストは、体重・食事・水分・筋トレ・日記など複数タブをまとめて処理します。どれか1タブのAPI呼び出しが失敗しても他のタブは成功させたいので、Worker側は`Promise.allSettled`で各タブを独立に実行し、成功したタブの結果だけを返します。

```ts
// worker/sheetsSync.ts
const [weightResult, mealResult, /* ... */] = await Promise.allSettled([
  syncOneSheet(accessToken, spreadsheetId, WEIGHT_CONFIG, weightRows, deletedWeightIds),
  syncOneSheet(accessToken, spreadsheetId, MEAL_CONFIG, mealRows, deletedMealIds),
  // ...
]);
```

クライアント側の`runSync()`もこれに合わせて設計してあり、**トランスポートが「成功した」と報告したレコードだけ`synced: true`にする**という原則を徹底しています。

```ts
// src/sync/syncEngine.ts(抜粋)
await Promise.all([
  result.syncedWeightDates.length > 0 ? markWeightRecordsSynced(result.syncedWeightDates) : Promise.resolve(),
  // ...
  clearDeletions("weight", result.deletedWeightIds ?? []),
  // ...
]);
```

送信全体が例外を投げた場合は何も同期済みにせず、エラーをそのまま呼び出し元に伝播させます。これが実質的なリトライの仕組みで、専用のリトライキューは用意していません。「未同期フラグが立ったままのレコードが次回また送られる」という状態そのものが、失敗時の自然な再試行になるからです。

## まとめ

Google Sheetsを個人用DBにする実装で、実際に効いた勘所です。

- Cloudflare Workersからサービスアカウント認証をするなら、Node/ブラウザ用cryptoは使えない。**`crypto.subtle`でJWTを自前署名**し、PEMの改行エスケープ(`\\n`)を正規化するところまでが定石。
- 追記だけの同期は「編集で行が重複」「削除が反映されない」の2つを必ず踏む。**ID列を主キー代わりにしたupsert**に倒すと両方解決する。
- 削除はその場で消さず、**トゥームストーンを残して次回同期でまとめて処理**する。行の物理削除は行番号がズレるため**降順**で行うこと。
- upsert・削除の行番号計算は、ネットワークから切り離した**純粋関数**にしてテストする。Sheets APIをモックせずに境界条件を検証できる。
- 複数タブを1リクエストでまとめて送るなら、**部分成功**を前提にする。失敗したタブだけ未同期のまま残せば、次回の同期が自然なリトライになる。

このアプリのコード・仕様書は [GitHubで公開](https://github.com/yotti773/lifelog) しています。前回の記事([Dexie + useLiveQueryの罠](https://zenn.dev/yotti073/articles/dexie-uselivequery-pitfalls))と合わせて読むと、ローカルファーストPWAの「保存」と「同期」の両輪がつながります。

<!-- 公開前の執筆メモ(公開時に削除):
- 相互リンク: zenn01・zenn02への言及済み。zenn01への直接リンクも「まとめ」に足すか検討
- コードは 2026-08-02 時点の worker/sheetsSync.ts / worker/googleSheetsAuth.ts / src/db/syncDeletions.ts / src/sync/syncEngine.ts から引用(一部、記事向けに枝葉を省略した簡略版)
- 図・X投稿用画像は作成済み(冒頭の説明を参照)
-->
