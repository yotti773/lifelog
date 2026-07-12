# CLAUDE.md

このファイルは、このリポジトリで作業する Claude Code (claude.ai/code) 向けのガイドです。

## 言語

- **このファイル(CLAUDE.md)を含め、リポジトリ内のドキュメントは日本語で記述する。**
- **PRの説明文・コメント、Issueのコメントなど、GitHub上でのやり取りも基本的に日本語で書く。** コード中の識別子・コメントや、既存の英語表記(コマンド名など)はそのままでよい。

## これは何か

体重・食事(カロリー・PFC)・水分・筋トレ・日記を記録し、週次レビュー+AIコーチングで振り返るローカルファーストPWA(React + Vite + TypeScript + MUI)。`docs/` 配下の仕様書をもとに作られている:

- `docs/からだログ_要件定義書.md` — 要件定義(目的、フェーズ構成、技術選定の理由)
- `docs/からだログ_画面設計書.md` — 画面仕様、データモデル、同期フロー
- `docs/からだログ_デザインガイド.md` — カラーパレット、タイポグラフィ、レイアウトルール
- `docs/からだログ_AIコンサルティング設計書.md` — フェーズ3のAIコーチング(週次レビューへのAIコメント統合)の設計。データ契約・プロンプト・モデル選定・プライバシー
- `docs/からだログ_意思決定ログ.md` — 決定済み論点の経緯の記録(要件定義書・画面設計書から分離)。現在の仕様の真実の情報源はあくまで各仕様書の本文
- `docs/からだログ_レビューチェックリスト.md` — リポジトリ全体レビュー・ドキュメント整合チェックの機械的な手順書。全体レビューやドキュメント最新化を頼まれたら、まずこれに従って実行する

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
- **新規画面の追加や大きなレイアウト変更を伴う場合、実装前の画面設計のタイミングでArtifactツールを使ってHTMLモックアップを作成し、レイアウト・配色案を確認する。** テキストの画面設計書だけでは見た目の合意が取りにくいため。モックアップは実装前の意思決定用であり、実装そのものの代わりにはならない — 実際のMUIテーマ・実データでの見え方は、次の項目の通り `npm run dev` + Playwrightで別途確認する。
- **新しい作業ブランチを作成する際は、まず `git status` で作業ツリーがクリーンであることを確認し、`git checkout main && git pull --ff-only origin main` でローカルmainを最新化してから、そこから作業ブランチを切る。** mainに未コミットの変更がある、または`--ff-only`が失敗する(ローカルmainが分岐している)場合は、最新化を強行せずユーザーに確認する。古いmainから作業ブランチを切ると、並行してマージされた変更を見落としたまま実装・PR作成してしまう。
- ブランチ上で実装し、`npm run test` / `npm run build` で検証、UI変更であれば上記コマンド節の通りPlaywrightで手動確認する。
- **仕様に影響する変更を実装したら、対応する `docs/` の仕様書へ書き戻す(必須)。** 画面の挙動・データモデル・同期・意思決定に関わる変更は、実装だけで終わらせず該当する仕様書本文(画面設計書・要件定義書など)を現在の仕様に更新し、見送っていた論点を実装した場合は12章などの論点リストと `docs/からだログ_意思決定ログ.md` に経緯を残す。仕様書が真実の情報源であり、コードと乖離させない。純粋なバグ修正・リファクタなど仕様に影響しない変更は書き戻し不要(その旨を判断できるよう、影響有無は毎回確認する)。
- **PR作成前にレビューを行う(必須)。** `docs/からだログ_レビューチェックリスト.md` の観点(特に「5. UIコードのレビュー観点」「4. コード不変条件チェック」)で自分の変更を点検する。まとまった変更では `/code-review` skill を併用してよい。指摘は修正するか、対応しない場合は理由を残す。
- **Issueが完了したらPRを作成する。** PR本文で該当Issueを参照し(例: `Closes #6`)、マージ時に自動クローズされるようにする。PRを介さず `main` へ直接マージしない — PRは「何を・なぜ変更したか」の記録になる。
- **PRのマージはユーザーの明示的な指示(例:「マージして」「PR #29をマージして」)を受けてから `gh pr merge --squash` で行う。** PRはこのリポジトリのGitHubアカウント自身が作成するため、GitHub上の正式なApprove機能は使えない(自分が作成したPRは自分でApproveできない、というGitHub側の固定仕様)。そのためレビュー完了の合図はチャット上のユーザーの明示的な指示とし、指示なしに自発的にマージしない。マージ方式は常にsquash(PR内の複数コミットをmainに1つにまとめる)。
- **PRがマージされたら作業ブランチを削除する。** リモート側はリポジトリ設定(`Settings → General → Pull Requests → Automatically delete head branches`、API上は`delete_branch_on_merge`)を有効にしてあるため、マージ時に自動削除される。ローカル側は自動化されないため、マージ確認後に `git checkout main && git pull --ff-only origin main && git branch -d <ブランチ名>` で手動削除する。
- **Issue作成時は `優先度: 高` / `優先度: 中` / `優先度: 低` のいずれかを付ける。** 判断基準は `docs/からだログ_要件定義書.md` 3章のMVP優先表(体重・食事記録が最優先、筋トレは後回し)および各章の「フェーズ2」「検討する」といった記述に沿う — 減量目標(10月末)に直結するMVPコア機能ほど高く、フェーズ2以降の拡張機能や検討中の論点ほど低くする。

## アーキテクチャ

### データ層(`src/db/`)

DexieでIndexedDBをラップしている。`db.ts` がスキーマを定義し、エンティティごとに1ファイル(`weightRecords.ts`、`mealRecords.ts`、`waterRecords.ts`、`workoutRecords.ts`、`diaryRecords.ts`、`activityRecords.ts`、`settings.ts` など)がプレーンな非同期CRUD関数をexportする — リポジトリクラスやDexie自体を超えたORM的な抽象化はない。

型だけからは分かりにくい、モデリング上の重要な選択:
- **`WeightRecord` は `date`(YYYY-MM-DD)をDexieの主キーにしている。** これにより「1日1件、後勝ち」が自動的に成立する — `saveWeightRecord` は `.put()` を呼ぶだけで、手動の上書きロジックは不要。
- **`MealRecord` は生成したUUIDをキーにしている。** 同じ日の同じ `mealType` に複数件の記録が許されるため(例: 間食を2回記録するなど)。
- **すべてのレコードが `synced: boolean` を持つ。** `saveWeightRecord`/`updateWeightRecord`/`updateMealRecord` は、レコードの内容が変わるたびにこれを `false` にリセットする。これにより、同期後の編集も再度拾われる。`markWeightRecordsSynced`/`markMealRecordsSynced`、およびシート由来のレコードを保存する `runImport`(下記の取り込みを参照)以外の場所で `synced: true` を直接セットしないこと。
- **`getUnsyncedWeightRecords`/`getUnsyncedMealRecords` はDexieのインデックスではなくJS側の `.filter()` で絞り込んでいる** — IndexedDBはbooleanをインデックスのキーにできないことと、レコード件数がこの規模(単一ユーザー、1日あたり数件)では十分軽いため、これで問題ない。これをインデックス化して「最適化」しないこと。
- `getDailyCalorieTotals(startDate, endDate)` は、食事記録が無い日でも範囲内の全日を `0kcal` で埋める — これにより、カロリー推移グラフが記録の空白を誤魔化して圧縮された線ではなく、隙間として表示される。

テストは `fake-indexeddb/auto`(`src/db/__tests__/setup.ts` を参照。`vitest.config.ts` の `setupFiles` で組み込まれている)を使っており、データ層全体をブラウザ無しでNode上でテストしている。`beforeEach` で各テーブルを直接クリアする(`db.weightRecords.clear()` など)— 共通のテストDBリセットヘルパーは無く、各テストファイルが自分の使うテーブルをクリアする。

### 同期エンジン(`src/sync/`)

`runSync()`(`syncEngine.ts` 内)はトランスポート非依存: 未同期のレコードと**削除トゥームストーン**(`src/db/syncDeletions.ts`、後述)を取得し、`SyncTransport.push()` を呼び、トランスポートが成功を報告したレコードだけを同期済みにする(部分的な成功は想定内で、ハンドリングされている)。何らかのエラーがthrowされた場合、何も同期済みにされず、エラーは呼び出し元に伝播する — これがリトライの仕組みであり、別途リトライキューは存在しない。

**編集・削除の反映(Issue #30):** 追記のみだと、同期済みレコードを編集すると新しい行が重複して増え、削除はスプレッドシートに残り続ける。これを防ぐため、(1) 編集は `synced: false` に戻る性質をそのまま使い、Worker側で**ID列(体重=F・食事=H・水分=C・筋トレ=H・日記=E・食事マスタ=H・種目マスタ=C列)をキーに既存行を特定して上書き**(無ければ追記)する upsert にした。(2) 削除は `deleteWeightRecord`/`deleteMealRecord` が `syncDeletions` テーブルに**トゥームストーン**(対象タブとID列の値)を残し、次回同期でWorkerが該当行を `deleteDimension` で物理削除する。削除確定後にトゥームストーンを消す。体重は主キーが日付のため、削除した日付を再登録したら `saveWeightRecord` が保留中のトゥームストーンを取り消す(`cancelDeletion`)。`worker/sheetsSync.ts` の `planUpserts`/`planRowDeletions` は純関数として切り出してあり単体テストがある。

**取り込み(Issue #54):** シート→アプリ方向の手動インポート(設定画面の「シートから取り込み」ボタンのみがトリガー)。`runImport()`(`src/sync/importEngine.ts`)が `workerSheetsTransport.pull()` → `GET /api/import-sheets`(`worker/sheetsImport.ts`)経由で8タブ(体重・食事・水分・筋トレ・日記+Garmin由来の活動記録+食事マスタ・種目マスタ)の全行をレコードに逆変換して受け取り、**追加のみ・ローカル優先**でマージする(既存キー・削除トゥームストーン保留中のキーはスキップ。取り込んだレコードは `synced: true` で保存し再送信しない)。例外は活動記録で、アプリ内に編集・削除が無くGarminが真実の情報源のため、常にシート側の値で上書きする(Issue #81)。マスタ2タブ(Issue #96)はIDが違っても同名(前後空白無視)の既存品目・種目をスキップする — 種目マスタは名前がサジェストのキーで同名を許さないため。Worker側は、ID列が空の行(手入力の過去データ)にIDを採番して(体重・日記=日付、食事・水分・筋トレ・マスタ=UUID)**シートに書き戻す** — 書き戻せないと以後のupsert・行削除がその行を見つけられず重複行を生むため、書き戻し失敗は取り込み全体の失敗にする。行パース(`planWeightImport`/`planMealImport` ほか)は純関数として切り出してあり単体テストがある。シートに無い情報(食事のAI推定値・写真参照、設定)は復元されない。

`notConfiguredTransport` は `runSync()`/`runImport()` の引数無しデフォルトのままで、常にthrowするだけのプレースホルダー(テストでも「デフォルトは未設定エラーになる」ことの検証に使われている)。実際に使われるのは `workerSheetsTransport`(`src/sync/workerSheetsTransport.ts`)で、`App.tsx`(起動時の自動同期)と設定画面の `SheetsSyncCard.tsx`(「今すぐ同期」「シートから取り込み」ボタン)からは `runSync({ transport: workerSheetsTransport })` / `runImport({ transport: workerSheetsTransport })` の形で明示的に渡している。

`workerSheetsTransport` は `POST /api/sync-sheets`(`worker/sheetsSync.ts`)を叩く。Workerはサービスアカウントの秘密鍵からJWTを組み立てて署名し(`worker/googleSheetsAuth.ts`、Web Crypto APIの `crypto.subtle` を使用。Node/ブラウザのcryptoライブラリは使わない)、Google OAuth2のJWT Bearerフローでアクセストークンを取得したうえで、Google Sheets API(`values.append`・`values:batchUpdate`・`spreadsheets:batchUpdate` の `deleteDimension`。詳細は上記の編集・削除の反映を参照)を呼び出す。認証情報(`GOOGLE_SERVICE_ACCOUNT_EMAIL`・`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`・`GOOGLE_SHEETS_SPREADSHEET_ID`)はWorkerのシークレットとしてのみ保持し、クライアントには渡さない。

全 `/api/*` エンドポイントは共有トークン認証で保護される(Issue #87、`worker/auth.ts`): Workerのシークレット `API_AUTH_TOKEN` が設定されている場合、クライアントは設定画面で入力したAPIトークン(`Settings.apiToken`)を `Authorization: Bearer` ヘッダで送る必要がある(付与は `src/api/apiAuth.ts` のヘルパー経由)。`API_AUTH_TOKEN` 未設定なら認証を要求しない(ローカル開発・移行期間用)。新しいAPIエンドポイント・API呼び出しを追加する際もこの仕組みに乗せること。

**同期先はアプリのデータモデル専用に新規作成したスプレッドシート(体重記録・食事記録・水分記録・筋トレ記録・日記記録の5タブ+Garmin連携が書き込む活動記録タブ+食事マスタ・種目マスタの2タブ)であり、今使っている手動運用の既存スプレッドシートではない。** マスタ2タブは後付け(Issue #96)のため、同期時にタブが無ければWorkerが見出し行付きで自動作成する(記録タブは手動作成が前提のまま)。 検討の結果、既存の手動運用シートは「1日1行、その日の食事の合計カロリー/PFC」という集計形式で、アプリの `MealRecord`(1食事=1レコード、1日に複数件記録しうる)とは粒度が異なることが分かった。既存シートに合わせるには「日付で行を検索→既存の値と合算→上書き」という集計取り込みロジックが必要になり、「レコード単位で一方向に反映する(1レコード=1行、ID列で upsert・削除)」という現在の設計と相性が悪いため、新規スプレッドシートを採用した(Issue #3)。

### Garmin連携(`scripts/garmin/`、`.github/workflows/garmin-sync.yml`)

GitHub Actionsのcron(毎日3:00 JST)が `python-garminconnect`(非公式API)で前日の活動データ(歩数・消費カロリー・睡眠・安静時心拍など)を取得し、同期用スプレッドシートの「活動記録」タブへ日付キーでupsertする。アプリ・Workerのコードとは独立しており、認証情報はGitHub Secrets(GarminトークンはActionsキャッシュで持ち回り)。列構成・セットアップ・トークン運用は `scripts/garmin/README.md` が正。経緯はIssue #11(検討)・#80(実装)、アプリ側への取り込みは #81・#82。

### UI(`src/pages/`、`src/components/`)

ファイル配置は画面単位: 特定の画面からしか使わないコンポーネントは、その画面のディレクトリ(`src/pages/home/`、`src/pages/trends/`、`src/pages/meal/`、`src/pages/settings/`)に置く。`src/components/` に置くのは複数画面で共有するもの(`icons.tsx`・`BottomNav`・`RecordHeader`・`RecordSaveFooter`・`SectionLabel`・`SegmentedControl`・`PaginationControls`・`MoodIcon`)だけで、複数画面で共有するReactフック(検索+ページ分割の `usePagedFilter` など)は `src/hooks/` に置く。ルートコンポーネントは `〜Page` という命名(`HomePage.tsx` など)で、ルーティングは `App.tsx` にある。単一ファイルで完結する記録系ページ(体重・水分・日記・筋トレ)は `src/pages/` 直下のフラット配置のまま。

クライアントの状態は、React state + 手動再取得ではなく `dexie-react-hooks` の `useLiveQuery` から得ている — IndexedDBのテーブルが変化すると、ページは自動的に再レンダリングされる。

**注意点:** `useLiveQuery` は「まだロード中」と「`undefined` に解決した」を区別できない。空のDexieテーブルに対する `.first()`/`.last()` は `undefined` に解決するため、`db.weightRecords.orderBy("date").first()` のようなクエリは、記録が1件も無い新規ユーザーの場合、ローディング分岐から永久に抜け出せなくなる — クエリが「完了した」というシグナルを一切出さないまま止まる。このコードベース全体で使われている対処法は、クエリ関数からの戻り値を返す前にそれらの結果を `null` に正規化し(`TrendsPage.tsx` を参照)、`undefined` だけを「まだロードされていない」として扱うこと。「見つからない」に正当に解決しうる新しい `useLiveQuery` 呼び出しには同じパターンを適用すること。

グラフ(`src/pages/trends/charts/`)はチャートライブラリではなく、手書きのSVG — これは意図的なもので、ライブラリのデフォルトと戦うのではなく、デザインガイドのパレットを厳密にコントロールするため。

### デザインシステム上の制約

UIはMUIで、`src/theme.ts` がデザインガイドのパレットをMUIテーマ(`palette.primary`/`secondary` など)とハンドオフモック由来のデザイントークン(`tokens`)として、フォントを(`fontRounded` = 数字・見出し用のM PLUS Rounded 1c、`fontBody` = Noto Sans JP)として登録している(Tailwindは使っていない — MUI移行 Issue #27 で廃止済み)。**`accent`(黄色)はデザインガイドにおいて「達成の瞬間」の演出(目標達成、連続記録など)専用に予約されており、誤用を防ぐためMUIのpaletteには載せず `theme.ts` の独立した `accent` トークンとして隔離してある** — 基準線やバッジのような常時表示の静的UIに使ってはならない。グラフの目標線がまさにこの理由でミュートグレーになっている。デザインガイドの根拠を読み直さずにaccentへ変更しないこと。

**絵文字は使わない。アイコンは必ず `src/components/icons.tsx` のSVGコンポーネントを使う。** 同ファイルの既存アイコン(ストローク1.6〜1.9・丸みのあるlinecap/linejoin)と同じ手描きスタイルで揃え、`color: currentColor` を継承させて親要素の色指定で色を変えられるようにする(個別に色をハードコードしない)。新しい用途のアイコンが無ければ同ファイルに追加してから使うこと。

### PWA

`vite-plugin-pwa`(`vite.config.ts` を参照)がビルド時にマニフェストとService Workerを生成する — アイコン以外、手作業でメンテナンスするものはない。

アイコンの正はベクター素材の `docs/icon/icon_master.svg`(1024px、クリーム `#FFF8F0` の角丸背景 + プライマリ `#FF6B4A` のマーク)で、`public/icons/` のPNG(`icon-192` / `icon-512` / `icon-512-maskable` / `apple-touch-icon`)はそこから書き出したもの。PNGを直接編集せず、マスターSVGを直してから書き出し直すこと。`icon-512-maskable` と `apple-touch-icon` は、OS側が独自にマスクをかけるため**角丸を付けず全面をクリームで塗り**、maskableはさらに中央80%のセーフゾーンに収まるようマークを縮小してある。`public/icons/icon.svg` はマスターSVGのコピーで、ファビコン(`index.html` の `rel="icon"`)として使っている。

### デプロイ

Cloudflare Workers(クラシックな別サービスの「Pages」ではなく、Git連携版)上で https://lifelog.tatu1228.workers.dev/ にホストされており、`main` へのpushで自動デプロイされる。ビルドコマンドは `npm run build`、デプロイコマンドは `npx wrangler deploy` で、`wrangler.toml` の `[assets]` ブロック(`directory = "dist"`、SPAルーティング用に `not_found_handling = "single-page-application"`)で駆動されている。

**`public/_redirects` ファイルを追加しないこと** — `not_found_handling = "single-page-application"` と組み合わせると、CloudflareはSPAフォールバックの処理をどちらも試みるものとみなし、無限リダイレクトループとしてデプロイを拒否する。`[assets]` の設定だけで十分であり、現在デプロイされているのもこの構成。

`npm run deploy` はローカルで同じbuild+deployを実行するが、事前に `wrangler login` が必要(このサンドボックス化された開発環境ではセットアップされていない — 特に指示が無い限り未認証だと想定すること)。

**デプロイパイプラインに自動テストのゲートは無い**(`npm run test` が失敗していてもビルドさえ通れば本番へデプロイされる)。GitHub Actions移行によるテストゲート導入は検討したが、個人開発・単一ユーザー向けというプロジェクト規模には見合わないと判断し対応不要とした(Issue #18、からだログ_意思決定ログ.md参照)。デプロイ前に `npm run test` / `npm run build` をローカルで確認する運用でカバーする。
