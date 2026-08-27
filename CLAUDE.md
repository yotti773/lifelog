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

`docs/` 直下は上記の `からだログ_*.md` 仕様書群・検討メモのみ(過去IssueからのリンクとCLAUDE.md・`content-ops` からのパス参照が多いため動かさない。Issue #191)。仕様書以外はサブフォルダに置く: `docs/icon/`(PWAアイコンの正、下記PWA節参照)、`docs/screenshots/`(動作確認スクリーンショット)、`docs/data/`(シート貼り付け用サンプルCSV)、`docs/archive/`(設計フェーズのデザインハンドオフ資料など、現役でない過去資料)。

**発信(note / Zenn / X)は別リポジトリ `yotti773/content-ops` にある。** 記事の下書き・X投稿の運用ファイル・画像・それらのスクリプトはすべてそちらで、このリポジトリには置かない(2026-08-10に `articles/` と `scripts/x/` を移設。経緯は `docs/からだログ_意思決定ログ.md`)。記事は仕様の真実の情報源ではないため、レビューチェックリストのドキュメント整合チェックの対象外。記事側の判断がプロダクトに影響する場合(マネタイズの需要検証など)は、`docs/からだログ_マネタイズ検討メモ.md` 側に書き戻す。

## コマンド

```
npm run dev       # Vite開発サーバーを起動(localhost:5173)
npm run build     # tsc -b && vite build(PWAのService Workerも生成される)
npm run test      # vitest run(ユニットテスト全実行。e2e/は含まない)
npx vitest run src/db/__tests__/weightRecords.test.ts   # 単一テストファイルの実行
npm run e2e       # playwright test(E2Eスモーク。devサーバーは自動起動される)
npx playwright test e2e/weight.spec.ts   # 単一E2Eファイルの実行
npm run preview   # 本番ビルドをローカルで配信(実際のPWA/インストール動作の確認に必要)
```

`npm run lint` は package.json に定義されているが、ESLintは実際にはインストール・設定されていない — 当てにしないこと。

### テストの構成(Issue #198)

- **ユニットテスト(vitest)** — `src/**/__tests__/`・`worker/__tests__/`。データ層は `fake-indexeddb` で実Dexieを動かし、ロジック・同期・行パースは純関数として検証する。ブラウザは使わない。
- **E2Eスモーク(Playwright)** — `e2e/`。ユニットで見えない結線(ルーティング・`useLiveQuery`・フォーム→IndexedDB)を、クリティカルフロー(体重・食事・水分・日記・レビュー・完全バックアップの復元)に絞って確認する。**Worker必須の機能(シート同期・AI生成)はE2Eの対象外** — そこはユニットのfetchモックで担保済みで、E2Eに持ち込むと認証情報が要るため。
- 初回は `npx playwright install chromium` が必要。標準の場所にChromiumが無い環境では `PLAYWRIGHT_CHROMIUM_PATH` にパスを渡す。
- **E2Eは `npm run test` に含めない**(実行に数分かかるため)。
- 個々のUI変更を目視で確認したい場合は、E2Eスイートとは別に `npm run dev` + Playwrightのアドホックなスクリプトで操作してよい(スクリーンショット確認など)。

**CIチェック(`.github/workflows/ci.yml`、Issue #201):** PR作成時と `main`・`epic/**` へのpushで、`npm run test` / `npm run build` / `npm run typecheck:worker` が自動実行される。**これはPRの品質シグナルであってデプロイのゲートではない** — 本番デプロイは従来どおりCloudflareのGit連携が行い、CIが落ちてもデプロイは止まらない(デプロイ自体をActionsへ移す案は見送っている。Issue #18)。**E2EはCIに入れていない**ため、下記の通りローカルで実行すること。

## 開発フロー

作業は別のバックログドキュメントではなく GitHub Issue で管理する — リポジトリの Issues タブが「何が残っているか」の唯一の情報源。各Issueは、元になった `docs/`(要件定義書・画面設計書)の該当箇所にリンクしている。

- **非自明な作業は着手前にIssueを立てる。** 自分一人で作業する場合でも同様。`docs/` での意思決定とそれを実装したコードの対応関係をたどれるようにし、後続のセッション(人間・Claudeどちらも)が仕様書を読み直さなくても「なぜ」を把握できるようにするため。
- **新規画面の追加や大きなレイアウト変更を伴う場合、実装前の画面設計のタイミングでArtifactツールを使ってHTMLモックアップを作成し、レイアウト・配色案を確認する。** テキストの画面設計書だけでは見た目の合意が取りにくいため。モックアップは実装前の意思決定用であり、実装そのものの代わりにはならない — 実際のMUIテーマ・実データでの見え方は、次の項目の通り `npm run dev` + Playwrightで別途確認する。
- **新しい作業ブランチを作成する際は、まず `git status` で作業ツリーがクリーンであることを確認し、`git checkout main && git pull --ff-only origin main` でローカルmainを最新化してから、そこから作業ブランチを切る。** mainに未コミットの変更がある、または`--ff-only`が失敗する(ローカルmainが分岐している)場合は、最新化を強行せずユーザーに確認する。古いmainから作業ブランチを切ると、並行してマージされた変更を見落としたまま実装・PR作成してしまう。
- **PR作成前に、ローカルで次を実行して通ることを確認する(必須)。** CIは同じ内容をPR作成後に回すが、push前に気づけるようローカルでも必ず流す。
  - `npm run test` と `npm run build`(全変更で必須)
  - `npm run typecheck:worker`(`worker/` を触った場合。`tsc -b` の対象外のため)
  - **`npm run e2e`(画面・ルーティング・データ層に影響する変更をした場合は必須)。** E2EはCIに含めていないため、ここで流さないと誰も流さない。数分かかるので、ドキュメントのみの変更やWorker内部だけの変更では省いてよい。
- UI変更であれば、上記に加えて上記コマンド節の通りPlaywrightで見た目を目視確認する。
- **仕様に影響する変更を実装したら、対応する `docs/` の仕様書へ書き戻す(必須)。** 画面の挙動・データモデル・同期・意思決定に関わる変更は、実装だけで終わらせず該当する仕様書本文(画面設計書・要件定義書など)を現在の仕様に更新し、見送っていた論点を実装した場合は12章などの論点リストと `docs/からだログ_意思決定ログ.md` に経緯を残す。仕様書が真実の情報源であり、コードと乖離させない。純粋なバグ修正・リファクタなど仕様に影響しない変更は書き戻し不要(その旨を判断できるよう、影響有無は毎回確認する)。
- **PR作成前にレビューを行う(必須)。** `docs/からだログ_レビューチェックリスト.md` の観点(特に「5. UIコードのレビュー観点」「4. コード不変条件チェック」)で自分の変更を点検する。まとまった変更では `/code-review` skill を併用してよい。指摘は修正するか、対応しない場合は理由を残す。
- **Issueが完了したらPRを作成する。** PR本文で該当Issueを参照し(例: `Closes #6`)、マージ時に自動クローズされるようにする。PRを介さず `main` へ直接マージしない — PRは「何を・なぜ変更したか」の記録になる。
- **複数のIssueが揃って初めて意味を持つ機能群は、エピックブランチ(`epic/<名前>`)にまとめる。** 子IssueのPRはmainではなくエピックへ向け、**関連Issueが全て完了してからエピックをmainへマージする**。現在のエピック: `epic/distribution`(数人への配布版 #213 の子Issue群 #214〜#219)。中途半端な状態が本番へ出るのを防ぐための運用で、単独で完結するIssueは従来どおりmainへ直接PRを出してよい。
  - エピックブランチもCIの対象(`.github/workflows/ci.yml` の `epic/**`)。`pull_request` のトリガー判定は**ベースブランチ側**のワークフロー定義で行われるため、この設定はエピックブランチ自身に入っている必要がある
  - 子PRを重ねる間にmainが進んだら、エピックへmainを取り込んでから続ける(エピックが古いmainのまま育つと、最後のマージでまとめて衝突する)
- **PRのマージはユーザーの明示的な指示(例:「マージして」「PR #29をマージして」)を受けてから `gh pr merge --squash` で行う。** PRはこのリポジトリのGitHubアカウント自身が作成するため、GitHub上の正式なApprove機能は使えない(自分が作成したPRは自分でApproveできない、というGitHub側の固定仕様)。そのためレビュー完了の合図はチャット上のユーザーの明示的な指示とし、指示なしに自発的にマージしない。マージ方式は常にsquash(PR内の複数コミットをmainに1つにまとめる)。
- **PRがマージされたら作業ブランチを削除する。** リモート側はリポジトリ設定(`Settings → General → Pull Requests → Automatically delete head branches`、API上は`delete_branch_on_merge`)を有効にしてあるため、マージ時に自動削除される。ローカル側は自動化されないため、マージ確認後に `git checkout main && git pull --ff-only origin main && git branch -d <ブランチ名>` で手動削除する。
- **Issue作成時は `優先度: 高` / `優先度: 中` / `優先度: 低` のいずれかを付ける。** 判断基準は `docs/からだログ_要件定義書.md` 3章のMVP優先表(体重・食事記録が最優先、筋トレは後回し)および各章の「フェーズ2」「検討する」といった記述に沿う — 減量目標(10月末)に直結するMVPコア機能ほど高く、フェーズ2以降の拡張機能や検討中の論点ほど低くする。
- **Issue作成時は優先度に加えてカテゴリラベル(`bug` / `ux` / `mastery` / `tech`)も1つ付ける(Issue #108)。** `bug` = データ同期失敗・UI崩れ・予期しない動作、`ux` = 情報の見せ方や操作手順の改善要望、`mastery` = 食事・種目マスタの登録やカテゴリ分類の見直し、`tech` = ドキュメント更新・依存更新・デバッグ利便性などの技術改善。GitHubのWeb画面から作る場合は `.github/ISSUE_TEMPLATE/` のテンプレートがラベルを自動付与するが、`gh issue create` はテンプレートを経由しないため `--label` で明示的に付けること。

## アーキテクチャ

### データ層(`src/db/`)

DexieでIndexedDBをラップしている。`db.ts` がスキーマを定義し、エンティティごとに1ファイル(`weightRecords.ts`、`mealRecords.ts`、`waterRecords.ts`、`workoutRecords.ts`、`diaryRecords.ts`、`activityRecords.ts`、`settings.ts` など)がプレーンな非同期CRUD関数をexportする — リポジトリクラスやDexie自体を超えたORM的な抽象化はない。

型だけからは分かりにくい、モデリング上の重要な選択:
- **`WeightRecord` は `date`(YYYY-MM-DD)をDexieの主キーにしている。** これにより「1日1件、後勝ち」が自動的に成立する — `saveWeightRecord` は `.put()` を呼ぶだけで、手動の上書きロジックは不要。
- **`MealRecord` は生成したUUIDをキーにしている。** 同じ日の同じ `mealType` に複数件の記録が許されるため(例: 間食を2回記録するなど)。
- **すべてのレコードが `synced: boolean` を持つ。** `saveWeightRecord`/`updateWeightRecord`/`updateMealRecord` は、レコードの内容が変わるたびにこれを `false` にリセットする。これにより、同期後の編集も再度拾われる。`markWeightRecordsSynced`/`markMealRecordsSynced`、およびシート由来のレコードを保存する `runImport`/`runActivityImport`(下記の取り込みを参照)以外の場所で `synced: true` を直接セットしないこと。
- **`getUnsyncedWeightRecords`/`getUnsyncedMealRecords` はDexieのインデックスではなくJS側の `.filter()` で絞り込んでいる** — IndexedDBはbooleanをインデックスのキーにできないことと、レコード件数がこの規模(単一ユーザー、1日あたり数件)では十分軽いため、これで問題ない。これをインデックス化して「最適化」しないこと。
- `getDailyCalorieTotals(startDate, endDate)` は、食事記録が無い日でも範囲内の全日を `0kcal` で埋める — これにより、カロリー推移グラフが記録の空白を誤魔化して圧縮された線ではなく、隙間として表示される。

**AIコメントの同期(Issue #164):** 週次・月次のAIコメント(`adviceRecords`/`monthlyAdviceRecords`)は**スプレッドシート同期の対象**。生成が非決定的で再生成しても同じものが出ず、失うと復旧手段が無い唯一のデータのため。**シートに載せるのは `advice`(判定・総評・良かった点・アクション)だけで、`digest` は載せない** — digestはレコードから再計算でき(`getWeeklyDigest()`)、実際に画面のどこからも参照されていないため。`AdviceRecord.digest` が任意になっているのはこのため(シート由来のレコードでは未設定)。判定は日本語ラベル(順調/やや遅れ/遅れ/要注意)でシートに書き、取り込み時に `VERDICT_FROM_LABEL` で逆引きする。削除UIが無いため削除トゥームストーンの仕組みには乗せていない。

**設定の同期(Issue #164):** 設定(`Settings`)もシート同期の対象で、1設定=1行の key-value 形式で「設定」タブに書く(`src/sync/settingsSync.ts` の `SETTINGS_SYNC_FIELDS` と `src/sync/sheets/sheetsSync.ts` の `SETTINGS_FIELDS` を**手で同期させること**。#215 で同じビルドに入ったので、いずれ片方に寄せられる)。**`apiToken` は載せない** — 取り込みAPIの呼び出し自体に `Authorization: Bearer` としてこの値が要るため、シートからは原理的に復元できない。`lastSyncedAt` も端末固有なので載せない。`SettingsRow.synced` で差分同期し、**`lastSyncedAt` だけの更新では未同期に戻さない**(同期完了のたびに書くため、戻すと永久に同期待ちになる)。

**完全バックアップ(`src/db/backup.ts`、Issue #164):** 上記でAIコメントと設定は同期されるようになったため、**シート同期で戻せないのは食事のAI推定値・写真参照と`apiToken`だけ**になった。これを埋めるのが設定画面の「完全バックアップ(ファイル)」で、`syncDeletions` を除く全テーブルを1つのJSONに書き出し、全削除+書き戻しで復元する。**`BACKUP_TABLES` に新しいテーブルを足し忘れると `backup.test.ts` が落ちる**(`db.tables` と突き合わせている) — フェーズ1時代の実装が3テーブルのまま腐っていた実績があるため、この番人を外さないこと。復元は必ず `parseBackupData()` の検証を通してから行う(旧実装は壊れたファイルでも `clear()` してしまう作りだった)。**IndexedDBはオリジン単位なので、配信URLを変えるときも退避が必要**(同じブラウザでもデータは引き継がれない)。

テストは `fake-indexeddb/auto`(`src/db/__tests__/setup.ts` を参照。`vitest.config.ts` の `setupFiles` で組み込まれている)を使っており、データ層全体をブラウザ無しでNode上でテストしている。`beforeEach` で各テーブルを直接クリアする(`db.weightRecords.clear()` など)— 共通のテストDBリセットヘルパーは無く、各テストファイルが自分の使うテーブルをクリアする。

### 同期エンジン(`src/sync/`)

`runSync()`(`syncEngine.ts` 内)はトランスポート非依存: 未同期のレコードと**削除トゥームストーン**(`src/db/syncDeletions.ts`、後述)を取得し、`SyncTransport.push()` を呼び、トランスポートが成功を報告したレコードだけを同期済みにする(部分的な成功は想定内で、ハンドリングされている)。何らかのエラーがthrowされた場合、何も同期済みにされず、エラーは呼び出し元に伝播する — これがリトライの仕組みであり、別途リトライキューは存在しない。

**編集・削除の反映(Issue #30):** 追記のみだと、同期済みレコードを編集すると新しい行が重複して増え、削除はスプレッドシートに残り続ける。これを防ぐため、(1) 編集は `synced: false` に戻る性質をそのまま使い、**ID列をキーに既存行を特定して上書き**(無ければ追記)する upsert にした(タブごとのID列は `src/sync/sheets/sheetsSync.ts` の `*_CONFIG` が正)。(2) 削除は `deleteWeightRecord`/`deleteMealRecord` が `syncDeletions` テーブルに**トゥームストーン**(対象タブとID列の値)を残し、次回同期で該当行を `deleteDimension` で物理削除する。削除確定後にトゥームストーンを消す。体重は主キーが日付のため、削除した日付を再登録したら `saveWeightRecord` が保留中のトゥームストーンを取り消す(`cancelDeletion`)。`src/sync/sheets/sheetsSync.ts` の `planUpserts`/`planRowDeletions` は純関数として切り出してあり単体テストがある。

**取り込み(Issue #54):** シート→アプリ方向の手動インポート(設定画面の「シートから取り込み」ボタンのみがトリガー)。`runImport()`(`src/sync/importEngine.ts`)が `googleSheetsTransport.pull()`(`src/sync/sheets/sheetsImport.ts`)が Google Sheets API から直接**全タブ**(一覧は `src/sync/sheets/sheetsImport.ts` の `pullFromSheets` が正)の全行をレコードに逆変換して受け取り、**追加のみ・ローカル優先**でマージする(既存キー・削除トゥームストーン保留中のキーはスキップ。取り込んだレコードは `synced: true` で保存し再送信しない)。例外は活動記録で、アプリ内に編集・削除が無くGarminが真実の情報源のため、常にシート側の値で上書きする(Issue #81)。マスタ2タブ(Issue #96)はIDが違っても同名(前後空白無視)の既存品目・種目をスキップする — 種目マスタは名前がサジェストのキーで同名を許さないため。ID列が空の行(手入力の過去データ)にはIDを採番して(体重・日記=日付、食事・水分・筋トレ・マスタ=UUID)**シートに書き戻す** — 書き戻せないと以後のupsert・行削除がその行を見つけられず重複行を生むため、書き戻し失敗は取り込み全体の失敗にする。行パース(`planWeightImport`/`planMealImport` ほか)は純関数として切り出してあり単体テストがある。シートに無い情報(食事のAI推定値・写真参照、設定)は復元されない。

**活動記録の自動取り込み(Issue #133):** 上記の手動取り込みとは別に、活動記録タブ**だけ**は自動同期のたびに取り込む。`runActivityImport()`(`src/sync/importEngine.ts`)が `googleSheetsTransport.pullActivity()`(`src/sync/sheets/sheetsImport.ts` の `pullActivityFromSheets`)が活動記録タブ1枚だけを読み取り(全タブを読む `pullFromSheets` と分けた軽量版)、`runImport` の活動記録と同じく常にシート側で上書きして `synced: true` で保存する。`createAutoSyncRunner` の既定動作 `runAutoSync` が push(`runSync`)に続けてこれを呼ぶ。取り込みはベストエフォートで、`runActivityImport` はthrowせずエラーを返すため push の成功を打ち消さない。手動の「今すぐ同期」ボタンは push のみ、全タブの取り込みは引き続き「シートから取り込み」ボタンのみ。

`notConfiguredTransport` は `runSync()`/`runImport()`/`runActivityImport()` の引数無しデフォルトのままで、常にthrowするだけのプレースホルダー(テストでも「デフォルトは未設定エラーになる」ことの検証に使われている)。実際に使われるのは `googleSheetsTransport`(`src/sync/googleSheetsTransport.ts`)で、`App.tsx`(自動同期)と設定画面の `SheetsSyncCard.tsx`(「今すぐ同期」「シートから取り込み」ボタン)からは `runSync({ transport: googleSheetsTransport })` / `runImport({ transport: googleSheetsTransport })` の形で明示的に渡している。自動同期のトリガーは起動時・アプリ復帰時(`visibilitychange`)・オンライン復帰時(`online`)の3つ(Issue #105)で、そのたびに push と活動記録の取り込み(上記)の両方を行う。短時間の連続発火を防ぐスロットリング(最小間隔5分)と実行中の再入抑止は `src/sync/autoSync.ts` の `createAutoSyncRunner` が持つ(手動ボタンは対象外)。

**Google Sheets API はブラウザから直接叩く(Issue #215)。** `googleSheetsTransport` が `src/sync/sheets/` の `pushToSheets`/`pullFromSheets`/`pullActivityFromSheets` を呼び、それぞれが Sheets API(`values.append`・`values:batchUpdate`・`spreadsheets:batchUpdate` の `deleteDimension`)を叩く。必要なものは access token(#214 のユーザー自身の認可)と `Settings.spreadsheetId`(#216 でアプリが作成したシート)の2つで、**どちらかが無ければ通信する前にエラーにする**(未同期フラグは残るので後から同期できる)。

**この移設で、他人の健康データが開発者のインフラを一切通らなくなった。** Workerに残るのはAIの2本(週次・月次コメント)と写真判定だけで、そこへ送るのはダイジェストと写真に限られる — プライバシーポリシー(#238)の「記録はお預かりしません」はこの構成で初めて成立する。サービスアカウント経由の同期(`worker/sheetsSync.ts`・`worker/googleSheetsAuth.ts`・`/api/sync-sheets`・`/api/import-sheets`・`/api/import-activity`)は削除済み。**ただしGarmin連携は別経路で、いまもサービスアカウントを使う** — GitHub Actions の Secrets(`scripts/garmin/`)は消さないこと。

全 `/api/*` エンドポイントは共有トークン認証で保護される(Issue #87、`worker/auth.ts`): Workerのシークレット `API_AUTH_TOKEN` が設定されている場合、クライアントは設定画面で入力したAPIトークン(`Settings.apiToken`)を `Authorization: Bearer` ヘッダで送る必要がある(付与は `src/api/apiAuth.ts` のヘルパー経由)。`API_AUTH_TOKEN` 未設定なら認証を要求しない(ローカル開発・移行期間用)。新しいAPIエンドポイント・API呼び出しを追加する際もこの仕組みに乗せること。

**`API_AUTH_TOKEN` はカンマ区切りで複数指定できる(Issue #218)。** 配布先ごとに別のトークンを配れば、その1本をシークレットから外すだけで1人分だけ失効させられる(`parseAuthTokens` が分解し、いずれかに一致すれば許可)。**認証を要求しないのは「シークレット自体が無い(`undefined`)」ときだけで、シークレットは在るのに解釈できるトークンが0本(`""`・`","`・`"  "`)なら全拒否する** — 手編集で最後の1本を抜いた状態を「未設定」と同じ全許可にすると、失効させたつもりの操作でAPIが黙って全開放されるため。全員を止めたいときはシークレットを空にせず、誰にも渡していない新しい値に差し替える。発行・失効のUIやD1によるユーザー管理は作らない(Cloudflareのシークレットを手で書き換える運用。課金状態との突合は有料化に進むときの論点)。

**同期先は、アプリが利用者自身のGoogle Driveに新規作成するスプレッドシート(Issue #216)。** 設定画面の「スプレッドシートを作成」で作り、IDを `Settings.spreadsheetId` に保存する。**IDの手入力は用意しない** — `drive.file` スコープはアプリが作成したファイルにしかアクセスできず、他所で作られたシートのIDを入れてもGoogleが403を返すだけだから。タブの一覧・タブ名・ID列・列の並びは `src/sync/sheets/sheetsSync.ts`(`*_CONFIG`・`*_HEADER`・`*ToRow`)が正で、ここには再掲しない。**全タブを作成時に用意し、後から増えたタブは同期時に見出し行付きで自動作成する**(記録5タブが手動作成前提だったのは #216 まで。他人のDriveに置く以上、手動作成の前提は成立しない)。**活動記録タブだけはGarmin側(`scripts/garmin/garmin_to_sheet.py`)が作る** — 列構成の正があちらにあるため。 検討の結果、既存の手動運用シートは「1日1行、その日の食事の合計カロリー/PFC」という集計形式で、アプリの `MealRecord`(1食事=1レコード、1日に複数件記録しうる)とは粒度が異なることが分かった。既存シートに合わせるには「日付で行を検索→既存の値と合算→上書き」という集計取り込みロジックが必要になり、「レコード単位で一方向に反映する(1レコード=1行、ID列で upsert・削除)」という現在の設計と相性が悪いため、新規スプレッドシートを採用した(Issue #3)。

### AIへの送信の同意(`src/api/aiConsent.ts`、Issue #219)

配布(#213)に伴い、**AIへ送る前に利用者の同意を要求する**。健康データを第三者(GoogleのGemini API)へ送るため、無償配布でも省略しない。

- **歯止めは送信経路に置く。** `assertAiConsent()` を `judgeMealPhoto`・`requestWeeklyAdvice`・`requestMonthlyAdvice` の先頭で呼ぶ。画面側の分岐だけにすると、呼び出し口が増えたときに漏れる
- **同意を聞くのはUI側**(`useAiConsentGate`)。AI機能を使う直前にダイアログを出し、同意しなければ何も送らずに戻る。同意済みなら以後は聞かない
- **同意状態は `Settings.aiConsentAt`(同意日時)。シート同期には載せない** — 記録ではなく「この人が同意した」という事実のため。バックアップJSONには入る
- **同意しなくても記録・グラフ・同期は全部使える。** 止まるのはAI機能だけ
- ダイアログの文言はプライバシーポリシー(#238)4章と同じ内容に揃える。**片方だけ変えないこと**

### ユーザー自身のGoogle認可(`worker/googleOAuth.ts`・`src/api/googleOAuth.ts`、Issue #214)

配布版(#213)に向けて、同期先スプレッドシートを**各ユーザー自身のDrive**に置くための認可。サービスアカウント1つで全員分を書く現状(全員のデータが1枚のシートに混ざる)を置き換える。方式は検討メモ12.8の**案A**(Sheets APIはクライアント直・refresh tokenもクライアント保持)。

- **要求スコープは `drive.file` だけ。`spreadsheets` を足さないこと** — `drive.file` は非機微(non-sensitive)でGoogleのアプリ検証が必須にならないが、`spreadsheets` を足した瞬間に sensitive に落ちる。`worker/googleOAuth.ts` の `GOOGLE_OAUTH_SCOPE` が正で、テストが `spreadsheets` の混入を検出する
- **Workerが担うのはトークン交換だけで、健康データには触れない。** Googleは refresh token の発行・使用の両方で `client_secret` を要求し、PKCEでは代替できないため、client_secret を持つサーバ側の口が1つだけ必要になる。**refresh token は保存しない**(ステートレスな中継)
- **`/api/google-oauth/token` は実質「client_secret の代行窓口」。必ず共有トークン認証の内側に置く**(`worker/index.ts` のルーティング順)。認証の外に出すと、refresh token を盗んだ相手がここを叩いて代行させられる
- **refresh token は `googleAuth` テーブル(1行)に置き、シート同期にもバックアップにも載せない**(`BACKUP_EXCLUDED_TABLES`)。`Settings` に相乗りさせると同期先シートとバックアップJSONの両方へ流出する。access token は短命なため永続化せず、`src/api/googleOAuth.ts` がメモリで保持して期限切れ時に作り直す
- **失効は正常系として扱う**(6ヶ月未使用・ユーザーによる解除・認可の上限超過)。Workerが `code: "google_reauth_required"` 付きの401を返し、クライアントはそのときだけ保存済みトークンを捨てて未連携に戻す。**ステータスだけで判断しない** — 401は共有トークン認証(#87)の失敗でも返るため、`API_AUTH_TOKEN` の差し替え(#218の失効運用)やAPIトークンの打ち間違いで、無関係にGoogle連携まで失われる。**一時障害(502等)でも捨てない**
- **連携を解除したら `Settings.spreadsheetId` も一緒に捨てる。** シートは連携したアカウントのDriveにあり、別アカウントで連携し直すと `drive.file` では読めない。IDを残すと、二度と読めないシートを指したまま同期が失敗し続け、作り直す導線も出ない
- **配信URLを変えると、Google Cloud Consoleの「承認済みのリダイレクトURI」の更新も要る**(`/oauth/callback`)。IndexedDBがオリジン単位である件と同じ紐付きが認可にも及ぶ

### Garmin連携(`scripts/garmin/`、`.github/workflows/garmin-sync.yml`)

GitHub Actionsのcron(毎日3:00 JST)が `python-garminconnect`(非公式API)で前日の活動データ(歩数・消費カロリー・睡眠・安静時心拍など)を取得し、同期用スプレッドシートの「活動記録」タブへ日付キーでupsertする。アプリ・Workerのコードとは独立しており、認証情報はGitHub Secrets(GarminトークンはActionsキャッシュで持ち回り)。列構成・セットアップ・トークン運用は `scripts/garmin/README.md` が正。経緯はIssue #11(検討)・#80(実装)、アプリ側への取り込みは #81・#82。

### UI(`src/pages/`、`src/components/`)

ファイル配置は画面単位: 特定の画面からしか使わないコンポーネントは、その画面のディレクトリ(`src/pages/home/`、`src/pages/trends/`、`src/pages/meal/`、`src/pages/settings/`)に置く。`src/components/` に置くのは複数画面で共有するもの(`icons.tsx`・`BottomNav`・`RecordHeader`・`RecordSaveFooter`・`SectionLabel`・`SegmentedControl`・`PaginationControls`・`MoodIcon`・食事のkcal/PFC入力グリッド `NutrientFieldsGrid`・食事マスタのPFCサマリ表示 `PfcSummary`・記録フォームの項目ラベル `FieldLabel`・日付記録の「見つかりません」画面 `RecordNotFound`)だけで、複数画面で共有するReactフック(検索+ページ分割の `usePagedFilter`、日付キー記録画面の編集モード制御 `useDailyRecordEditor` など)は `src/hooks/` に置く。ルートコンポーネントは `〜Page` という命名(`HomePage.tsx` など)で、ルーティングは `App.tsx` にある。単一ファイルで完結する記録系ページ(体重・水分・日記・筋トレ)は `src/pages/` 直下のフラット配置のまま。

クライアントの状態は、React state + 手動再取得ではなく `dexie-react-hooks` の `useLiveQuery` から得ている — IndexedDBのテーブルが変化すると、ページは自動的に再レンダリングされる。

**注意点:** `useLiveQuery` は「まだロード中」と「`undefined` に解決した」を区別できない。空のDexieテーブルに対する `.first()`/`.last()` は `undefined` に解決するため、`db.weightRecords.orderBy("date").first()` のようなクエリは、記録が1件も無い新規ユーザーの場合、ローディング分岐から永久に抜け出せなくなる — クエリが「完了した」というシグナルを一切出さないまま止まる。このコードベース全体で使われている対処法は、クエリ関数からの戻り値を返す前にそれらの結果を `null` に正規化し(`TrendsPage.tsx` を参照)、`undefined` だけを「まだロードされていない」として扱うこと。「見つからない」に正当に解決しうる新しい `useLiveQuery` 呼び出しには同じパターンを適用すること。

グラフ(`src/pages/trends/charts/`)はチャートライブラリではなく、手書きのSVG — これは意図的なもので、ライブラリのデフォルトと戦うのではなく、デザインガイドのパレットを厳密にコントロールするため。

### デザインシステム上の制約

UIはMUIで、`src/theme.ts` がデザインガイドのパレットをMUIテーマ(`palette.primary`/`secondary` など)とハンドオフモック由来のデザイントークン(`tokens`)として、フォントを(`fontRounded` = 数字・見出し用のM PLUS Rounded 1c、`fontBody` = Noto Sans JP)として登録している(Tailwindは使っていない — MUI移行 Issue #27 で廃止済み)。**`accent`(黄色)はデザインガイドにおいて「達成の瞬間」の演出(目標達成、連続記録など)専用に予約されており、誤用を防ぐためMUIのpaletteには載せず `theme.ts` の独立した `accent` トークンとして隔離してある** — 基準線やバッジのような常時表示の静的UIに使ってはならない。グラフの目標線がまさにこの理由でミュートグレーになっている。デザインガイドの根拠を読み直さずにaccentへ変更しないこと。

**絵文字は使わない。アイコンは必ず `src/components/icons.tsx` のSVGコンポーネントを使う。** 同ファイルの既存アイコン(ストローク1.6〜1.9・丸みのあるlinecap/linejoin)と同じ手描きスタイルで揃え、`color: currentColor` を継承させて親要素の色指定で色を変えられるようにする(個別に色をハードコードしない)。新しい用途のアイコンが無ければ同ファイルに追加してから使うこと。

### PWA

`vite-plugin-pwa`(`vite.config.ts` を参照)がビルド時にマニフェストとService Workerを生成する — アイコン以外、手作業でメンテナンスするものはない。生成されるSWは precache と NavigationRoute だけを持ち、**`/api/*` の呼び出しは横取りしない**(APIの通信失敗はSWの仕業ではなく本物のネットワーク失敗、という切り分けの前提になる)。

**SWが壊れた場合の復旧経路は設定画面の「アプリのリセット」(`src/lib/appReset.ts`、Issue #203)。** SW登録解除とCache Storage削除だけを行い、**IndexedDBには触れない** — PWAのアンインストールはストレージごと消えることがあり、記録が全てIndexedDBにある本アプリでは危険なため、再インストールに頼らずに復旧できる経路として用意してある。ここでIndexedDBも消すように「整理」しないこと。

アイコンの正はベクター素材の `docs/icon/icon_master.svg`(1024px、クリーム `#FFF8F0` の角丸背景 + プライマリ `#FF6B4A` のマーク)で、`public/icons/` のPNG(`icon-192` / `icon-512` / `icon-512-maskable` / `apple-touch-icon`)はそこから書き出したもの。PNGを直接編集せず、マスターSVGを直してから書き出し直すこと。`icon-512-maskable` と `apple-touch-icon` は、OS側が独自にマスクをかけるため**角丸を付けず全面をクリームで塗り**、maskableはさらに中央80%のセーフゾーンに収まるようマークを縮小してある。`public/icons/icon.svg` はマスターSVGのコピーで、ファビコン(`index.html` の `rel="icon"`)として使っている。

### デプロイ

Cloudflare Workers(クラシックな別サービスの「Pages」ではなく、Git連携版)上で https://lifelog.n1lab.workers.dev/ にホストされており、`main` へのpushで自動デプロイされる。ビルドコマンドは `npm run build`、デプロイコマンドは `npx wrangler deploy` で、`wrangler.toml` の `[assets]` ブロック(`directory = "dist"`、SPAルーティング用に `not_found_handling = "single-page-application"`)で駆動されている。

**`public/_redirects` ファイルを追加しないこと** — `not_found_handling = "single-page-application"` と組み合わせると、CloudflareはSPAフォールバックの処理をどちらも試みるものとみなし、無限リダイレクトループとしてデプロイを拒否する。`[assets]` の設定だけで十分であり、現在デプロイされているのもこの構成。

**`run_worker_first` を配列にするなら `/api/*` を必ず含めること。** この値を配列にした時点で、Cloudflareは既定の暗黙ルーティング(Sec-Fetch-Modeを見て、アセットに無いパスをWorkerへ回す)をやめ、**書いたパスだけ**をWorkerへ通す。流入元ログ(Issue #251)のために `["/"]` としたところ、`/api/*` がアセット層で完結してWorkerのハンドラまで届かなくなり、POST(`/api/google-oauth/token`・`/api/judge-meal`)が失敗してシート同期とAI判定が本番で全滅した(2026-08-27、Issue #252)。画面にはWorkerが返すJSONの文言ではなく呼び出し元のフォールバック文言しか出ないため、症状からWorkerまで届いていないことが読み取れない。`worker/__tests__/wranglerRouting.test.ts` が番人。

`npm run deploy` はローカルで同じbuild+deployを実行するが、事前に `wrangler login` が必要(このサンドボックス化された開発環境ではセットアップされていない — 特に指示が無い限り未認証だと想定すること)。

**デプロイパイプラインに自動テストのゲートは無い**(`npm run test` が失敗していてもビルドさえ通れば本番へデプロイされる)。デプロイ自体をGitHub Actionsへ移してテストゲートを設ける案は、個人開発・単一ユーザー向けというプロジェクト規模には見合わないと判断し対応不要とした(Issue #18、からだログ_意思決定ログ.md参照)。**PRと `main` へのpushではCI(`.github/workflows/ci.yml`、Issue #201)がテスト・ビルドを回すが、これはデプロイに関与しない品質シグナルで、落ちてもデプロイは止まらない**(止めるにはブランチ保護でこのチェックを必須にする設定が別途要る)。上記テスト節の通り、PR前にローカルでも実行する運用と併せてカバーする。
