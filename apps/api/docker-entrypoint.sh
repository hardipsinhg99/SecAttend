#!/bin/sh
set -eu

SCHEMA_PATH="apps/api/prisma/schema.prisma"
if MIGRATION_OUTPUT="$(npx prisma migrate deploy --schema "$SCHEMA_PATH" 2>&1)"; then
  printf '%s\n' "$MIGRATION_OUTPUT"
else
  printf '%s\n' "$MIGRATION_OUTPUT"
  if printf '%s\n' "$MIGRATION_OUTPUT" | grep -q "P3005"; then
    echo "Existing SHREEDEVI SECURITY SERVICE schema detected; recording the legacy schema baseline."
    npx prisma migrate resolve --applied 202607230001_init --schema "$SCHEMA_PATH"
    npx prisma migrate deploy --schema "$SCHEMA_PATH"
  else
    echo "Database migration failed; API startup aborted."
    exit 1
  fi
fi

node apps/api/dist/prisma/production-reset.js
exec node apps/api/dist/src/server.js
