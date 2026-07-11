#!/usr/bin/env python3
"""Garminの日次活動データを同期用スプレッドシートの「活動記録」タブへ書き込む。

GitHub Actions(.github/workflows/garmin-sync.yml)から毎日実行される想定。
日付をキーに upsert するため、同じ日付で再実行すると上書きされる(バックフィル可)。

必要な環境変数:
    GARMINTOKENS                          トークン保存ディレクトリ(省略時 ~/.garminconnect)
    GARMIN_TOKENS_BASE64                  garmin_tokens.json のbase64(トークンファイルが無いときの種)
    GOOGLE_SERVICE_ACCOUNT_EMAIL          サービスアカウントのメールアドレス(Workerと同じ値)
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY    サービスアカウントの秘密鍵PEM(Workerと同じ値)
    GOOGLE_SHEETS_SPREADSHEET_ID          同期先スプレッドシートのID(Workerと同じ値)

使い方:
    python garmin_to_sheet.py                 # 前日(JST)の1日分
    python garmin_to_sheet.py --start 2026-06-01 --end 2026-06-30   # 期間バックフィル
"""

import argparse
import base64
import os
import re
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from garminconnect import Garmin
from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account

SHEET_NAME = "活動記録"
SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets"

# 列構成。アプリ側の取り込み(Issue #81)はこのヘッダーを前提にするため、
# 列を追加する場合は末尾に足し、既存列の並びは変えないこと。
HEADER = [
    "日付",
    "歩数",
    "総消費カロリー",
    "活動消費カロリー",
    "睡眠時間(分)",
    "睡眠スコア",
    "安静時心拍数",
    "中強度運動時間(分)",
    "高強度運動時間(分)",
]

# 一度のバックフィルで取得できる日数の上限(非公式APIへの過剰なリクエストを防ぐ)
MAX_DAYS_PER_RUN = 366

# 日付セルの照合用パターン。worker/sheetsImport.ts の CALENDAR_DATE_PATTERNS と同じ3形式を
# 許容する(USER_ENTERED書き込みではSheetsのロケール設定次第で表示形式が変わりうるため)
CALENDAR_DATE_PATTERNS = [
    re.compile(r"^(\d{4})年(\d{1,2})月(\d{1,2})日$"),
    re.compile(r"^(\d{4})/(\d{1,2})/(\d{1,2})$"),
    re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})$"),
]


def format_calendar_date(day: date) -> str:
    """Workerの formatCalendarDate と同じ「yyyy年mm月dd日」形式(既存タブとの平仄)。"""
    return f"{day.year}年{day.month:02d}月{day.day:02d}日"


def normalize_calendar_date(value: str) -> str | None:
    """セルの日付表記をISO(YYYY-MM-DD)へ正規化する。解釈できなければNone。"""
    s = str(value or "").strip()
    for pattern in CALENDAR_DATE_PATTERNS:
        m = pattern.match(s)
        if m:
            year, month, day = m.groups()
            return f"{year}-{int(month):02d}-{int(day):02d}"
    return None


def yesterday_jst() -> date:
    return (datetime.now(ZoneInfo("Asia/Tokyo")) - timedelta(days=1)).date()


def parse_args() -> tuple[date, date]:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", help="取得開始日 YYYY-MM-DD(省略時は前日JST)")
    parser.add_argument("--end", help="取得終了日 YYYY-MM-DD(省略時は--startと同じ)")
    args = parser.parse_args()

    start = date.fromisoformat(args.start) if args.start else yesterday_jst()
    end = date.fromisoformat(args.end) if args.end else start
    if end < start:
        parser.error("--end は --start 以降の日付を指定してください")
    if (end - start).days + 1 > MAX_DAYS_PER_RUN:
        parser.error(f"一度に取得できるのは{MAX_DAYS_PER_RUN}日分までです")
    if end > yesterday_jst():
        parser.error("未確定の当日以降は指定できません(前日までが対象)")
    return start, end


def garmin_login() -> Garmin:
    """保存済みトークンでログインする。無ければ GARMIN_TOKENS_BASE64 から復元する。"""
    tokenstore = os.environ.get("GARMINTOKENS", "~/.garminconnect")
    token_dir = Path(tokenstore).expanduser()
    token_file = token_dir / "garmin_tokens.json"

    if not token_file.exists():
        seed = os.environ.get("GARMIN_TOKENS_BASE64", "").strip()
        if not seed:
            sys.exit(
                "Garminトークンがありません。scripts/garmin/login_local.py でトークンを生成し、"
                "GARMIN_TOKENS_BASE64 に登録してください。"
            )
        token_dir.mkdir(parents=True, exist_ok=True)
        token_file.write_bytes(base64.b64decode(seed))
        print("GARMIN_TOKENS_BASE64 からトークンファイルを復元しました。")

    garmin = Garmin()
    garmin.login(str(token_dir))
    print("Garminにログインしました。")
    return garmin


def fetch_day(garmin: Garmin, day: date) -> list:
    """1日分の行データ(HEADERと同じ並び)を返す。取れない項目は空文字。"""

    def pick(d, *keys):
        for key in keys:
            if not isinstance(d, dict):
                return ""
            d = d.get(key)
        return d if d is not None else ""

    iso = day.isoformat()
    summary = garmin.get_user_summary(iso) or {}
    sleep = garmin.get_sleep_data(iso) or {}
    sleep_dto = sleep.get("dailySleepDTO") or {}

    sleep_seconds = sleep_dto.get("sleepTimeSeconds")
    sleep_minutes = round(sleep_seconds / 60) if sleep_seconds else ""

    return [
        format_calendar_date(day),
        pick(summary, "totalSteps"),
        pick(summary, "totalKilocalories"),
        pick(summary, "activeKilocalories"),
        sleep_minutes,
        pick(sleep_dto, "sleepScores", "overall", "value"),
        pick(summary, "restingHeartRate"),
        pick(summary, "moderateIntensityMinutes"),
        pick(summary, "vigorousIntensityMinutes"),
    ]


def sheets_session() -> AuthorizedSession:
    email = os.environ.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")
    private_key = os.environ.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "")
    spreadsheet_id = os.environ.get("GOOGLE_SHEETS_SPREADSHEET_ID")
    if not email or not private_key or not spreadsheet_id:
        sys.exit(
            "GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY / "
            "GOOGLE_SHEETS_SPREADSHEET_ID が未設定です。"
        )
    # GitHub Secretsに `\n` エスケープで貼られた場合に実改行へ戻す
    if "\\n" in private_key:
        private_key = private_key.replace("\\n", "\n")
    credentials = service_account.Credentials.from_service_account_info(
        {
            "type": "service_account",
            "client_email": email,
            "private_key": private_key,
            "token_uri": "https://oauth2.googleapis.com/token",
        },
        scopes=["https://www.googleapis.com/auth/spreadsheets"],
    )
    return AuthorizedSession(credentials)


def api(session: AuthorizedSession, method: str, path: str, **kwargs):
    spreadsheet_id = os.environ["GOOGLE_SHEETS_SPREADSHEET_ID"]
    res = session.request(method, f"{SHEETS_API_BASE}/{spreadsheet_id}{path}", **kwargs)
    if not res.ok:
        sys.exit(f"Sheets APIエラー ({method} {path}): {res.status_code} {res.text[:500]}")
    return res.json()


def ensure_sheet(session: AuthorizedSession) -> None:
    """「活動記録」タブが無ければ作成し、ヘッダー行を書き込む。"""
    meta = api(session, "GET", "?fields=sheets.properties(title)")
    titles = [s["properties"]["title"] for s in meta.get("sheets", [])]
    if SHEET_NAME in titles:
        return
    api(
        session,
        "POST",
        ":batchUpdate",
        json={"requests": [{"addSheet": {"properties": {"title": SHEET_NAME}}}]},
    )
    api(
        session,
        "PUT",
        f"/values/{SHEET_NAME}!A1?valueInputOption=USER_ENTERED",
        json={"values": [HEADER]},
    )
    print(f"タブ「{SHEET_NAME}」を新規作成しました。")


def existing_date_rows(session: AuthorizedSession) -> dict[str, int]:
    """日付(A列、ISOへ正規化)→ 行番号(1始まり)のマップを返す。"""
    values = api(session, "GET", f"/values/{SHEET_NAME}!A:A").get("values", [])
    rows: dict[str, int] = {}
    for i, row in enumerate(values[1:], start=2):  # 1行目はヘッダー
        iso = normalize_calendar_date(row[0]) if row else None
        if iso:
            rows[iso] = i
    return rows


def upsert_rows(session: AuthorizedSession, rows: list[list]) -> None:
    date_to_row = existing_date_rows(session)

    def key(r: list) -> str:
        return normalize_calendar_date(r[0]) or ""

    updates = [r for r in rows if key(r) in date_to_row]
    appends = [r for r in rows if key(r) not in date_to_row]

    if updates:
        api(
            session,
            "POST",
            "/values:batchUpdate",
            json={
                "valueInputOption": "USER_ENTERED",
                "data": [
                    {"range": f"{SHEET_NAME}!A{date_to_row[key(r)]}", "values": [r]}
                    for r in updates
                ],
            },
        )
    if appends:
        api(
            session,
            "POST",
            f"/values/{SHEET_NAME}!A:I:append?valueInputOption=USER_ENTERED",
            json={"values": appends},
        )
    print(f"書き込み完了: 上書き{len(updates)}行 / 追記{len(appends)}行")


def main() -> None:
    start, end = parse_args()
    session = sheets_session()
    garmin = garmin_login()
    ensure_sheet(session)

    rows = []
    day = start
    while day <= end:
        rows.append(fetch_day(garmin, day))
        print(f"取得: {day.isoformat()}")
        day += timedelta(days=1)
        if day <= end:
            time.sleep(1)  # 連続リクエストの間隔を空ける(非公式APIへの配慮)

    upsert_rows(session, rows)


if __name__ == "__main__":
    main()
