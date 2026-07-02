# ライフログ

体重・食事(カロリー/PFC)を記録するローカルファーストの PWA。2026/7/1〜2026/10/31 の減量目標(72kg→64kg)達成を最優先に開発している個人プロジェクト。

要件・画面仕様・デザインガイドは [`docs/`](./docs) が正、実装方針や設計判断の背景は [`CLAUDE.md`](./CLAUDE.md) にまとまっている。

## 主な機能

- **体重記録**: 日々の体重を記録し、推移グラフと目標(基準日→目標体重)の進捗バーを表示
- **食事記録**: 写真を撮影 → Cloudflare Workers 経由で Google Gemini API(Vision)がカロリー・PFC(たんぱく質/脂質/炭水化物)を推定 → 手動で修正・確定
- **データ同期**: IndexedDB に保存した未同期の記録を、オンライン時にスプレッドシートへ書き出し(現状は未実装、下記「開発状況」参照)
- **バックアップ**: JSON エクスポート/インポートによる手動バックアップ・機種変更対応
- **PWA**: オフラインでも記録可能、ホーム画面に追加してアプリのように利用可能

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React + Vite + TypeScript、Tailwind CSS |
| データ保存 | Dexie(IndexedDB)によるローカルファースト保存 |
| 写真AI判定 | Cloudflare Workers を中継役に Google Gemini API(Vision)を呼び出し |
| ホスティング | Cloudflare Workers(Git 連携、`main` push で自動デプロイ) |
| テスト | Vitest + fake-indexeddb |

採用理由・トレードオフは [要件定義書](./docs/ライフログアプリ_要件定義書.md) の 6 章を参照。

## ディレクトリ構成

```
src/
  db/         Dexie スキーマとエンティティごとの CRUD 関数(weightRecords / mealRecords / settings / backup)
  sync/       スプレッドシート同期エンジン(トランスポート非依存)
  pages/      画面(Home, WeightRecordPage, MealRecordPage, Trends, Settings)
  components/ 手書き SVG チャートなどの UI 部品
worker/       Cloudflare Workers: 静的アセット配信 + 写真AI判定API(/api/judge-meal)
docs/         要件定義書・画面設計書・デザインガイド
```

## セットアップ

```
npm install
cp .dev.vars.example .dev.vars   # GEMINI_API_KEY を設定(Worker のローカル実行に必要)
```

## 開発コマンド

```
npm run dev              # Vite 開発サーバー起動(localhost:5173)
npm run build            # tsc -b && vite build(PWA の Service Worker も生成)
npm run test             # vitest run(全テスト)
npx vitest run <path>    # 単一テストファイルのみ実行
npm run preview          # 本番ビルドをローカルで確認(実際の PWA/インストール挙動の確認用)
npm run worker:dev       # wrangler dev で Worker(/api/judge-meal 含む)をローカル実行
```

`npm run lint` は package.json に定義されているが ESLint 未導入のため動作しない。

## デプロイ

Cloudflare Workers(Git 連携)で `main` ブランチへの push を契機に自動デプロイされる。手元から反映する場合は `npm run deploy`(要 `wrangler login`)。詳細は `wrangler.toml` および `CLAUDE.md` の「Deployment」を参照。

## 開発状況・残タスク

MVP(体重記録・食事記録)は実装済み。スプレッドシート同期(`src/sync/notConfiguredTransport.ts` が未実装のプレースホルダー)をはじめ、残っているタスクは GitHub Issues で管理している。詳細は [Issues](../../issues) を参照。
