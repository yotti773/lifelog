# PWAの通信が全部「Failed to fetch」になった — 犯人はサーバーではなくService Workerだった

- **想定スラッグ**: `pwa-failed-to-fetch-service-worker`
- **type**: tech
- **emoji**: 📡(既存の💾🛡🔄🗂️📋と重複無し。通信が全部落ちる話であるため)
- **topics**: `["pwa", "serviceworker", "cloudflareworkers", "個人開発", "claudecode"]`
- **主クエリ**: 「PWA Failed to fetch」「Service Worker 壊れた 復旧」
- **従クエリ**: 「PWA 再インストール データ消える」「fetch TypeError 切り分け」「Service Worker 登録解除 キャッシュ削除」

## X投稿(`X投稿テンプレート.md` タイプB)

画像: 未作成(案: 「アプリは開く / 通信は全部死ぬ」の対比図。SWがindex.htmlをキャッシュから返す一方で `/api/*` が素通りして失敗する経路を1枚に)

※ 公開時に `scripts/x/check_post_length.mjs` で全文を実測すること。

本投稿(案):

```
自作アプリのAIも同期も全部落ちたのに、サーバーはどこも壊れていませんでした。

体重と食事を記録する自作PWA「からだログ」。
犯人は端末に入っていたService Worker。アプリだけはキャッシュから開くので、正常に見えるんですよね。

顛末をZennに書きました。
#個人開発
```

自己リプ①:

```
記事はこちら👇
https://zenn.dev/yotti073/articles/pwa-failed-to-fetch-service-worker
```

自己リプ②(シリーズ導線):

```
このアプリ、10/31までに−8kgを目標に自分を実験台にしながら作っています。
同じアプリで「サブドメインを変えたらデータが消える」を踏んだ話はこちら👇
https://zenn.dev/yotti073/articles/indexeddb-origin-backup-restore
```

---

ローカルファーストのPWAを個人開発しています。体重・食事・水分・筋トレ・日記を記録して、週次でAIにコーチングさせるアプリです。データはIndexedDB(Dexie)に持ち、Cloudflare Workers 経由で Google スプレッドシートへ同期しています。

ある日、**アプリの通信が全部死にました。** AIコメントの生成も、スプレッドシートへの同期も、押すたびに `Failed to fetch` です。

にもかかわらず、**アプリは普通に開きます。** 記録も全部見えます。開発環境では再現しません。

結論から言うと、犯人はサーバーではなく**端末にインストールされていたPWAのService Worker**でした。ただ、そこにたどり着くまでに私はサーバー側を本命だと踏んで一度外しています。同じ構成のPWAを作っている人が同じ順序で外さないように、切り分けの手順ごと共有します。

## 3行まとめ

- **`Failed to fetch` が出た時点で「HTTPレスポンスが1つも返っていない」と確定できる。** サーバーが返すエラーは、どんな失敗でも必ずステータスとボディを伴う。ここを最初に確定させると、疑う範囲が半分に減る
- **PWAはService Workerが `index.html` をキャッシュから返すので、通信が全部死んでいてもアプリは正常に開く。** 自動同期の失敗を握りつぶしていると、症状は「AIボタンを押したときだけ」に見え、原因を誤診する
- **壊れたPWAの復旧手段が「再インストール」しかないのは危険。** アンインストールはストレージごと消えることがあり、記録がIndexedDBにしか無いアプリではデータ喪失と隣り合わせになる

## 発端: 「AIが動かない」から始まった

最初の報告は「AIに処理を投げると Failed to fetch になる」でした。

このアプリのAI機能は2つあります。食事写真からカロリーとPFCを推定する判定と、週次・月次のコーチコメント生成です。どちらも Cloudflare Worker を経由して Gemini API を呼びます。

まずAIまわりのコードを読みました。そして**すぐに1つ確定できることに気づきます。**

## 確定できること: `Failed to fetch` はサーバーからは出ない

Worker側のハンドラは、こうなっていました。

```ts
try {
  const advice = await generateWeeklyAdvice(env, digest, fetchImpl);
  return Response.json(advice);
} catch (error) {
  const message = error instanceof Error ? error.message : "コメントの生成に失敗しました";
  return Response.json({ error: message }, { status: 502 });
}
```

クライアント側はこうです。

```ts
if (!res.ok) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? "コメントの生成に失敗しました");
}
```

**つまりサーバー側で何が起きても、ユーザーには日本語のメッセージが出ます。** Gemini がエラーを返せば「Gemini APIエラー (404): …」、認証が通らなければ 401 のメッセージ。Worker が例外を投げて Cloudflare が 1101 のエラーページを返しても、`res.json()` が失敗して汎用メッセージに落ちるだけです。

`Failed to fetch` は違います。これは `fetch()` 自体が投げる `TypeError` で、**HTTPレスポンスが1バイトも返っていない**ことを意味します。

念のため、ローカルに本番と同じ構成を立てて確かめました。

```
$ npx wrangler dev --port 8787
$ curl -X POST http://127.0.0.1:8787/api/weekly-advice \
    -H 'content-type: application/json' -d '{"digest":{}}'

{"error":"Gemini APIエラー (400): {\n  \"error\": {\n    \"code\": 400,\n
  \"message\": \"API key not valid. Please pass a valid API key.\", ... }"}
HTTP 502
```

ダミーキーで叩くと、Gemini の実エラーが 502 に包まれて日本語で返ってきます。想定どおりでした。写真4枚相当(約1MB)の判定リクエストも 0.06 秒で処理され、ボディサイズの問題でもありませんでした。

**ここで疑う範囲が半分に減ります。** アプリのロジックでもGeminiでもなく、「リクエストがサーバーに届いていない」ことだけが確定しました。

## 誤診: モデルの引退を疑い、次にオリジンを疑った

このとき本人から2つの仮説が出ました。どちらも筋が通っています。

**仮説1「Geminiのモデルが使えなくなったのでは」** — もっともらしいのですが、上の理屈で否定できます。モデルIDが無効なら Gemini は 404 を返し、Worker がそれを包んで日本語メッセージになる。`Failed to fetch` にはなりません。念のため公式のdeprecation情報も確認したところ、使っていた2モデルはどちらもシャットダウン予定日まで数か月〜1年ありました。

**仮説2「シート同期もダメそう」** — これが決定打になりました。

シート同期は Gemini を一切呼びません。Google Sheets API を叩くだけです。**AIも同期も落ちているなら、共通因子は Gemini ではなくその手前**ということになります。

そこで三点測量をしました。このアプリには、Cloudflare Worker を通らない経路がもう1つあります。Garmin の活動データを GitHub Actions の cron で毎日スプレッドシートに書き込む処理です。

| 経路 | Worker経由 | Gemini | Sheets | 結果 |
|---|---|---|---|---|
| AIコメント生成 | ✅ | ✅ | — | 失敗 |
| シート同期 | ✅ | — | ✅ | 失敗 |
| Garmin → シート(Actions) | **なし** | — | ✅ | **成功(同日朝)** |

Actions の実行履歴を見ると、その日の朝3時台の実行を含めて全部成功していました。**スプレッドシートもSheets APIもサービスアカウントも健全**です。

失敗する2つに共通し、成功する1つに無いものは **Cloudflare Worker ただ1つ**。

……ここで私は「Workerかオリジンが落ちている」を本命に据えました。**これが外れです。**

## なぜ「サーバーが落ちている」と「SWが壊れている」を区別できなかったのか

両者は症状が完全に一致します。

- アプリは普通に開く
- 記録も全部見える
- `/api/*` だけが全部 `Failed to fetch`

**この一致こそがPWA特有の落とし穴でした。** 理由は3つあります。

### 1. Service Worker が `index.html` をキャッシュから返す

`vite-plugin-pwa` が生成する Service Worker は、precache と NavigationRoute だけを持ちます。

```js
registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("index.html")))
```

NavigationRoute が拾うのは `request.mode === "navigate"`、つまり画面遷移だけです。`POST /api/*` は横取りされず、そのままネットワークへ出ます。

これは設計として正しいのですが、副作用があります。**オリジンが完全に死んでいてもアプリは起動する。** アプリシェルがキャッシュから返るからです。

### 2. 記録はIndexedDBにあるので、画面は何も欠けない

ローカルファーストの利点がそのまま裏返ります。体重も食事もグラフも、サーバーに一度も触れずに描画されます。**目視では健康そのもの**です。

### 3. 自動同期の失敗を握りつぶしていた

```tsx
// 短時間の連続発火はcreateAutoSyncRunnerが抑止する。失敗は静かに無視する
const autoSync = createAutoSyncRunner();
void autoSync.trigger();
```

意図的にそうしていました。同期は失敗しても `synced: false` が維持されて次回再試行されるので、その都度ユーザーに見せる必要はない、という判断です。

**結果として、`/api/*` が丸ごと死んでいても、ユーザーが気づける場所がAIボタンしか無くなりました。** 最初の報告が「AIが動かない」だったのはこのためです。実際にはAI固有の問題ではありませんでした。

## 決着: ブラウザを変えると動いた

切り分けの最後は、本人の手元で決まりました。

**通常のブラウザで開くと動く。** インストール済みのPWAだけが失敗する。

これでサーバー側の線は消えます。同じオリジン、同じネットワークで、片方だけが失敗するなら、違いは**そのPWAに紐づいたService Workerの登録状態**しかありません。

そして **PWAを再インストールしたら直りました。**

正確な機序は特定できていません。壊れた登録はもう消えてしまいましたし、現行のSWは `/api/*` を横取りしないので「SWがAPIを握り潰していた」という単純な経路ではありません。SWの登録自体が壊れた状態になり、その配下のページからの通信がまとめて失敗していた、という筋が濃厚です。

**再現できないことを、無理に断定しない。** これは書いておきます。

## 本当の問題は、復旧手段が再インストールしか無かったこと

原因が分かって終わり、ではありませんでした。**復旧の過程そのものが危険だった**からです。

このアプリのコードには、**Service Workerを扱う行が1つもありませんでした。** `vite-plugin-pwa` の `injectRegister: 'auto'` による自動登録だけです。つまり:

- SWが壊れても検知できない
- ユーザーに残された手段が「再インストール」しかない
- **Android Chrome では PWA のアンインストールでサイトのストレージごと消えることがある**

記録が全部 IndexedDB にあるアプリで、これは最悪の組み合わせです。実際、今回は本人が事前にバックアップJSONを書き出してからアンインストールしたので無事でした。**運用でカバーしていただけ**です。

そして `registerType: "autoUpdate"` で自動更新を続ける以上、同じことは再発しえます。

## 入れた対策

### 1. 設定画面に「アプリのリセット」を置く

SWの登録解除と Cache Storage の削除だけを行い、**IndexedDBには一切触れません。**

```ts
export async function resetAppShell(deps: AppResetDeps = defaultDeps()): Promise<AppResetResult> {
  const { serviceWorker, cacheStorage } = deps;
  let unregisteredCount = 0;
  let deletedCacheCount = 0;
  const failedSteps: string[] = [];

  if (serviceWorker) {
    try {
      const registrations = await serviceWorker.getRegistrations();
      const results = await Promise.all(registrations.map((r) => r.unregister()));
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
```

設計で意識した点が2つあります。

**片方が失敗しても、もう片方は最後まで実行する。** 壊れた状態からの復旧手段なので、一部でも捨てられたほうが見込みが上がります。

**ただし1つでも失敗したら throw する。** 呼び出し側は成功時にリロードするので、黙って成功扱いにすると「リセットしたのに直っていない」状態をユーザーが正常だと思ってしまいます。ここは最初、両方失敗したときだけthrowする実装にしていて、レビューで指摘されて直しました。

### 2. 「サーバーに届かない」と「サーバーがエラーを返した」を分ける

今回いちばん時間を溶かしたのは、画面に出た文言が英語の `Failed to fetch` だけだったことです。この2つは**ユーザーが取るべき行動が違います。**

- **届かなかった** → 通信環境の確認、アプリのリセット
- **エラーが返ってきた** → 時間をおいて再試行

`/api/*` の呼び出しを共通処理に寄せて、投げ分けるようにしました。

```ts
let res: Response;
try {
  res = await fetch(path, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
} catch (error) {
  const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
  throw new ApiConnectionError(isTimeout ? API_TIMEOUT_MESSAGE : API_CONNECTION_MESSAGE);
}

if (!res.ok) {
  const errorBody = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(errorBody?.error ?? fallbackErrorMessage(res.status));
}

try {
  return (await res.json()) as T;
} catch (error) {
  // 200なのにJSONでないのは、Workerではない何かが応答しているということ
  const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
  throw new ApiConnectionError(isTimeout ? API_TIMEOUT_MESSAGE : API_INVALID_RESPONSE_MESSAGE);
}
```

**最後の `try` はレビューで足りないと指摘された部分です。** 200 が返っているのにJSONでないケース — SPAの `index.html` が返る、キャプティブポータルに攫われる — は、生の `SyntaxError: Unexpected token '<'` がそのままユーザーに出ていました。これも「サーバーに届かなかった」側に寄せています。

### 3. タイムアウト。ただし同期側は短くしない

`AbortSignal.timeout()` を入れました。応答が返らないままスピナーが回り続けると、失敗か処理中かを判別できないためです。

ここで**一度やらかしかけました。** 同期のタイムアウトを60秒にしたのですが、レビューでこう指摘されました。

> 同期は未同期分をまとめて1リクエストで送り、分割送信の仕組みがない。長期オフライン後に未同期が大量にたまった状態でタイムアウトすると、次回も同じ量を送って同じように打ち切られ、**永久に同期できなくなる**。

そのとおりです。180秒に変更しました。**ここでの目的は「速く諦めること」ではなく「無限に待たせないこと」**で、この2つは設計上まったく別物でした。

### 4. Worker側のリトライを一時的な失敗に限定する

ついでに見つかった別の問題です。コメント生成は失敗すると1回リトライしていました。

```ts
try {
  return await callGeminiOnce(env, digestJson, fetchImpl);
} catch {
  return callGeminiOnce(env, digestJson, fetchImpl);  // 無条件
}
```

APIキー不正やモデル名不正でもリトライするので、**通らないリクエストの待ち時間が倍になるだけ**です。5xx・429・408・スキーマ検証落ちだけ再試行するようにしました。

これも最初は「4xxは全部リトライしない」と書いてレビューで刺されました。**429 RESOURCE_EXHAUSTED は瞬間的なレート超過で、1回待てば通ることが多い**ためです。粗い分類は粗いなりに間違えます。

### 5. `[observability]` を有効にする

```toml
[observability]
enabled = true
```

今回いちばん欲しかったのに無かったものです。「そもそもリクエストがWorkerまで届いたのか」をダッシュボードで確認できます。

今回の原因はクライアント側でWorkerには届いていなかったので、ログがあっても直接の解決にはなりませんでした。ただ**「Workerには届いていない」と即断できた**はずで、切り分けのコストは大きく下がります。

## まとめ

| | 疑ったもの | 実際 |
|---|---|---|
| 1回目 | Geminiのモデルが引退した | 両モデルとも現役。そもそもモデル起因なら日本語エラーが出る |
| 2回目 | Cloudflare Worker かオリジンが落ちた | Worker は健全。ブラウザを変えると動いた |
| 正解 | — | 端末のPWAに紐づいたService Workerの状態 |

同じ構成のPWAを作っている方に持ち帰ってほしいのは3つです。

**1. `Failed to fetch` が出たら、まず「レスポンスが返っていない」と確定させる。** サーバー側の失敗は必ずステータスとボディを伴います。エラー文言を自前で整形しているなら、この境界が切り分けの最初の道具になります。

**2. PWAは「動いているように見えたまま」全部の通信に失敗できる。** アプリシェルはキャッシュから、データはIndexedDBから返るので、画面は健康に見えます。**同期の失敗を握りつぶす設計は、この見え方と組み合わさると障害を不可視にします。**

**3. SWが壊れたときの復旧経路を、アプリの中に持っておく。** 再インストールに頼る設計は、記録がIndexedDBにしか無いアプリではデータ喪失と隣り合わせです。SW登録解除とCache Storage削除だけを行い、IndexedDBには触れないボタンを1つ置くだけで、ユーザーは安全に自力で復旧できます。

そして今回いちばん効いた切り分けは、**Worker を通らない経路(GitHub Actions からの書き込み)が生きているかを見る**ことでした。系の一部だけを通る独立した経路が1本あると、三点測量ができます。設計時にそれを意識していたわけではありませんが、結果的に一番効きました。

---

**リポジトリ**: https://github.com/yotti773/lifelog
**アプリ**: https://lifelog.n1lab.workers.dev/

関連記事:

- [サブドメインを変えるだけで全データが消える — IndexedDBのオリジン制約と、検証していなかったバックアップ](https://zenn.dev/yotti073/articles/indexeddb-origin-backup-restore)
- [ローカルファーストPWA実践 — Dexie + useLiveQuery の設計と罠](https://zenn.dev/yotti073/articles/dexie-uselivequery-pitfalls)

---

## 執筆メモ(公開前に消す)

**この記事は 2026-08-09 の障害と、同日の PR #207(Issue #203〜#206)を素材にしている。** 公開前に以下を確認すること。

1. ~~**本人の観測の裏取り。** 本文の「通常のブラウザで開くと動いた」は本人からの報告で、私(執筆時のセッション)は直接確認していない。**ブラウザを変えたのが再インストールの前か後か**を本人に確認し、事実と違えば該当段落を書き直す~~ → **2026-08-09 確認済み。ブラウザを変えたのは再インストールの前**で、本文の順序(ブラウザ変更で切り分け → 再インストールで復旧)のとおり。「決着」節はこのままでよい。
   **ただし残る前提が1つある**: 「同じオリジン、同じネットワークで、片方だけが失敗する」と書いているのは、通常ブラウザで試したのが**同じ端末**である前提。別端末だった場合は回線・DNSの差が入りうるため論証が弱くなる。公開前に本人に確認し、別端末だったなら「同じネットワーク」の一句を外す
2. **「Android Chrome ではアンインストールでストレージごと消えることがある」の出典を確認する。** 挙動はOS・ブラウザのバージョンで変わりうるため、断定を弱めるか、確認できた条件を明記する
3. **Geminiのモデルのシャットダウン予定日は 2026-08-09 時点の調査。** 公開時点で変わっていないか確認する(本文では日付を書かず「数か月〜1年」とぼかしてあるが、それでも妥当か見る)
4. **コード引用は PR #207 マージ時点(`fc22d6f`)のもの。** 公開までに `src/api/request.ts`・`src/lib/appReset.ts`・`worker/weeklyAdvice.ts` が変わっていないか確認する
5. **X投稿の文字数を `scripts/x/check_post_length.mjs` で実測する。** 本文中の案は未計測
6. **X画像が未作成。** 案は「アプリは開く / 通信は全部死ぬ」の対比図。作るなら `articles/README.md` の画像ルール(M PLUS Rounded 1c のサブセットwoff2をbase64埋め込み、`document.fonts.size` が0でないことを確認、署名は右下)に従う
7. **`zenn-content` リポジトリへの転記が必要**(公開用の正本はそちら)。スラッグ・フロントマター・公開手順は `zenn-content/CLAUDE.md` を参照
8. **レビュー指摘を3か所で「刺された」話として書いているのは意図的。** 失敗の過程が読者の持ち帰りになる型(zenn07と同じ)なので、推敲で消さないこと
