#!/bin/bash
set -e

REPL_PASSWORD="${PGPASSWORD:-$POSTGRES_PASSWORD}"

if [ -z "$REPL_PASSWORD" ]; then
  echo "ERROR: Password is not set. Please set POSTGRES_PASSWORD."
  exit 1
fi

# Tạo role replicator nếu chưa tồn tại
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
DO
\$\$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_roles WHERE rolname = 'replicator'
   ) THEN
      CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD '$REPL_PASSWORD';
      RAISE NOTICE 'Role replicator created.';
   ELSE
      RAISE NOTICE 'Role replicator already exists, skipping.';
   END IF;
END
\$\$;
EOSQL

# Thêm dòng replication vào pg_hba.conf CHỈ KHI chưa có
# Tránh append trùng lặp mỗi lần container restart
REPL_LINE="host replication replicator all md5"
if ! grep -qF "$REPL_LINE" "$PGDATA/pg_hba.conf"; then
  echo "$REPL_LINE" >> "$PGDATA/pg_hba.conf"
  echo "Added replication entry to pg_hba.conf"
else
  echo "Replication entry already exists in pg_hba.conf, skipping."
fi

# Reload pg_hba.conf để áp dụng thay đổi ngay lập tức
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "SELECT pg_reload_conf();"

echo "Replication setup complete."
