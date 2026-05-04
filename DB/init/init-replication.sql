-- Tạo role replicator nếu chưa có
DO
$$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_roles WHERE rolname = 'replicator'
   ) THEN
      CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'Admin@123456';
   END IF;
END
$$;

-- Bảng test replication
CREATE TABLE IF NOT EXISTS replication_test (
    id SERIAL PRIMARY KEY,
    node_name TEXT,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
