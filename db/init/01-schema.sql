CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  password VARCHAR(255),
  role VARCHAR(20) DEFAULT 'customer',
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bảng trips
CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES users(id),
  driver_id INT REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending',
  pickup_address VARCHAR(255),
  dropoff_address VARCHAR(255),
  fare DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed data mẫu để test
INSERT INTO users (name, phone, role) VALUES
  ('Nguyen Van A', '0901234567', 'customer'),
  ('Tran Van B', '0912345678', 'driver'),
  ('Admin User', '0923456789', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO trips (customer_id, driver_id, status, pickup_address, dropoff_address, fare) VALUES
  (1, 2, 'completed', 'Quận 1, TP.HCM', 'Quận 7, TP.HCM', 85000),
  (1, 2, 'completed', 'Bình Thạnh', 'Gò Vấp', 45000),
  (1, 2, 'cancelled', 'Quận 3', 'Quận 10', 0)
ON CONFLICT DO NOTHING;