#!/bin/bash
set -e

if [ -z "$PGPASSWORD" ]; then
  echo "PGPASSWORD is not set. Please set it in DB/.env before running containers."
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
DO
$$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_roles WHERE rolname = 'replicator'
   ) THEN
      CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD '$PGPASSWORD';
   END IF;
END
$$;
EOSQL

