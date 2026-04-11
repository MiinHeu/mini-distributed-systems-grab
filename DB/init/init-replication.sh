#!/bin/bash
set -e

REPL_PASSWORD="${PGPASSWORD:-$POSTGRES_PASSWORD}"

if [ -z "$REPL_PASSWORD" ]; then
  echo "Password is not set. Please set POSTGRES_PASSWORD."
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
DO
\$\$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_roles WHERE rolname = 'replicator'
   ) THEN
      CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD '$REPL_PASSWORD';
   END IF;
END
\$\$;
EOSQL

echo "host replication replicator all scram-sha-256" >> "$PGDATA/pg_hba.conf"
