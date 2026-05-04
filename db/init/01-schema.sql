-- Bật extension earthdistance để tính khoảng cách GPS
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Bảng users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100) UNIQUE,
  password VARCHAR(255),
  role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'driver', 'admin')),
  preferred_language VARCHAR(5) DEFAULT 'vi' CHECK (preferred_language IN ('vi', 'en')),
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bảng drivers (Người 4 phụ trách)
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  vehicle_plate VARCHAR(20),
  vehicle_type VARCHAR(10) DEFAULT 'bike' CHECK (vehicle_type IN ('car', 'bike', 'truck')),
  is_available BOOLEAN DEFAULT false,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  region VARCHAR(10) DEFAULT 'NORTH' CHECK (region IN ('NORTH', 'SOUTH')),
  rating NUMERIC(3,2) DEFAULT 5.0,
  total_trips INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index để query nhanh tài xế theo trạng thái và vùng
CREATE INDEX IF NOT EXISTS idx_drivers_available_region ON drivers(is_available, region);
CREATE INDEX IF NOT EXISTS idx_drivers_location ON drivers(latitude, longitude);

-- Bảng trips
CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES users(id),
  driver_id UUID REFERENCES drivers(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
  pickup_address VARCHAR(255),
  dropoff_address VARCHAR(255),
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  dropoff_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,
  region VARCHAR(10) DEFAULT 'SOUTH' CHECK (region IN ('NORTH', 'SOUTH')),
  distance_km NUMERIC(10,2),
  fare DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Index để query nhanh trips theo status và region
CREATE INDEX IF NOT EXISTS idx_trips_status_region ON trips(status, region);

-- Bảng messages (Tầng 2 — Người 4: Chat real-time)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id INT REFERENCES trips(id) ON DELETE CASCADE,
  sender_id INT REFERENCES users(id),
  receiver_id INT REFERENCES users(id),
  content TEXT NOT NULL,
  type VARCHAR(10) DEFAULT 'text' CHECK (type IN ('text', 'image')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index để query lịch sử chat theo trip
CREATE INDEX IF NOT EXISTS idx_messages_trip_id ON messages(trip_id, created_at);

-- Seed data mẫu để test
-- Passwords đều là "password123" (bcrypt hash hợp lệ)
INSERT INTO users (name, phone, email, password, role) VALUES
  ('Nguyen Van A', '0901234567', 'customer@test.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'customer'),
  ('Tran Van B', '0912345678', 'driver@test.com',   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'driver'),
  ('Admin User', '0923456789', 'admin@test.com',    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO drivers (id, user_id, vehicle_plate, vehicle_type, is_available, latitude, longitude, region, rating) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, '51A-12345', 'bike', true, 21.0285, 105.8542, 'NORTH', 4.8),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2, '51B-67890', 'car', false, 10.7769, 106.7009, 'SOUTH', 4.5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO trips (customer_id, driver_id, status, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, region, fare) VALUES
  (1, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'completed', 'Hoàn Kiếm, Hà Nội', 'Cầu Giấy, Hà Nội', 21.0285, 105.8542, 21.0358, 105.7828, 'NORTH', 85000),
  (1, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'completed', 'Quận 1, TP.HCM', 'Quận 7, TP.HCM', 10.7769, 106.7009, 10.7326, 106.7228, 'SOUTH', 65000)
ON CONFLICT DO NOTHING;