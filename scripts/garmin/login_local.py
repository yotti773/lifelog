#!/usr/bin/env python3
"""Garminへ対話ログインし、GitHub Secrets用のトークン(base64)を出力する。

初回セットアップ時にローカルで一度だけ実行する:

    pip install -r requirements.txt
    python login_local.py

ログイン成功後に表示されるbase64文字列を、リポジトリのSecrets
`GARMIN_TOKENS_BASE64` に登録する。詳細は README.md を参照。
"""

import base64
import sys
from getpass import getpass
from pathlib import Path

from garminconnect import Garmin, GarminConnectAuthenticationError

TOKEN_DIR = Path("~/.garminconnect").expanduser()
TOKEN_FILE = TOKEN_DIR / "garmin_tokens.json"


def main() -> None:
    email = input("Garminのメールアドレス: ").strip()
    password = getpass("パスワード: ")

    try:
        garmin = Garmin(
            email=email,
            password=password,
            prompt_mfa=lambda: input("MFAコード(6桁): ").strip(),
        )
        garmin.login(str(TOKEN_DIR))
    except GarminConnectAuthenticationError as err:
        sys.exit(f"ログインに失敗しました: {err}")

    print(f"\nログイン成功。トークンを {TOKEN_FILE} に保存しました。")
    print("以下をGitHub Secretsの GARMIN_TOKENS_BASE64 に登録してください:\n")
    print(base64.b64encode(TOKEN_FILE.read_bytes()).decode())


if __name__ == "__main__":
    main()
