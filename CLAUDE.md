# CLAUDE.md

このファイルは、このリポジトリで作業する Claude Code (claude.ai/code) 向けのガイドです。

## 言語

- **このファイル(CLAUDE.md)を含め、リポジトリ内のドキュメントは日本語で記述する。**
- **PRの説明文・コメント、Issueのコメントなど、GitHub上でのやり取りも基本的に日本語で書く。** コード中の識別子・コメントや、既存の英語表記(コマンド名など)はそのままでよい。

## これは何か

体重と食事(カロリー・PFC)を記録するローカルファーストPWA(React + Vite + TypeScript)。`docs/` 配下の仕様書をもとに作られている:

- `docs/ライフログアプリ_要件定義書.md` — 要件定義(目的、MVPスコープ、技術選定の理由)
- `docs/ライフログアプリ_画面設計書.md` — 画面仕様、データモデル、同期フロー
- `docs/ライフログアプリ_デザインガイド.md` — カラーパレット、タイポグラフィ、レイアウトルール

プロダクト/UXに関わる判断をする前にこれらを読むこと。真実の情報源はこれらの仕様書であり、このファイルではない。

## コマンド

```
npm run dev       # Vite開発サーバーを起動(localhost:5173)
npm run build     # tsc -b && vite build(PWAのService Workerも生成される)
npm run test      # vitest run(全テスト実行)
npx vitest run src/db/__tests__/weightRecords.test.ts   # 単一テストファイルの実行
npm run preview   # 本番ビルドをローカルで配信(実際のPWA/インストール動作の確認に必要)
```

`npm run lint` は package.json に定義されているが、ESLintは実際にはインストール・設定されていない — 当てにしないこと。

このリポジトリにはブラウザ用のテストランナーが組み込まれていない。UI変更を目視確認するには `npm run dev` を起動し、Playwright(スクラッチディレクトリで `npm install playwright` + `npx playwright install chromium`)で操作すること — リポジトリ内にヘルパースクリプトは無い。

## 開発フロー

作業は別のバックログドキュメントではなく GitHub Issue で管理する — リポジトリの Issues タブが「何が残っているか」の唯一の情報源。各Issueは、元になった `docs/`(要件定義書・画面設計書)の該当箇所にリンクしている。

- **非自明な作業は着手前にIssueを立てる。** 自分一人で作業する場合でも同様。`docs/` での意思決定とそれを実装したコードの対応関係をたどれるようにし、後続のセッション(人間・Claudeどちらも)が仕様書を読み直さなくても「なぜ」を把握できるようにするため。
- ブランチ上で実装し、`npm run test` / `npm run build` で検証、UI変更であれば上記コマンド節の通りPlaywrightで手動確認する。
- **Issueが完了したらPRを作成する。** PR本文で該当Issueを参照し(例: `Closes #6`)、マージ時に自動クローズされるようにする。PRを介さず `main` へ直接マージしない — PRは「何を・なぜ変更したか」の記録になる。
- **Issue作成時は `優先度: 高` / `優先度: 中` / `優先度: 低` のいずれかを付ける。** 判断基準は `docs/ライフログアプリ_要件定義書.md` 3章のMVP優先表(体重・食事記録が最優先、筋トレは後回し)および各章の「フェーズ2」「検討する」といった記述に沿う — 減量目標(10月末)に直結するMVPコア機能ほど高く、フェーズ2以降の拡張機能や検討中の論点ほど低くする。

## アーキテクチャ

### データ層(`src/db/`)

DexieでIndexedDBをラップしている。`db.ts` がスキーマを定義し、エンティティごとに1ファイル(`weightRecords.ts`、`mealRecords.ts`、`settings.ts`)がプレーンな非同期CRUD関数をexportする — リポジトリクラスやDexie自体を超えたORM的な抽象化はない。

型だけからは分かりにくい、モデリング上の重要な選択:
- **`WeightRecord` は `date`(YYYY-MM-DD)をDexieの主キーにしている。** これにより「1日1件、後勝ち」が自動的に成立する — `saveWeightRecord` は `.put()` を呼ぶだけで、手動の上書きロジックは不要。
- **`MealRecord` は生成したUUIDをキーにしている。** 同じ日の同じ `mealType` に複数件の記録が許されるため(例: 間食を2回記録するなど)。
- **すべてのレコードが `synced: boolean` を持つ。** `saveWeightRecord`/`updateWeightRecord`/`updateMealRecord` は、レコードの内容が変わるたびにこれを `false` にリセットする。これにより、同期後の編集も再度拾われる。`markWeightRecordsSynced`/`markMealRecordsSynced` 以外の場所で `synced: true` を直接セットしないこと。
- **`getUnsyncedWeightRecords`/`getUnsyncedMealRecords` はDexieのインデックスではなくJS側の `.filter()` で絞り込んでいる** — IndexedDBはbooleanをインデックスのキーにできないことと、レコード件数がこの規模(単一ユーザー、1日あたり数件)では十分軽いため、これで問題ない。これをインデックス化して「最適化」しないこと。
- `getDailyCalorieTotals(startDate, endDate)` は、食事記録が無い日でも範囲内の全日を `0kcal` で埋める — これにより、カロリー推移グラフが記録の空白を誤魔化して圧縮された線ではなく、隙間として表示される。

テストは `fake-indexeddb/auto`(`src/db/__tests__/setup.ts` を参照。`vitest.config.ts` の `setupFiles` で組み込まれている)を使っており、データ層全体をブラウザ無しでNode上でテストしている。`beforeEach` で各テーブルを直接クリアする(`db.weightRecords.clear()` など)— 共通のテストDBリセットヘルパーは無く、各テストファイルが自分の使うテーブルをクリアする。

### 同期エンジン(`src/sync/`)

`runSync()`(`syncEngine.ts` 内)はトランスポート非依存: 未同期のレコードを取得し、`SyncTransport.push()` を呼び、トランスポートが成功を報告したレコードだけを同期済みにする(部分的な成功は想定内で、ハンドリングされている)。何らかのエラーがthrowされた場合、何も同期済みにされず、エラーは呼び出し元に伝播する — これがリトライの仕組みであり、別途リトライキューは存在しない。

`notConfiguredTransport` が現在(デフォルト)のトランスポートで、常にthrowするだけのプレースホルダー。**実際のCloudflare Worker → Google Sheets連携はまだ実装されていない。** 実装する際は: `SyncTransport`(`types.ts` 参照)をWorkerエンドポイントに対して実装し、`App.tsx`(起動時の自動同期)と `Settings.tsx`(「今すぐ同期」ボタン)に渡している `transport` を差し替える。`画面設計書` 7章の通り、同期先は新規シートではなく、ユーザーが既に(手動DB代わりに)使っている既存のスプレッドシート。

### UI(`src/pages/`、`src/components/`)

クライアントの状態は、React state + 手動再取得ではなく `dexie-react-hooks` の `useLiveQuery` から得ている — IndexedDBのテーブルが変化すると、ページは自動的に再レンダリングされる。

**注意点:** `useLiveQuery` は「まだロード中」と「`undefined` に解決した」を区別できない。空のDexieテーブルに対する `.first()`/`.last()` は `undefined` に解決するため、`db.weightRecords.orderBy("date").first()` のようなクエリは、記録が1件も無い新規ユーザーの場合、ローディング分岐から永久に抜け出せなくなる — クエリが「完了した」というシグナルを一切出さないまま止まる。このコードベース全体で使われている対処法は、クエリ関数からの戻り値を返す前にそれらの結果を `null` に正規化し(`Trends.tsx` を参照)、`undefined` だけを「まだロードされていない」として扱うこと。「見つからない」に正当に解決しうる新しい `useLiveQuery` 呼び出しには同じパターンを適用すること。

グラフ(`WeightChart.tsx`、`CalorieChart.tsx`)はチャートライブラリではなく、手書きのSVG — これは意図的なもので、ライブラリのデフォルトと戦うのではなく、デザインガイドのパレットを厳密にコントロールするため。

### デザインシステム上の制約

`tailwind.config.js` はデザインガイドのパレットを名前付きカラー(`background`、`primary`、`secondary`、`accent`、`ink`、`muted`)として、フォントを(`font-rounded` = 数字・見出し用のM PLUS Rounded 1c、`font-body` = Noto Sans JP)として登録している。**`accent`(黄色)はデザインガイドにおいて「達成の瞬間」の演出(目標達成、連続記録など)専用に予約されている** — 基準線やバッジのような常時表示の静的UIに使ってはならない。グラフの目標線がまさにこの理由でミュートグレーになっている。デザインガイドの根拠を読み直さずにaccentへ変更しないこと。

### PWA

`vite-plugin-pwa`(`vite.config.ts` を参照)がビルド時にマニフェストとService Workerを生成する — アイコン(`public/icons/`、デザインガイドのプライマリカラーから一度生成したもので手描きではない)以外、手作業でメンテナンスするものはない。

### デプロイ

Cloudflare Workers(クラシックな別サービスの「Pages」ではなく、Git連携版)上で https://lifelog.tatu1228.workers.dev/ にホストされており、`main` へのpushで自動デプロイされる。ビルドコマンドは `npm run build`、デプロイコマンドは `npx wrangler deploy` で、`wrangler.toml` の `[assets]` ブロック(`directory = "dist"`、SPAルーティング用に `not_found_handling = "single-page-application"`)で駆動されている。

**`public/_redirects` ファイルを追加しないこと** — `not_found_handling = "single-page-application"` と組み合わせると、CloudflareはSPAフォールバックの処理をどちらも試みるものとみなし、無限リダイレクトループとしてデプロイを拒否する。`[assets]` の設定だけで十分であり、現在デプロイされているのもこの構成。

`npm run deploy` はローカルで同じbuild+deployを実行するが、事前に `wrangler login` が必要(このサンドボックス化された開発環境ではセットアップされていない — 特に指示が無い限り未認証だと想定すること)。
