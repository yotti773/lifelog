# からだログ

体重・食事(カロリー/PFC)・水分・筋トレ・日記を記録し、週次レビューとAIコーチングで振り返るローカルファーストの PWA。

要件・画面仕様・デザインガイドは [`docs/`](./docs) が正、実装方針や設計判断の背景は [`CLAUDE.md`](./CLAUDE.md) にまとまっている。

## 主な機能

- **体重記録**: 日々の体重・体脂肪率を記録し、推移グラフと目標(基準日→目標体重)の進捗バー・着地予測を表示
- **食事記録**: 写真を撮影 → Cloudflare Workers 経由で Google Gemini API(Vision)がカロリー・PFC(たんぱく質/脂質/炭水化物)を品目ごとに推定 → 手動で修正・確定。手入力・食事マスタ(よく食べるものの選択入力)にも対応
- **水分・筋トレ・日記**(フェーズ2): クイックタップの水分記録、セット単位の筋トレ記録(種目マスタ付き)、気分タグ付きの1日1件の日記
- **パーソナルコンサルティング**(フェーズ3): 身体プロフィールからの目標カロリー自動計算、実測TDEE推定(逆算)、週次レビュー、記録率の可視化、PFC目標、AIコーチのコメント(Gemini 軽量モデル)
- **データ同期**: IndexedDB に保存した未同期の記録を、オンライン時に Cloudflare Workers 経由で Google Sheets(専用の新規スプレッドシート)へ書き出し(ID列キーの upsert+削除反映)。「シートから取り込み」で復元・過去データ移行も可能
- **Garmin連携**: GitHub Actions が毎日 Garmin の活動データ(歩数・消費カロリー・睡眠など)をスプレッドシートへ書き込み、アプリへ取り込んで履歴・推移グラフ・週次レビューに統合
- **PWA**: オフラインでも記録可能、ホーム画面に追加してアプリのように利用可能

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React + Vite + TypeScript、MUI(カスタムテーマ `src/theme.ts`) |
| データ保存 | Dexie(IndexedDB)によるローカルファースト保存 |
| AI(写真判定・週次コメント) | Cloudflare Workers を中継役に Google Gemini API を呼び出し |
| シート同期 | 同じ Workers 中継から Google Sheets API(サービスアカウント認証) |
| Garmin連携 | GitHub Actions(cron)+ `python-garminconnect` |
| ホスティング | Cloudflare Workers(Git 連携、`main` push で自動デプロイ) |
| テスト | Vitest + fake-indexeddb |

採用理由・トレードオフは [要件定義書](./docs/からだログ_要件定義書.md) の 6 章と [意思決定ログ](./docs/からだログ_意思決定ログ.md) を参照。

## ディレクトリ構成

```
src/
  db/         Dexie スキーマとエンティティごとの CRUD 関数(体重・食事・水分・筋トレ・日記・活動記録・マスタ・設定など)
  sync/       スプレッドシート同期/取り込みエンジン(トランスポート非依存)
  lib/        純関数ロジック(週次ダイジェスト・TDEE・着地予測・日付処理など)
  pages/      画面単位のコンポーネント(home / trends / meal / settings + 単一ファイルの記録ページ)
  components/ 複数画面で共有する UI 部品(アイコン・ナビ・共通レイアウト)
  hooks/      共有 React フック
worker/       Cloudflare Workers: 静的アセット配信 + /api/judge-meal(写真AI判定)
              + /api/sync-sheets(同期) + /api/import-sheets(取り込み) + /api/weekly-advice(AIコーチング)
scripts/garmin/ Garmin→スプレッドシートの日次同期スクリプト(GitHub Actions から実行)
docs/         要件定義書・画面設計書・デザインガイド・AIコンサルティング設計書・意思決定ログ
```

## セットアップ

```
npm install
cp .dev.vars.example .dev.vars   # GEMINI_API_KEY・Google Sheets関連の値を設定(Worker のローカル実行に必要)
```

## 開発コマンド

```
npm run dev              # Vite 開発サーバー起動(localhost:5173)
npm run build            # tsc -b && vite build(PWA の Service Worker も生成)
npm run test             # vitest run(全テスト)
npx vitest run <path>    # 単一テストファイルのみ実行
npm run preview          # 本番ビルドをローカルで確認(実際の PWA/インストール挙動の確認用)
npm run worker:dev       # wrangler dev で Worker(/api/* を含む)をローカル実行
```

`npm run lint` は package.json に定義されているが ESLint 未導入のため動作しない。

## デプロイ

Cloudflare Workers(Git 連携)で `main` ブランチへの push を契機に自動デプロイされる。手元から反映する場合は `npm run deploy`(要 `wrangler login`)。詳細は `wrangler.toml` および `CLAUDE.md` の「デプロイ」を参照。

## 開発状況・残タスク

フェーズ1(体重・食事・シート同期)、フェーズ2(水分・日記・筋トレ)、フェーズ3(パーソナルコンサルティング)、Garmin連携まで実装済み。残っているタスクは GitHub Issues で管理している。詳細は [Issues](../../issues) を参照。
