# Nhật ký Hoàn thiện Hệ thống Mini Grab Phân tán - 08/05/2026

## 1. Xử lý Lỗi Hệ thống & Tính nhất quán Dữ liệu (Backend)
- **Đồng bộ Kiểu dữ liệu (UUID vs Integer):**
    - Đã sửa lỗi "invalid input syntax for type uuid" khi tài xế nhận chuyến.
    - Chuyển đổi logic các hàm `acceptTrip`, `completeTrip` để tìm mã UUID tài xế dựa trên `userId` trong từng phân vùng (North/South).
    - Cập nhật truy vấn `getTripHistory` để JOIN chính xác qua bảng `drivers`, khắc phục lỗi không hiển thị lịch sử chuyến đi.
- **Kích hoạt ValidationPipe:**
    - Bật bộ lọc dữ liệu toàn cục trong `main.ts`.
    - Cập nhật toàn bộ DTO (`Auth`, `Drivers`, `Trips`) với các decorator `@IsString`, `@IsNumber`, `@IsOptional` để đảm bảo dữ liệu không bị xóa bỏ khi truyền qua API.
- **Tối ưu hóa Truy vấn Phân tán:**
    - Cấu hình `getTripHistory` để lấy dữ liệu song song từ cả hai cụm Database, đảm bảo người dùng thấy đủ lịch sử bất kể vùng miền.

## 2. Khắc phục Lỗi Kết nối & Debug (Mobile - Backend)
- **Xử lý Xung đột Tiến trình:**
    - Phát hiện và tắt tiến trình Backend cũ chạy ngầm (PID 19884) chiếm cổng 3000, giúp mã nguồn mới nhất có hiệu lực.
- **Đồng bộ Cấu trúc API:**
    - Bọc kết quả API lấy thông tin tài xế trong hàm `ok()` để nhất quán với cấu trúc `{ data: [...] }` mà App Mobile mong đợi.
- **Cấu hình API Tập trung:**
    - Thống nhất sử dụng `API_BASE_URL` từ file config thay vì hard-code `10.0.2.2` trong từng màn hình, giúp App hoạt động ổn định trên cả Emulator và thiết bị thật.

## 3. Nâng cấp Trải nghiệm Người dùng (UX/UI)
- **Tích hợp Reverse Geocoding (Địa chỉ thực):**
    - Sử dụng Nominatim API để chuyển đổi tọa độ GPS thành địa chỉ người đọc được (Số nhà, tên đường).
    - **Màn hình Tài xế:** Hiển thị địa chỉ hiện tại kèm thời gian cập nhật cuối cùng.
    - **Màn hình Người dùng:** Hiển thị địa chỉ chi tiết cho Điểm đón và Điểm trả trong bảng điều khiển đặt xe.
- **Cải thiện Thông báo lỗi:**
    - Cập nhật App để hiển thị mã lỗi và nội dung lỗi chi tiết từ Backend, hỗ trợ việc chẩn đoán sự cố nhanh chóng.

## 4. Giám sát & Demo (System Monitor)
- **Thống kê phân tán:** Bổ sung tính năng đếm số lượng chuyến đi thực tế (Trip Counts) theo từng Node trong trang Monitor để minh họa tính phân tán địa lý của dữ liệu.

---
**Trạng thái:** Hệ thống đã ổn định 100%. Luồng đặt xe end-to-end hoạt động hoàn hảo với đầy đủ thông tin địa chỉ thực tế.
