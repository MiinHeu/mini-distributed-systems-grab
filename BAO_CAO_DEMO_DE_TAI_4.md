# BÁO CÁO HỆ THỐNG & KỊCH BẢN DEMO BẢO VỆ ĐỀ TÀI 4
**Tên đề tài:** Ứng dụng Gọi xe theo Vị trí (Phân tán dữ liệu theo địa lý, có Failover & Replication)

Tài liệu này dùng để trình bày trước Giám khảo. Nó ánh xạ **chính xác 1-1** với 5 yêu cầu trong đề bài, chỉ rõ code nằm ở đâu và cách demo trực quan.

---

## PHẦN 1: ÁNH XẠ KIẾN TRÚC VỚI 5 YÊU CẦU CỦA ĐỀ BÀI

### 1. Định tuyến theo vị trí (Location-based Routing)
* **Yêu cầu:** App giả lập nhận tọa độ/chọn Tỉnh, tự động kết nối Server tương ứng (Bắc/Nam).
* **Cách hệ thống giải quyết:**
  - Frontend truyền `latitude` và `longitude` lên Backend qua API.
  - Backend sử dụng `LocationRouterService` (file: `backend/src/router/location-router.service.ts`).
  - **Logic phân mảnh (Sharding):** Lấy vĩ độ `16.5` (Đèo Hải Vân) làm ranh giới.
    - `lat > 16.5` (Hà Nội, lân cận) $\rightarrow$ Giao dịch ghi/đọc vào `NORTH`.
    - `lat <= 16.5` (TP.HCM, lân cận) $\rightarrow$ Giao dịch ghi/đọc vào `SOUTH`.

### 2. Cấu hình Nhân bản (Master-Slave Replication)
* **Yêu cầu:** Mỗi Primary có 1 Replica dự phòng để đồng bộ dữ liệu.
* **Cách hệ thống giải quyết:**
  - Cấu trúc 4 Node CSDL: `north-primary`, `north-replica`, `south-primary`, `south-replica`.
  - Node Primary được bật cấu hình `wal_level=replica` và `max_wal_senders=3`.
  - Node Replica khởi tạo dữ liệu tự động bằng lệnh `pg_basebackup -h <primary-host> -D ... -U replicator -Xs -R` (xem trong `docker-compose.yml`).
  - Dữ liệu Ghi vào Primary sẽ lập tức được stream sang Replica theo thời gian thực.

### 3. Cơ chế Failover (Chuyển đổi dự phòng)
* **Yêu cầu:** Khi Primary sập, ứng dụng tự động chuyển kết nối sang Replica.
* **Cách hệ thống giải quyết:**
  - `HealthService` (`backend/src/health/health.service.ts`) liên tục "ping" (SELECT 1) tới 4 node mỗi 5 giây.
  - Khi phát hiện `primary` lỗi (ping thất bại), trạng thái được cập nhật thành `OFFLINE`.
  - `DbRoutingService` tự động đánh giá: Nếu Primary OFFLINE mà Replica ONLINE $\rightarrow$ Các truy vấn ĐỌC sẽ được tự động đổi hướng sang connection pool của Replica.

### 4. Chế độ Read-Only (Chỉ đọc khi bảo trì)
* **Yêu cầu:** Primary sập $\rightarrow$ Vẫn xem được lịch sử chuyến đi (từ Replica) nhưng không thể Đặt chuyến mới.
* **Cách hệ thống giải quyết:**
  - **Truy vấn Đọc (Lịch sử):** Đi qua hàm `getReadContext()`. Nếu Primary sập, trả về Replica pool kèm cờ `readOnly: true`. Giao diện vẫn hiển thị danh sách chuyến.
  - **Truy vấn Ghi (Đặt xe):** Đi qua hàm `getWriteContext()`. Nếu Primary sập, hàm lập tức `throw ServiceUnavailableException` và từ chối ghi.
  - Giao diện app nhận được mã lỗi `503`, chặn user và hiển thị thông báo: *"Tính năng GHI tạm thời bị khóa do hệ thống đang bảo trì. Replica chỉ cho phép ĐỌC."*

### 5. Đề xuất Test Case đảm bảo hoạt động
* Hệ thống đã thiết lập **26 Unit Test** tự động (file `distributed-db.spec.ts`) bao phủ toàn bộ các kịch bản biên (ngưỡng 16.5), kịch bản sập 1 node, sập 2 node, phục hồi node. Test chạy tự động để chứng minh thuật toán đúng mà không cần CSDL.
* Các kịch bản Integration Test (Test thủ công) được trình bày trong kịch bản demo dưới đây.

---

## PHẦN 2: KỊCH BẢN DEMO THỰC TẾ CHO GIÁM KHẢO

> **Chuẩn bị trước khi demo:** 
> Đảm bảo toàn bộ 4 CSDL đang chạy: `docker compose up -d` và Backend đang chạy: `npm run start:dev`.

### Bước 1: Khởi động và Chứng minh Replication (Yêu cầu 2)
1. Mở app/Postman, đăng nhập tài khoản Khách hàng ở **Hà Nội** (Miền Bắc).
2. Đặt 1 chuyến xe mới.
3. Mở Terminal chứng minh CSDL đã nhân bản ngay lập tức:
   - Truy vấn vào Replica Miền Bắc: 
     `docker exec -it north-replica psql -U rideshare_admin -d rideshare_db -c "SELECT id, pickup_address, dropoff_address FROM trips ORDER BY created_at DESC LIMIT 1;"`
   - **Kết quả:** Chuyến xe vừa đặt trên Primary đã xuất hiện ở Replica.

### Bước 2: Chứng minh Định tuyến Phân tán (Yêu cầu 1)
1. Đăng nhập thêm một tài khoản Khách hàng ở **TP.HCM** (Miền Nam).
2. Đặt chuyến xe tại TP.HCM.
3. Chỉ cho giám khảo xem log của Backend:
   - Sẽ thấy dòng log: `[WRITE ROUTE] lat=10.77 → SOUTH → SOUTH_PRIMARY`
   - So sánh với lúc đặt ở Hà Nội: `[WRITE ROUTE] lat=21.02 → NORTH → NORTH_PRIMARY`
4. **Kết luận:** Hệ thống đã tự động điều hướng truy vấn đến đúng máy chủ vật lý ở khu vực đó.

### Bước 3: Đánh sập CSDL — Test Failover & Read-Only (Yêu cầu 3 & 4)
*Đây là phần quan trọng nhất của bài.*

1. **Thao tác:** Đánh sập Server Miền Nam (Primary).
   - Mở terminal: `docker stop south-primary`
2. **Quan sát Log Backend:** Đợi vài giây, giám khảo sẽ thấy:
   - `[HealthMonitor] Trạng thái thay đổi: SOUTH_PRIMARY: ONLINE → OFFLINE`
3. **Demo Read-Only (Xem lịch sử):**
   - Trên app của user TP.HCM, vào màn hình **Lịch sử chuyến đi**.
   - **Kết quả:** Lịch sử *vẫn tải lên thành công*. (Vì hệ thống đã tự động rẽ nhánh sang `SOUTH_REPLICA`).
   - App hiển thị dòng cảnh báo màu vàng: *"Miền Nam đang bảo trì. Dữ liệu được lấy từ bản sao (read-only)."*
4. **Demo Chặn Write (Đặt chuyến mới):**
   - User TP.HCM quay lại màn hình chính, thử **Đặt xe mới**.
   - **Kết quả:** Thất bại. App báo lỗi: *"Tính năng GHI (Miền Nam) tạm thời bị khóa do hệ thống đang bảo trì. Replica chỉ cho phép ĐỌC."*
5. **Chứng minh tính Độc lập (Isolation):**
   - Lúc này Miền Nam đang sập Primary. Mở app của user Hà Nội, thử đặt chuyến.
   - **Kết quả:** Thành công 100%. (Vì `NORTH_PRIMARY` vẫn sống, sự cố Miền Nam không làm ảnh hưởng Miền Bắc).

### Bước 4: Tự động phục hồi (Self-Healing)
1. **Thao tác:** Bật lại Server Miền Nam.
   - Mở terminal: `docker start south-primary`
2. **Quan sát:**
   - Log Backend: `[HealthMonitor] Trạng thái thay đổi: SOUTH_PRIMARY: OFFLINE → ONLINE`
3. **Kết quả:** 
   - User TP.HCM bấm Đặt xe lại $\rightarrow$ Thành công. Dòng cảnh báo màu vàng biến mất.

### Bước 5: Run Unit Tests (Yêu cầu 5)
1. Bật Terminal chạy lệnh: 
   `npm run test -- --testPathPatterns="distributed-db"`
2. **Kết quả:** Show cho giám khảo thấy 26 test cases cover mọi kịch bản định tuyến, failover, read-only đều báo **PASS màu xanh**.

---
**TỔNG KẾT:** Hệ thống đã mô phỏng xuất sắc cấu trúc CSDL của ứng dụng Grab/Uber: Phân mảnh dữ liệu theo địa lý để tối ưu độ trễ, và đảm bảo tính sẵn sàng cao (High Availability) bằng Master-Slave Failover.
