# 📑 Báo Cáo Kiểm Toán & Đánh Giá Code Tích Hợp (Distributed Grab System)

Đây là bản đánh giá toàn diện về chất lượng code, độ hoàn thiện và các vấn đề còn rủi ro/dang dở của từng kỹ sư sau quá trình hợp nhất dự án vào nhánh `tich-hop-code`. Báo cáo này giúp bạn có cái nhìn tổng quan nhất để đánh giá và gửi lại cho từng thành viên trong team. Nội dung dựa trên cấu hình code cuối cùng trong nhánh tích hợp.

---

## 1. Thành viên 1 (Phân quyền & Bảo mật - Auth)
**🟢 Trạng thái: HOÀN CHỈNH & RẤT TỐT**
*   **Đã làm được**: 
    *   Hệ thống JWT chạy cực kì mượt mà thông qua `JwtAuthGuard`. 
    *   Giao diện Frontend (`LoginPage`, `RegisterPage`, `ProfilePage`, Quản lý đa ngôn ngữ) được thiết kế tỉ mỉ, trơn tru. Có phân chia rõ các User Role (customer/driver/admin).
*   **Điểm tốt nhất**: Code bảo mật rất sạch sẽ, hoàn thành đúng chuẩn Token Based. Đã xử lý bắt lỗi tốt trên cả frontend lẫn backend. 
*   **Cần cải thiện**: Không có lỗi gì để chê. Code xứng đáng làm nền tảng Auth vững chắc cho cả hệ thống.

## 2. Thành viên 2 (Mobile App - Tài xế & Khách hàng)
**🟢 Trạng thái: LÊN HÌNH HOÀN CHỈNH, ĐANG Ở GIAI ĐOẠN ĐẦU**
*   **Đã làm được**: Khởi tạo thành công bộ khung React Native / Expo (`mobile/App.tsx`). Tích hợp mượt mà toàn bộ API Phân quyền của Người 1 (Login, Register, Profile, Đổi Avatar, Đổi Ngôn Ngữ).
*   **Điểm tốt nhất**: Code giao diện (UI) rất gọn gàng. Kết nối với `http://10.0.2.2:3000` (địa chỉ localhost của Android Emulator) chuẩn xác, cho phép upload ảnh mượt mà bằng `expo-image-picker`.
*   **Cần cải thiện (Dang dở)**: Hiện tại App Mobile mới chỉ hoàn thiện luồng Xác thực (Auth). Cần phối hợp với **Người 4 (Vị trí)** để nhúng bản đồ Map (Booking/Tọa độ) và gọi các API của luồng đặt vé (Người 5 & Nhật).

## 2.5 Thành viên 4 (Dịch vụ Vị trí / Thuật toán Định Tuyến Cơ Bản)
**🟢 Trạng thái: HOÀN THIỆN XƯƠNG SỐNG BACKEND**
*   **Đã làm được**: Xây dựng thành công `LocationRouterService`, nhận biết tọa độ GPS để điều hướng.
*   **Điểm tốt nhất**: Cấp "trí tuệ không gian" cho bộ định tuyến.
*   **Chiến lược tiếp theo**: Bắt buộc phải gắn với App của Người 2 để hứng luồng vị trí tọa độ liên tục!

## 3. Kỹ sư Nhật (Kiến trúc phân luồng Distributed DB & Node Failover)
**🌟 Trạng thái: HOÀN CHỈNH KIẾN TRÚC & XUẤT SẮC NHẤT**
*   **Đã làm được**: 
    *   Sáng tạo ra `DbRoutingService`, tận dụng hàm của Người 4 để tự động cung cấp đường truyền Đọc (Read context) và Ghi (Write context) kết nối tới các Node cơ sở dữ liệu vật lý. 
    *   Setup thành công **Thuật toán Tự hàn gắn (Fail-over)** cực kì an toàn bằng `health.service.ts`. Cứ mỗi 5 giây hệ thống sẽ "ping" thử các máy chủ Database. Nếu Server Master bị sập, nó chớp mắt tự động chĩa qua Database dự phòng (Replica) và đóng băng tính năng Insert (Biến hệ thống thành Read-only) để chống thất thoát dữ liệu.
*   **Điểm tốt nhất**: Nắm và giải quyết chính xác 100% đề bài "Xây dựng Hệ Thống Phân Tán (Distributed)".
*   **Tình trạng khi tích hợp**: Code cực kỳ nâng cao và xịn. Để tránh xung đột với các logic quá đơn giản của người 5, tôi đã lưu gọn lại toàn bộ thuật toán tinh hoa này chạy song song ở luồng định tuyến API `/trips/history-legacy`.

## 4. Thành viên 5 (Quản lý Chuyến đi & Tình trạng hệ thống)
**🟡 Trạng thái: HOẠT ĐỘNG NHƯNG CÓ LỖI THIẾT KẾ ĐÁNG LO (ARCHITECTURAL FLAW)**
*   **Đã làm được**: 
    *   Hoàn thành xuất sắc Front-End `SystemMonitor.tsx` với chỉ báo Real-time đẹp mắt. 
    *   Thành công làm ra luồng API Đặt Chuyến có chặn thêm Bảo mật `JwtAuthGuard` của Người 1 rất bài bản!
*   **Vấn đề cực kì nghiêm trọng (Cần báo cáo/nhắc nhở)**:
    1.  **Code HardCode cụm miền Nam**: Cụm cấu trúc Database ở `app.module.ts` thiếu mất Miền Bắc. Người này chỉ khai báo thông số kết nối TypeORM cho miền Nam (`DB_SOUTH_PRIMARY`) rồi bỏ đi mất!
    2.  **Đạp đổ toàn bộ Triết lý Phân Tán**: Trong API gọi cuốc `trips.service.ts`, Người 5 đã tự động viết lệnh gọi ngầm định toàn bộ xuống `primaryDS` (Database Miền Nam). Hệ lụy: **Hiện tại nếu tài xế Cầu Giấy (Hà Nội, Miền Bắc) Book xe, dữ liệu bị phi tuốt vào cụm Server Hồ Chí Minh!**
    3.  **Hủy hoại code Frontend của đồng đội**: Khi nộp code, cấu trúc React Router bên Front-End (`App.tsx`) người này viết đè xóa rạch xóa rành giao diện của Thành viên 1 chỉ để ép web hiện duy nhất màn hình Monitor của mình.
*   **Cách tôi đã xử lý tạm**: Tôi đã can thiệp tay để cả UI của Người 1 và màn Monitor của N5 chạy ổn định cạnh nhau. Tôi cũng phân tách 2 luồng chuyến xe ra (`/book` của N5 và `/book-legacy` của Nhật) để app không bị chết. Tuy nhiên phải họp khẩn Thành viên 5 với Kỹ sư Nhật để thống nhất luồng CSDL.

## 5. Thành viên 8 (Thống kê - Dashboard Web)
**🟢 Trạng thái: HOÀN THÀNH RẤT TỐT, SIÊU ĐẸP, BẢO LƯU ĐƯỢC KIẾN TRÚC DB**
*   **Đã làm được**: 
    *   Sử dụng nhuyễn nhuyễn thư viện Recharts dựng giao diện Dashboard ngỡ ngàng. Đầy đủ Doanh thu, Line chart, Bar Chart.
    *   Trái ngược với "sự cố chấp" của Người 5, Kỹ sư số 8 **nghiêm túc kế thừa, tái sử dụng rất chuẩn chỉ `DbRoutingService` của Nhật** trong `/reports/reports.controller.ts`. Code truy xuất Data Report bằng SQL (SUM/AVG) đi luồng cực chuẩn để tự hỏi xem Cụm Máy Chủ nào rảnh thì mới đẩy tính toán xuống đó thay vì gọi bừa bãi.
*   **Lỗi nhỏ xíu (Minor Flaw)**: 
    *   Ở Front-end, bạn này đang fix cứng hàm `fetch('/reports/revenue?latitude=16.0')`. Vĩ độ 16 là biên giới Đà Nẵng. Nếu làm cho Production thì vĩ độ này phải được tự động thu thập từ trình duyệt thay vì nạp sẵn 16. Nhưng chỉ là UI hiển thị báo cáo thì cũng cực kì tuyệt vời rồi.

---

## ✅ BIỆN PHÁP CHỐT HẠ (KẾ HOẠCH TUẦN TIẾP)
Hệ thống **đã chạy được End-to-End trọn vẹn cả chu trình đăng nhập -> đặt xe -> theo dõi trạng thái mạng -> vẽ dashboard**. 

**To-Do-List cho Nhóm bạn ở chặng nước rút:**
1. Mở cuộc họp nội bộ yêu cầu **Người 5** đọc hiểu lại tài liệu `DbRoutingService` của **Nhật** nhằm chỉnh sửa Code Booking của mình chạy được đa cụm Server theo Vĩ độ.
2. Đôn đốc **Người 3 (Khoá Optimistic Lock Cuốc Xe Tránh Đua Lệnh)** và **Người 7 (Giao diện Admin Manage)** nộp bài ngay khi kịp. Lúc đó tôi sẽ tiếp tục nhúng code hộ bạn.
3. Tuyệt đối trong máy cá nhân, ae phải cấu hình `docker-compose.yml` mở đủ cả 4 Instances cho Database (Đã có sẵn trong Project hiện tại) để test thực tế tính năng Monitor! 

Chúc team có một kì báo cáo đồ án bùng nổ điểm A+!
