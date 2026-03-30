-- Script SQL cho Tầng 1 (Vị trí tài xế)
-- Để vào thư mục dự án và chạy trên các container:

CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Xoá Type nếu đã tồn tại (để chạy lại script không lỗi)
DROP TYPE IF EXISTS vehicle_type_enum CASCADE;
DROP TYPE IF EXISTS region_enum CASCADE;

CREATE TYPE vehicle_type_enum AS ENUM ('car', 'bike', 'truck');
CREATE TYPE region_enum AS ENUM ('NORTH', 'SOUTH');

-- Bảng users (để làm khóa ngoại cho driver)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'customer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng drivers
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type vehicle_type_enum NOT NULL,
    is_available BOOLEAN DEFAULT false,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    region region_enum NOT NULL,
    rating DECIMAL(3, 2) DEFAULT 5.00,
    total_trips INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index để tối ưu tìm kiếm theo tính sẵn sàng và tọa độ
CREATE INDEX IF NOT EXISTS idx_drivers_available_region ON drivers (region, is_available);
-- Index dùng GIST cho tính toán tọa độ (bắt buộc để truy vấn bán kính nhanh)
CREATE INDEX IF NOT EXISTS idx_drivers_location ON drivers USING gist (ll_to_earth(latitude, longitude));

-- Trigger update chuỗi thời gian updated_at
CREATE OR REPLACE FUNCTION update_modified_column()   
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;   
END;
$$ language 'plpgsql';

CREATE TRIGGER update_drivers_modtime
    BEFORE UPDATE ON drivers
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Data mẫu (Seeding)
INSERT INTO users (id, name, phone, role) VALUES 
('11111111-1111-1111-1111-111111111111', 'Nguyen Van A', '0901234567', 'driver'),
('22222222-2222-2222-2222-222222222222', 'Tran Van B', '0987654321', 'driver')
ON CONFLICT DO NOTHING;

INSERT INTO drivers (id, user_id, vehicle_plate, vehicle_type, is_available, latitude, longitude, region) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '29A-123.45', 'car', true, 21.028511, 105.804817, 'NORTH'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', '51G-987.65', 'bike', true, 10.762622, 106.660172, 'SOUTH')
ON CONFLICT DO NOTHING;
