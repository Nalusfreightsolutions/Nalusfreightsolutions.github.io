#!/usr/bin/env bash
# Nalu Command Center — manual full database backup
#
# This makes a real Postgres-level backup (schema, RLS policies, triggers,
# and all data) as a single .sql file — a different, stronger backup than
# the app's own "Backup Data" button, which only exports the app's data as
# JSON and doesn't capture schema/policies/auth users.
#
# Requires `pg_dump` to be installed and on your PATH. If the command below
# fails with "pg_dump: command not found", see the README for how to install it.
#
# Usage: run this script from Terminal (see README for exact steps).
# It will ask for your Supabase database password — this is never stored
# anywhere, just used for this one connection.

set -euo pipefail

PROJECT_REF="nujalvroqdjtbnqzxknq"
DB_HOST="db.${PROJECT_REF}.supabase.co"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="postgres"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/db_backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
OUTFILE="$BACKUP_DIR/nalu_command_center_${TIMESTAMP}.sql"

read -r -s -p "Supabase database password: " DB_PASSWORD
echo
export PGPASSWORD="$DB_PASSWORD"

echo "Backing up to $OUTFILE ..."
pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --no-owner --no-privileges \
  --format=plain \
  --file="$OUTFILE"

unset PGPASSWORD

echo "Done. Backup saved to: $OUTFILE"
echo "Move a copy of this file somewhere safe (cloud drive, external drive, etc.) — it's a full restore point for the whole database."
