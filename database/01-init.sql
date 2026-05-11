-- Bật extension earthdistance để tính khoảng cách GPS
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Bảng users
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
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

-- Bảng drivers
CREATE TABLE IF NOT EXISTS drivers (
  id BIGINT PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
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

-- Bảng trips
CREATE TABLE IF NOT EXISTS trips (
  id BIGINT PRIMARY KEY,
  customer_id BIGINT REFERENCES users(id),
  driver_id BIGINT REFERENCES drivers(id),
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

-- Bảng messages
CREATE TABLE IF NOT EXISTS messages (
  id BIGINT PRIMARY KEY,
  trip_id BIGINT REFERENCES trips(id) ON DELETE CASCADE,
  sender_id BIGINT REFERENCES users(id),
  receiver_id BIGINT REFERENCES users(id),
  content TEXT NOT NULL,
  type VARCHAR(10) DEFAULT 'text' CHECK (type IN ('text', 'image')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bảng ratings (đánh giá tài xế sau mỗi chuyến)
CREATE TABLE IF NOT EXISTS ratings (
  id BIGINT PRIMARY KEY,
  trip_id BIGINT REFERENCES trips(id) ON DELETE CASCADE,
  customer_id BIGINT REFERENCES users(id),
  driver_id BIGINT REFERENCES drivers(id),
  score NUMERIC(2,1) NOT NULL CHECK (score >= 1 AND score <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index để query đánh giá theo tài xế
CREATE INDEX IF NOT EXISTS idx_ratings_driver_id ON ratings(driver_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_trip_customer ON ratings(trip_id, customer_id);

-- Bảng payments (thanh toán)
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT PRIMARY KEY,
  trip_id BIGINT REFERENCES trips(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  method VARCHAR(10) DEFAULT 'cash' CHECK (method IN ('cash', 'vnpay')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  vnpay_transaction_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index để query thanh toán theo trip
CREATE INDEX IF NOT EXISTS idx_payments_trip_id ON payments(trip_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Bảng replication_test (dùng để kiểm tra replication hoạt động)
CREATE TABLE IF NOT EXISTS replication_test (
    id SERIAL PRIMARY KEY,
    node_name TEXT,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index cho trips
CREATE INDEX IF NOT EXISTS idx_trips_status_region ON trips(status, region);
CREATE INDEX IF NOT EXISTS idx_messages_trip_id ON messages(trip_id, created_at);

-- Nạp dữ liệu mẫu
DO $$
DECLARE
    current_region TEXT;
BEGIN
    current_region := current_setting('cluster.region', true);

    -- [QUAN TRỌNG] Nạp TẤT CẢ người dùng vào TẤT CẢ các node (Full Replication)
    -- Điều này cho phép đặt xe liên vùng
    INSERT INTO users (id, name, phone, email, password, role) VALUES
      (1, 'Admin Toàn Cầu', '0999999999', 'admin@test.com', '$2b$10$FZOT./KqzsSwaZHsQsGZtungaNIhFMTxOcQllBEQ73NlzWAd/.7CK', 'admin'),
      (101001, 'Khách Bắc 1', '0901111111', 'bac1@test.com', '$2b$10$FZOT./KqzsSwaZHsQsGZtungaNIhFMTxOcQllBEQ73NlzWAd/.7CK', 'customer'),
      (101002, 'Tài xế Bắc 1 (User)', '0902222222', 'driver_bac@test.com', '$2b$10$FZOT./KqzsSwaZHsQsGZtungaNIhFMTxOcQllBEQ73NlzWAd/.7CK', 'driver'),
      (202001, 'Khách Nam 1', '0911111111', 'nam1@test.com', '$2b$10$FZOT./KqzsSwaZHsQsGZtungaNIhFMTxOcQllBEQ73NlzWAd/.7CK', 'customer'),
      (202002, 'Tài xế Nam 1 (User)', '0912222222', 'driver_nam@test.com', '$2b$10$FZOT./KqzsSwaZHsQsGZtungaNIhFMTxOcQllBEQ73NlzWAd/.7CK', 'driver')
    ON CONFLICT (id) DO NOTHING;

    -- [PHÂN MẢNH] Chỉ nạp Drivers và Trips vào đúng vùng tương ứng
    IF current_region = 'NORTH' THEN
        -- Hồ sơ tài xế miền Bắc
        INSERT INTO drivers (id, user_id, vehicle_plate, vehicle_type, is_available, latitude, longitude, region)
        VALUES (101501, 101002, '29A-88888', 'bike', true, 21.0285, 105.8542, 'NORTH')
        ON CONFLICT (id) DO NOTHING;

        -- Chuyến xe mẫu miền Bắc
        INSERT INTO trips (id, customer_id, driver_id, status, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, region, fare, created_at, completed_at)
        VALUES (101901, 101001, 101501, 'completed', 'Hồ Gươm', 'Lăng Bác', 21.0285, 105.8542, 21.0367, 105.8347, 'NORTH', 35000, NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hour')
        ON CONFLICT (id) DO NOTHING;

    ELSIF current_region = 'SOUTH' THEN
        -- Hồ sơ tài xế miền Nam
        INSERT INTO drivers (id, user_id, vehicle_plate, vehicle_type, is_available, latitude, longitude, region)
        VALUES (202501, 202002, '51B-99999', 'car', true, 10.7769, 106.7009, 'SOUTH')
        ON CONFLICT (id) DO NOTHING;

        -- Chuyến xe mẫu miền Nam
        INSERT INTO trips (id, customer_id, status, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, region, fare, created_at)
        VALUES (202901, 202001, 'pending', 'Chợ Bến Thành', 'Landmark 81', 10.7719, 106.6983, 10.7950, 106.7218, 'SOUTH', 75000, NOW())
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;
