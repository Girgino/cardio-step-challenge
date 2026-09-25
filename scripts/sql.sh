#!/bin/bash
# Run SQL on the challenge project via the Supabase Management API.
# Usage: scripts/sql.sh "select 1"   or   scripts/sql.sh -f file.sql
set -euo pipefail
REF=ipwnyjsbdpzjjdojyebl
TOKEN=$(tr -d '[:space:]' < ~/.cardio-supabase-token)
if [ "${1:-}" = "-f" ]; then Q=$(cat "$2"); else Q="$1"; fi
python3 -c 'import json,sys; print(json.dumps({"query": sys.stdin.read()}))' <<< "$Q" |
  curl -sS -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @-
echo
