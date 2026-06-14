#!/usr/bin/env bash
set -euo pipefail

python3 <<'CLIENT_DIRECTIVE_AUDIT_PY'
from pathlib import Path

bad_files = []

for path in Path("apps/web/src").rglob("*"):
    if path.suffix not in {".ts", ".tsx"}:
        continue

    lines = path.read_text().splitlines()

    for index, line in enumerate(lines):
        if line.strip() in {'"use client";', "'use client';"}:
            preceding_non_empty = [
                item.strip()
                for item in lines[:index]
                if item.strip() and not item.strip().startswith("//")
            ]

            if preceding_non_empty:
                bad_files.append((path, index + 1, line.strip()))
            break

if bad_files:
    print("Misplaced use client directives found:")
    for path, line_number, directive in bad_files:
        print(f"{path}:{line_number}: {directive}")
    raise SystemExit(1)

print("No misplaced use client directives found.")
CLIENT_DIRECTIVE_AUDIT_PY
