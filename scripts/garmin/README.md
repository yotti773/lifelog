# Garmin連携(活動データの日次同期)

Garmin Connectから日次の活動データ(歩数・消費カロリー・睡眠など)を取得し、
同期用スプレッドシートの「活動記録」タブへ書き込む仕組み(Issue #11 / #80)。

- 実行基盤: GitHub Actions(`.github/workflows/garmin-sync.yml`)。毎日3:00 JSTに前日分を自動取得
- ライブラリ: [python-garminconnect](https://github.com/cyberjunky/python-garminconnect)(非公式API)
- 書き込み先: Workerの同期と同じスプレッドシート。日付をキーにupsertするため再実行で重複しない

## シートの列構成

| 列 | 内容 |
|---|---|
| A | 日付(「yyyy年mm月dd日」。既存タブと同じ書式。upsert照合はスラッシュ・ハイフン表記も許容) |
| B | 歩数 |
| C | 総消費カロリー(kcal) |
| D | 活動消費カロリー(kcal) |
| E | 睡眠時間(分) |
| F | 睡眠スコア |
| G | 安静時心拍数(bpm) |
| H | 中強度運動時間(分) |
| I | 高強度運動時間(分) |

アプリ側の取り込み(Issue #81)はこのヘッダー・並びを前提にする。列を足すときは末尾に追加し、既存列の並びを変えないこと。

## 初回セットアップ

### 1. Garminトークンの生成

#### 方法A: Python環境がある場合(推奨)

**Windows + uv(管理下のPython)の場合:**

```powershell
cd scripts\garmin
uv venv
.\.venv\Scripts\Activate.ps1
uv pip install -r requirements.txt
python login_local.py
```

> 注: `python3.14` など明示的にバージョンを指定すると、仮想環境の外の Python が実行され、パッケージが見つかりません。仮想環境がアクティベートされたら、必ず `python`(短い名前)を使ってください。

**通常のPython環境の場合:**

```bash
cd scripts/garmin
pip install -r requirements.txt
python login_local.py
```

#### 方法B: Dockerを使う場合(pip不要)

```bash
cd scripts/garmin
docker build -t garmin-login .
docker run -it garmin-login
```

#### 方法C: 別のマシン/Codespaces/WSLを使う

ローカルPC以外の環境でpython環境を用意すれば上記Aの手順で実行できます。

---

メールアドレス・パスワード(・MFAコード)を入力すると、GitHub Secrets登録用のbase64文字列が表示されます。

### 2. GitHub Secretsの登録

リポジトリの Settings → Secrets and variables → Actions に以下を登録する:

| Secret名 | 値 |
|---|---|
| `GARMIN_TOKENS_BASE64` | 手順1で表示されたbase64文字列 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Workerのシークレットと同じ値 |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Workerのシークレットと同じ値(PEM全文) |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Workerのシークレットと同じ値 |

サービスアカウントには同期用スプレッドシートの編集権限が必要(Worker同期用に共有済みならそのまま使える)。

### 3. 動作確認・過去分バックフィル

Actionsタブ → `Garmin Sync` → `Run workflow` で手動実行できる。
`start_date` / `end_date` を指定すると過去分をまとめて取得する(最大366日/回)。
省略すると前日1日分。「活動記録」タブが無ければ自動作成される。

## トークンの寿命と運用

- Garminのトークンはリフレッシュで書き換わるため、ワークフローは**前回実行時のActionsキャッシュを優先**して使い回し、キャッシュが無いときだけ `GARMIN_TOKENS_BASE64` から復元する
- 認証エラーで失敗し続けるようになったら、手順1を再実行して `GARMIN_TOKENS_BASE64` を更新する(その後の手動実行で新しいトークンがキャッシュに乗る)
- 欠損した日付があっても、`start_date`/`end_date` 指定の手動実行で後から埋められる

## 注意事項

- **GitHubの仕様**: リポジトリに60日間コミット等の活動が無いと、スケジュール実行は自動で無効化される(Actionsタブに警告が出る。有効化し直せば再開する)
- **非公式APIのリスク**: Garmin側の仕様変更で突然壊れる可能性がある。壊れても後からバックフィルで復旧できるため、実害は数日分の遅延に留まる
- 当日分は未確定のため取得対象外(前日までのみ)
