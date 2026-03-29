-- Create test table for replication demo
CREATE TABLE IF NOT EXISTS replication_test (
    id SERIAL PRIMARY KEY,
    node_name TEXT,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('customer', 'driver', 'admin')) DEFAULT 'customer',
    avatar_url TEXT,
    preferred_language TEXT NOT NULL CHECK (preferred_language IN ('vi', 'en')) DEFAULT 'vi',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);