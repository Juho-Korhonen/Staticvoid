"""Connection to the MariaDB database that holds the article history."""

from __future__ import annotations

import os
from pathlib import Path

import pymysql
from dotenv import load_dotenv
from pymysql.cursors import DictCursor

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = "3306"
DEFAULT_NAME = "wiki"  # database and user


def connect() -> pymysql.connections.Connection:
    """A new connection; they are not safe to share across threads. Timestamps are UTC."""
    return pymysql.connect(
        host=os.environ.get("MARIADB_HOST", DEFAULT_HOST),
        port=int(os.environ.get("MARIADB_PORT", DEFAULT_PORT)),
        user=os.environ.get("MARIADB_USER", DEFAULT_NAME),
        password=os.environ.get("MARIADB_PASSWORD", ""),
        database=os.environ.get("MARIADB_DATABASE", DEFAULT_NAME),
        charset="utf8mb4",
        cursorclass=DictCursor,
        init_command="SET time_zone = '+00:00'",
    )
