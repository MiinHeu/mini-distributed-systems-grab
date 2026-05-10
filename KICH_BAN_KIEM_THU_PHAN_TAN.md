# Kịch Bản Kiểm Thử Hệ Thống Phân Tán (Mini Grab)

Tài liệu này mô tả 5 kịch bản kiểm thử cốt lõi nhằm chứng minh tính đúng đắn của kiến trúc CSDL Phân tán (Sharding, Replication, Failover).

---

## TC-01: Định tuyến dữ liệu theo vị trí (Sharding)
**Mục tiêu:** Kiểm tra khả năng tự động xác định và lưu trữ dữ liệu vào đúng vùng vật lý.

*   **Đầu vào:** Đăng ký tài khoản tại tọa độ Hà Nội (Lat: 21.03, Lng: 105.85).
*   **Thao tác:** Đặt một chuyến xe tại vị trí này.
*   **Kết quả mong đợi:**
    1. Backend nhận diện tọa độ > 16.5 -> Xác định vùng **NORTH**.
    2. Kiểm tra DB Miền Bắc (`north-primary`): Chuyến xe mới xuất hiện trong bảng `trips`.
    3. Kiểm tra DB Miền Nam (`south-primary`): Không có chuyến xe này.
*   **Ý nghĩa:** Chứng minh cơ chế phân mảnh dữ liệu (Horizontal Sharding) theo vị trí địa lý.

---

## TC-02: Tính nhất quán dữ liệu xuyên vùng (Full Replication)
**Mục tiêu:** Đảm bảo dữ liệu người dùng (Users/Drivers) có mặt ở mọi Node để phục vụ đăng nhập toàn cầu.

*   **Thao tác:** 
    1. Đăng ký một tài khoản khách hàng mới tại Miền Nam.
    2. Dùng tài khoản đó đăng nhập khi GPS đang ở Miền Bắc.
*   **Kết quả mong đợi:**
    1. Đăng nhập thành công dù User được tạo ở node phía Nam.
    2. Thông tin cá nhân hiện ra chính xác.
*   **Ý nghĩa:** Chứng minh bảng `users` được cấu hình **Full Replication**, giúp người dùng có thể sử dụng dịch vụ ở bất cứ đâu mà không cần đồng bộ thủ công.

---

## TC-03: Khả năng chịu lỗi và Tự động phục hồi (Failover)
**Mục tiêu:** Chứng minh hệ thống vẫn sống sót khi Server chính gặp sự cố.

*   **Thao tác:** 
    1. Chạy lệnh: `docker stop south-primary`.
    2. Mở App khách hàng tại Miền Nam, xem **Lịch sử chuyến đi**.
*   **Kết quả mong đợi:**
    1. App vẫn hiện danh sách chuyến đi bình thường (không báo lỗi timeout).
    2. Log Backend hiện thông báo: `[Failover] SOUTH Primary lỗi. Đang tự động lấy dữ liệu dự phòng từ REPLICA...`.
*   **Ý nghĩa:** Chứng minh tính sẵn sàng cao (High Availability). Dữ liệu được đọc từ bản sao khi bản chính ngoại tuyến.

---

## TC-04: Tách biệt luồng Đọc/Ghi (Read/Write Splitting)
**Mục tiêu:** Kiểm tra việc tối ưu hóa hiệu năng bằng cách phân tải cho các Node bản sao.

*   **Thao tác:** Thực hiện liên tiếp 2 hành động:
    1. Đặt xe (Write).
    2. Xem lịch sử chuyến xe (Read).
*   **Kết quả mong đợi:**
    1. Thao tác Đặt xe: Log Backend báo kết nối tới **Primary Node**.
    2. Thao tác Xem lịch sử: Log Backend báo kết nối tới **Replica Node**.
*   **Ý nghĩa:** Chứng minh kiến trúc Master-Slave giúp giảm tải cho server chính, tận dụng tối đa tài nguyên của server bản sao.

---

## TC-05: Toàn vẹn dữ liệu trên bản sao (Read-Only Integrity)
**Mục tiêu:** Đảm bảo các node bản sao không bị can thiệp làm sai lệch dữ liệu gốc.

*   **Thao tác:** Chạy lệnh SQL ghi trực tiếp vào server Replica:
    ```powershell
    docker exec -it north-replica psql -U rideshare_admin -d rideshare_db -c "INSERT INTO trips (id, status) VALUES ('999999', 'pending');"
    ```
*   **Kết quả mong đợi:** Hệ thống trả về lỗi: `ERROR: cannot execute INSERT in a read-only transaction`.
*   **Ý nghĩa:** Khẳng định cấu hình Replication chuẩn xác, bảo vệ dữ liệu khỏi các thao tác ghi ngoài ý muốn trên các node phụ.

---

## TC-06: Độ trễ đồng bộ dữ liệu (Replication Lag)
**Mục tiêu:** Kiểm tra tốc độ sao chép dữ liệu từ Primary sang Replica.

*   **Thao tác:** 
    1. Chạy lệnh: `docker exec -it north-primary psql -U rideshare_admin -d rideshare_db -c "INSERT INTO trips (id, customer_id, status) VALUES ('777777', '1', 'pending');"`
    2. Ngay lập tức truy vấn tại Replica: `docker exec -it north-replica psql -U rideshare_admin -d rideshare_db -c "SELECT id FROM trips WHERE id = '777777';"`
*   **Kết quả mong đợi:** Dữ liệu xuất hiện tại Replica gần như tức thì (độ trễ < 1 giây).
*   **Ý nghĩa:** Chứng minh cơ chế Streaming Replication hoạt động ổn định, đảm bảo tính nhất quán cuối cùng (Eventual Consistency).

---

## TC-07: Định tuyến tối ưu và Giảm độ trễ (Optimal Routing)
**Mục tiêu:** Chứng minh hệ thống luôn chọn Node CSDL gần người dùng nhất.

*   **Thao tác:** 
    1. Giả lập người dùng tại Hà Nội -> Kiểm tra Log Backend.
    2. Giả lập người dùng tại TP.HCM -> Kiểm tra Log Backend.
*   **Kết quả mong đợi:** 
    1. Khi ở Hà Nội: Backend mở kết nối tới Node **NORTH (Port 5432)**.
    2. Khi ở TP.HCM: Backend mở kết nối tới Node **SOUTH (Port 5434)**.
*   **Ý nghĩa:** Trong thực tế triển khai WAN, việc chọn đúng Node địa phương giúp giảm độ trễ mạng từ ~100ms xuống < 5ms, tối ưu hóa trải nghiệm người dùng.
