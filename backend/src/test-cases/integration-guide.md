# Hướng dẫn Test Integration — Đề tài 4

Các test case này cần chạy với Docker DB thật. Thực hiện từng bước theo thứ tự.

## Chuẩn bị

```bash
# 1. Khởi động toàn bộ hệ thống (4 DB nodes + PgBouncer + Monitoring)
docker compose up -d

# 2. Chờ replica sync xong (~30 giây)
docker logs south-replica --follow
# Thấy "database system is ready to accept read only connections" → OK

# 3. Khởi động backend
cd backend && npm run start:dev
```

---

## TC-01: Định tuyến theo thành phố → đúng region

**Thao tác:** Đặt chuyến với pickup tại Hà Nội

```http
POST http://localhost:3000/trips/book
Authorization: Bearer <token>
Content-Type: application/json

{
  "pickup_lat": 21.0285,
  "pickup_lng": 105.8542,
  "dropoff_lat": 21.0358,
  "dropoff_lng": 105.7828,
  "pickup": "Hoàn Kiếm, Hà Nội",
  "dropoff": "Cầu Giấy, Hà Nội",
  "fare": 85000
}
```

**Kết quả mong đợi:**
```json
{
  "message": "Đặt chuyến thành công",
  "region": "NORTH",
  "activeNode": "NORTH_PRIMARY"
}
```

**Backend log phải có:**
```
[WRITE ROUTE] lat=21.0285 → NORTH → NORTH_PRIMARY
```

---

## TC-02: Định tuyến theo tọa độ → đúng region

**Thao tác:** Đặt chuyến với pickup tại TP.HCM

```http
POST http://localhost:3000/trips/book
Authorization: Bearer <token>
Content-Type: application/json

{
  "pickup_lat": 10.7769,
  "pickup_lng": 106.7009,
  "dropoff_lat": 10.7326,
  "dropoff_lng": 106.7228,
  "pickup": "Quận 1, TP.HCM",
  "dropoff": "Quận 7, TP.HCM",
  "fare": 65000
}
```

**Kết quả mong đợi:**
```json
{
  "region": "SOUTH",
  "activeNode": "SOUTH_PRIMARY"
}
```

---

## TC-03: Replication hoạt động

**Thao tác:** Insert trip vào north-primary, kiểm tra north-replica

```bash
# Bước 1: Đặt chuyến tại Hà Nội (ghi vào north-primary)
# Bước 2: Kiểm tra replica có data không
docker exec -it north-replica psql -U rideshare_admin -d rideshare_db \
  -c "SELECT id, pickup_address, region FROM trips ORDER BY created_at DESC LIMIT 3;"
```

**Kết quả mong đợi:** Trip vừa tạo xuất hiện ở replica trong < 1 giây

**Kiểm tra replication đang chạy:**
```bash
docker exec -it north-primary psql -U rideshare_admin -d rideshare_db \
  -c "SELECT application_name, state, sync_state, write_lag FROM pg_stat_replication;"
```

---

## TC-04: Failover tự động

**Thao tác:**

```bash
# Bước 1: Tắt south primary
docker stop south-primary

# Bước 2: Chờ 5-10 giây (health check interval)
# Bước 3: Kiểm tra health
curl http://localhost:3000/health
```

**Kết quả mong đợi:**
```json
{
  "data": {
    "nodes": {
      "SOUTH_PRIMARY": { "status": "offline", "responseTimeMs": null },
      "SOUTH_REPLICA": { "status": "online", "responseTimeMs": 3 }
    },
    "serviceLevel": {
      "SOUTH": "readonly"
    }
  }
}
```

**Backend log phải có:**
```
[HealthMonitor] Trạng thái thay đổi: SOUTH_PRIMARY: ONLINE → OFFLINE
[READ ROUTE] lat=10.77 → SOUTH → SOUTH_REPLICA (READ-ONLY: primary down)
```

---

## TC-05: Read-only mode

**Thao tác:** Sau khi tắt south primary, thử đặt chuyến tại TP.HCM

```http
POST http://localhost:3000/trips/book
Authorization: Bearer <token>
Content-Type: application/json

{
  "pickup_lat": 10.7769,
  "pickup_lng": 106.7009,
  ...
}
```

**Kết quả mong đợi:** HTTP 503
```json
{
  "readOnly": true,
  "warning": "Tính năng GHI (Miền Nam) tạm thời bị khóa do hệ thống đang bảo trì. Replica chỉ cho phép ĐỌC.",
  "activeNode": "SOUTH_REPLICA",
  "data": null
}
```

---

## TC-06: Xem lịch sử khi failover

**Thao tác:** Sau khi tắt south primary, xem lịch sử chuyến

```http
GET http://localhost:3000/trips/history
Authorization: Bearer <token>
```

**Kết quả mong đợi:** HTTP 200 (vẫn trả về data)
```json
{
  "readOnly": true,
  "warning": "Miền Nam đang bảo trì. Dữ liệu Miền Nam được lấy từ bản sao (read-only).",
  "activeNode": "SOUTH_REPLICA",
  "data": [...]
}
```

---

## TC-07: Cross-region isolation

**Thao tác:**

```bash
# Tắt cả Miền Nam
docker stop south-primary south-replica

# Gửi request đến Miền Bắc
curl http://localhost:3000/trips/history \
  -H "Authorization: Bearer <token>"
```

**Kết quả mong đợi:** Miền Bắc trả kết quả bình thường, không bị ảnh hưởng

```bash
# Kiểm tra health
curl http://localhost:3000/health/north  # → serviceLevel: { "NORTH": "full" }
curl http://localhost:3000/health/south  # → serviceLevel: { "SOUTH": "unavailable" }
```

---

## TC-08: Cả 2 node cùng down

**Thao tác:**

```bash
docker stop south-primary south-replica

# Gửi request đến Miền Nam
curl http://localhost:3000/trips/history \
  -H "Authorization: Bearer <token>"
```

**Kết quả mong đợi:** HTTP 200, data rỗng cho miền Nam, app không crash
```json
{
  "readOnly": true,
  "warning": "Miền Nam không khả dụng. Chỉ hiển thị dữ liệu Miền Bắc.",
  "activeNode": "SOUTH_REPLICA",
  "data": [...]
}
```

---

## TC-09: Phục hồi tự động

**Thao tác:**

```bash
# Sau TC-04, khởi động lại south primary
docker start south-primary

# Chờ 10 giây (health check interval × 2)
sleep 10

# Kiểm tra health
curl http://localhost:3000/health/south
```

**Kết quả mong đợi:**
```json
{
  "data": {
    "serviceLevel": { "SOUTH": "full" },
    "nodes": {
      "SOUTH_PRIMARY": { "status": "online" }
    }
  }
}
```

**Backend log phải có:**
```
[HealthMonitor] Trạng thái thay đổi: SOUTH_PRIMARY: OFFLINE → ONLINE
[WRITE ROUTE] lat=10.77 → SOUTH → SOUTH_PRIMARY
```

**Thử đặt chuyến lại → thành công**

---

## TC-10: Health API real-time

**Thao tác:**

```bash
# Tắt 1 node
docker stop north-replica

# Kiểm tra ngay
curl http://localhost:3000/health
```

**Kết quả mong đợi:** Trong vòng 5 giây, health API phản ánh đúng trạng thái
```json
{
  "data": {
    "nodes": {
      "NORTH_PRIMARY": { "status": "online", "responseTimeMs": 2 },
      "NORTH_REPLICA": { "status": "offline", "responseTimeMs": null },
      "SOUTH_PRIMARY": { "status": "online", "responseTimeMs": 3 },
      "SOUTH_REPLICA": { "status": "online", "responseTimeMs": 4 }
    },
    "serviceLevel": {
      "NORTH": "full",
      "SOUTH": "full"
    }
  }
}
```

**Lưu ý:** `NORTH` vẫn là `"full"` vì primary vẫn online. Chỉ khi primary down mới là `"readonly"`.

---

## Chạy unit tests (không cần DB)

```bash
cd backend
npm test -- --testPathPatterns=distributed-db
```

**Kết quả mong đợi:** Tất cả pass

```
PASS src/test-cases/distributed-db.spec.ts
  LocationRouterService
    ✓ TC-01: lat=21.03 (Hà Nội) → NORTH
    ✓ TC-02: lat=10.77 (TP.HCM) → SOUTH
    ✓ TC-02b: Ngưỡng ranh giới lat=16.5 → NORTH
    ✓ TC-02c: Ngưỡng ranh giới lat=16.49 → SOUTH
    ✓ TC-02d: Ngưỡng nhất quán với REGION_LATITUDE_THRESHOLD
  DbRoutingService — Failover & Read-Only
    ✓ TC-03: Cả 2 node online → đọc từ primary, readOnly=false
    ✓ TC-04: South Primary down → tự chuyển sang SOUTH_REPLICA (READ-ONLY)
    ✓ TC-05: South Primary down → getWriteContext() throw ServiceUnavailableException
    ✓ TC-05b: exception có warning message rõ ràng
    ✓ TC-06: South Primary down → getReadContext() trả về southReplica pool
    ✓ TC-07: South hoàn toàn down → North vẫn full service
    ✓ TC-07b: North hoàn toàn down → South vẫn full service
    ✓ TC-08: Cả South Primary + Replica down → ServiceUnavailableException
    ✓ TC-08b: Exception khi cả 2 down có message cảnh báo rõ ràng
    ✓ TC-09: Primary phục hồi → routing trở về primary (full mode)
    ✓ TC-10: serviceLevelForRegion() trả đúng trạng thái
  DatabaseService.queryWithFailover
    ✓ TC-03a: Primary online → isReadOnly=false
    ✓ TC-04a: Primary down → fallback replica, isReadOnly=true
    ✓ TC-05a: Primary down + isWriteRequest=true → throw ServiceUnavailableException
    ✓ TC-08a: Cả primary + replica down → throw ServiceUnavailableException
  determineRegionFromLocation
    ✓ TC-01a: Hà Nội lat=21.03 → NORTH
    ✓ TC-02a: TP.HCM lat=10.77 → SOUTH
    ✓ Đà Nẵng lat=16.07 → SOUTH
    ✓ Huế lat=16.46 → SOUTH
    ✓ Ngưỡng chính xác lat=16.5 → NORTH
    ✓ Nhất quán với LocationRouterService

Test Suites: 1 passed, 1 total
Tests:       26 passed, 26 total
```
