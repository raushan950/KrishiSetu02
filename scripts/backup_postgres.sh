#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${POSTGRES_PASSWORD:?Provide POSTGRES_PASSWORD through your trusted environment or .env before backup}"
OUT="${1:-krishisetu-backup-$(date -u +%Y%m%dT%H%M%SZ).sql}"
if [[ -e "$OUT" ]]; then echo "Refusing to overwrite $OUT" >&2; exit 1; fi
docker compose exec -T db pg_dump -U krishi -d krishisetu --no-owner --no-privileges > "$OUT"
if [[ ! -s "$OUT" ]]; then echo 'Empty backup; review database connection and logs' >&2; rm -f "$OUT"; exit 1; fi
printf 'Backup created: %s (restrict file access and encrypt offsite)\n' "$OUT"
