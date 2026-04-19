-- Tạo database (nếu cần)
CREATE DATABASE grab_db;

-- Sử dụng database
\c grab_db;

-- ========================
-- TABLE: trips
-- ========================
CREATE TABLE trips (
    id SERIAL PRIMARY KEY,

    customer_id INT NOT NULL,
    driver_id INT,

    pickup_address TEXT,
    dropoff_address TEXT,

    pickup_lat DOUBLE PRECISION NOT NULL,
    pickup_lng DOUBLE PRECISION NOT NULL,

    dropoff_lat DOUBLE PRECISION NOT NULL,
    dropoff_lng DOUBLE PRECISION NOT NULL,

    region VARCHAR(10) NOT NULL, -- NORTH / SOUTH

    distance_km DOUBLE PRECISION,
    fare DOUBLE PRECISION,

    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, cancelled

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- ========================
-- INDEX (tăng tốc truy vấn)
-- ========================
CREATE INDEX idx_trips_region ON trips(region);
CREATE INDEX idx_trips_status ON trips(status);

-- ========================
-- DATA MẪU
-- ========================
INSERT INTO trips (
    customer_id,
    pickup_address,
    dropoff_address,
    pickup_lat,
    pickup_lng,
    dropoff_lat,
    dropoff_lng,
    region,
    distance_km,
    fare,
    status
)
VALUES
(1, 'Quận 1', 'Quận 3', 10.7769, 106.7009, 10.7820, 106.6950, 'SOUTH', 2.5, 30000, 'completed'),
(2, 'Quận 5', 'Quận 10', 10.7540, 106.6660, 10.7700, 106.6670, 'SOUTH', 3.2, 40000, 'completed'),
(3, 'Hà Nội', 'Cầu Giấy', 21.0285, 105.8542, 21.0360, 105.7900, 'NORTH', 5.1, 60000, 'pending');

-- ========================
-- QUERY TEST
-- ========================

-- Xem tất cả chuyến
SELECT * FROM trips;

-- Xem chuyến theo vùng
SELECT * FROM trips WHERE region = 'SOUTH';

-- Xem chuyến đã hoàn thành
SELECT * FROM trips WHERE status = 'completed';