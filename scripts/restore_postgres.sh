#!/usr/bin/env bash
set -euo pipefail
if [[ $# -ne 1 || ! -f "$1" ]]; then echo 'Usage: restore_postgres.sh path/to/file.sql' >&2; exit 2; fi
if [[ "${ALLOW_DESTRUCTIVE_STAGING_RESTORE:-}" != 'YES' ]]; then
  echo 'Set ALLOW_DESTRUCTIVE_STAGING_RESTORE=YES only for a disposable isolated staging database.' >&2; exit 3
fi
echo 'Do NOT run against active production; terminate other clients and restore into an EMPTY staging database.' >&2
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U krishi -d krishisetu < "$1"
