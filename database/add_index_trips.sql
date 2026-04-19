-- =====================================================================
-- Migration: Thêm composite index cho bảng trips (Người 3)
--
-- database.sql của người 2 đã có:
--   CREATE INDEX idx_trips_region ON trips(region);
--   CREATE INDEX idx_trips_status ON trips(status);
--
-- Nhưng CHƯA có composite index (status, region) cùng lúc.
-- Câu query GET /trips/pending dùng WHERE status='pending' AND region=$1
-- → cần composite index mới dùng được cả hai điều kiện cùng lúc.
--
-- Cách chạy trên south-primary (port 5434):
--   psql -h localhost -p 5434 -U rideshare_admin -d rideshare_db -f add_index_trips.sql
--
-- Chạy tương tự trên north-primary (port 5432):
--   psql -h localhost -p 5432 -U rideshare_admin -d rideshare_db -f add_index_trips.sql
-- =====================================================================

-- Composite index chính — tăng tốc GET /trips/pending?region=SOUTH
-- PostgreSQL dùng index này thay vì 2 index riêng lẻ của người 2
CREATE INDEX IF NOT EXISTS idx_trips_status_region
    ON trips (status, region);

-- Index tài xế — tăng tốc PATCH accept/complete và lịch sử tài xế
CREATE INDEX IF NOT EXISTS idx_trips_driver_id
    ON trips (driver_id);

-- =====================================================================
-- Kiểm tra sau khi chạy:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'trips';
--
-- Kết quả mong đợi — phải thấy đủ 4 dòng:
--   idx_trips_region        → index cũ của người 2
--   idx_trips_status        → index cũ của người 2
--   idx_trips_status_region → index mới của người 3 ✓
--   idx_trips_driver_id     → index mới của người 3 ✓
-- =====================================================================