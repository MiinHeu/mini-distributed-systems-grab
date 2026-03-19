-- Create test table for replication demo
CREATE TABLE IF NOT EXISTS replication_test (
    id SERIAL PRIMARY KEY,
    node_name TEXT,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);