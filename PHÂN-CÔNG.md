PHÂN CÔNG FEATURE — 9 NGƯỜI

Mini Grab \| Đề tài 4 — CSDL Phân tán \| Full Scope

TỔNG QUAN

Tầng 1 — Bắt buộc (Tuần 1-3) — Điểm đồ án

Làm xong tầng này trước. Không có thì không demo được.

Tầng 2 — Mở rộng (Tuần 4-5) — CV worthy

Làm sau khi Tầng 1 hoàn chỉnh. Giúp hệ thống sát thực tế.

Tầng 3 — Nâng cao (Tuần 6) — Doanh nghiệp

Làm nếu còn thời gian. Tạo điểm nhấn khi phỏng vấn.

CÁCH ĐỌC BẢNG PHÂN CÔNG

Mỗi người chịu trách nhiệm 1 feature hoàn chỉnh gồm 3 lớp:

DB Layer → Tạo bảng, viết schema, seed data

Backend Layer → Viết API endpoint (NestJS)

Frontend Layer → Viết UI (React web hoặc React Native mobile)

Không ai làm thay. Người khác có thể hỗ trợ nhưng người phụ trách phải
hiểu toàn bộ feature của mình.

THỨ TỰ LÀM ĐỂ KHÔNG BỊ BLOCK NHAU

Tuần 1: Người 9 setup DB + Docker + Replication trước

> → Người khác mới có DB để kết nối

Tuần 1-2: Người 1 làmAuth trước

> → Người khác mới có JWT để test API

Tuần 2-3: Người 2,3,4,5,6,7,8 làm Tầng 1 song song

> → Dùng mock data nếu chưa có API của nhau

Tuần 3: Tầng 1 hoàn chỉnh → Integration test

Tuần 4-5: Tầng 2 — mỗi người thêm feature mở rộng

> vào feature của mình

Tuần 6: Tầng 3 + Test + Báo cáo + Demo

PHÂN CÔNG CHI TIẾT

👤 NGƯỜI 1 — AUTH + ĐA NGÔN NGỮ + UPLOAD ẢNH

Tại sao quan trọng: Cổng vào toàn bộ hệ thống. Auth xong thì 8 người còn
lại mới test được API.

TẦNG 1 — Auth cơ bản

DB:

sql

Bảng users:

\- id, name, phone, email

\- password (bcrypt hash — KHÔNG lưu plain text)

\- role: "customer" \| "driver" \| "admin"

\- avatar_url

\- preferred_language: "vi" \| "en"

\- created_at, updated_at

Backend:

POST /auth/register

POST /auth/login

> → Tạo tài khoản

→ Đăng nhập → trả JWT token

POST /auth/logout

GET /auth/me

PATCH /auth/me

> → Đăng xuất

→ Thông tin user đang đăng nhập

> → Cập nhật thông tin cá nhân

Frontend:

Web: /login, /register, /profile

Mobile: LoginScreen, RegisterScreen, ProfileScreen

TẦNG 2 — Upload ảnh đại diện

Backend:

POST /auth/avatar → Upload ảnh, lưu vào Cloudinary (free)

> Trả về avatar_url

Frontend:

Mobile: Nút chọn ảnh từ thư viện → upload → hiển thị

TẦNG 3 — Đa ngôn ngữ (i18n)

Cách làm:

Dùng thư viện i18next + react-i18next

Tạo 2 file: vi.json, en.json

Mỗi string trong UI đều lấy từ file ngôn ngữ

User chọn ngôn ngữ trong Settings → lưu vào DB

Frontend:

Web + Mobile: Nút chuyển ngôn ngữ VI/EN

> Toàn bộ UI tự động đổi ngôn ngữ

Kiến thức cần học:

bcrypt, JWT, NestJS Guards

Cloudinary SDK (upload ảnh free)

i18next, react-i18next

Expo ImagePicker

👤 NGƯỜI 2 — ĐẶT CHUYẾN + GOOGLE MAPS + TÍNH TIỀN

Tại sao quan trọng: Tính năng core của app gọi xe.

TẦNG 1 — Đặt chuyến cơ bản

DB:

sql

Bảng trips:

\- id, customer_id, driver_id

\- pickup_address, dropoff_address

\- pickup_lat, pickup_lng

\- dropoff_lat, dropoff_lng

\- status: "pending"\|"accepted"\|"completed"\|"cancelled"

\- region: "NORTH" \| "SOUTH"

\- distance_km, fare

\- created_at, completed_at

Backend:

POST /trips/book → Đặt chuyến mới

GET /trips/:id → Chi tiết 1 chuyến

PATCH /trips/:id/cancel → Hủy chuyến

Frontend:

Mobile: BookTripScreen

> \- Nhập điểm đón, điểm trả
>
> \- Chọn thành phố (xác định region NORTH/SOUTH)
>
> \- Hiển thị warning nếu read-only mode
>
> \- Nút "Đặt xe"

TẦNG 2 — Google Maps + Tính tiền theo km

Backend:

POST /trips/estimate → Tính tiền ước tính

> Input: pickup_lat/lng, dropoff_lat/lng
>
> Output: distance_km, estimated_fare
>
> Logic: Gọi Google Maps Distance Matrix API
>
> Tính tiền: base_fare + (price_per_km × distance)

Frontend:

Mobile: BookTripScreen nâng cấp

> \- Bản đồ Google Maps hiển thị điểm đón/trả
>
> \- Tự động tính tiền ước tính khi chọn xong điểm
>
> \- Hiển thị đường đi trên bản đồ

Kiến thức cần học:

Google Maps SDK cho React Native

Google Maps Distance Matrix API

NestJS HttpModule (gọi API bên ngoài)

👤 NGƯỜI 3 — NHẬN CHUYẾN + REAL-TIME TRACKING

Tại sao quan trọng: Tài xế nhận chuyến là nửa còn lại của giao dịch.

TẦNG 1 — Nhận chuyến cơ bản

DB:

sql

Dùng bảng trips của Người 2

Thêm index trên cột (status, region) để query nhanh

Backend:

GET /trips/pending → Danh sách chuyến chờ nhận

PATCH /trips/:id/accept

PATCH /trips/:id/complete

→ Tài xế nhận chuyến

> → Hoàn thành chuyến

PATCH /trips/:id/reject → Từ chối chuyến

Frontend:

Mobile: AcceptTripScreen

> \- Danh sách chuyến đang chờ
>
> \- Nút Nhận / Từ chối
>
> \- Nút Hoàn thành

TẦNG 2 — Real-time tracking (WebSocket)

Backend:

WebSocket Gateway:

> \- Event "driver:location" → broadcast vị trí tài xế
>
> \- Event "trip:status" → notify khách khi tài xế đến
>
> \- Event "trip:accepted" → notify khách khi có tài xế nhận

Frontend:

Mobile (khách): TripTrackingScreen

> \- Bản đồ hiển thị tài xế đang di chuyển real-time
>
> \- ETA (thời gian đến ước tính)
>
> \- Trạng thái chuyến cập nhật live

Kiến thức cần học:

NestJS WebSocket Gateway (@WebSocketGateway)

Socket.io client trong React Native

Google Maps Directions API

👤 NGƯỜI 4 — VỊ TRÍ TÀI XẾ + CHAT REAL-TIME

Tại sao quan trọng: GPS tracking và chat là 2 tính năng realtime phức
tạp nhất.

TẦNG 1 — Vị trí tài xế

DB:

sql

Bảng drivers:

\- id, user_id

\- vehicle_plate, vehicle_type: "car"\|"bike"\|"truck"

\- is_available

\- latitude, longitude

\- region: "NORTH" \| "SOUTH"

\- rating (avg), total_trips

\- created_at

Backend:

PATCH /drivers/location → Cập nhật GPS

PATCH /drivers/availability → Bật/tắt nhận khách

GET /drivers/nearby

GET /drivers/:id

> → Tài xế gần nhất

→ Thông tin tài xế

Frontend:

Mobile (driver): DriverHomeScreen

> \- Toggle sẵn sàng nhận khách
>
> \- Tự động gửi GPS lên server mỗi 10 giây

TẦNG 2 — Chat real-time giữa khách và tài xế

DB:

sql

Bảng messages:

\- id, trip_id, sender_id, receiver_id

\- content, type: "text"\|"image"

\- is_read, created_at

Backend:

WebSocket Events:

> \- "message:send" → Gửi tin nhắn
>
> \- "message:receive" → Nhận tin nhắn
>
> \- "message:read" → Đánh dấu đã đọc

REST:

GET /messages/:trip_id → Lịch sử chat của 1 chuyến

Frontend:

Mobile: ChatScreen

> \- Giao diện chat giống Zalo/WhatsApp
>
> \- Tin nhắn real-time qua WebSocket
>
> \- Hiển thị "Đã đọc" / "Đang gõ..."

Kiến thức cần học:

Expo Location API

NestJS WebSocket Gateway

Socket.io trong React Native

👤 NGƯỜI 5 — LỊCH SỬ + ĐÁNH GIÁ + THANH TOÁN

Tại sao quan trọng: Lịch sử là tính năng quan trọng nhất cho đề tài
(read-only mode).

TẦNG 1 — Lịch sử chuyến

DB:

sql

Dùng bảng trips + JOIN với users + drivers

Backend:

GET /trips/history → Lịch sử của user đang đăng nhập

GET /trips/history/:userId → Admin xem lịch sử của 1 user

Response bắt buộc có:

{

> "readOnly": boolean,
>
> "warning": string \| null,
>
> "activeNode": string,
>
> "data": Trip\[\]

}

Frontend:

Mobile: TripHistoryScreen

> \- Danh sách chuyến đã đi
>
> \- Banner warning vàng khi readOnly = true

Web: /history trong web admin

TẦNG 2 — Đánh giá tài xế

DB:

sql

Bảng ratings:

\- id, trip_id, customer_id, driver_id

\- score: 1-5, comment

\- created_at

Backend:

POST /ratings → Khách đánh giá sau chuyến

GET /ratings/driver/:id → Xem đánh giá của tài xế

Frontend:

Mobile: RatingScreen (popup sau khi hoàn thành chuyến)

> \- 5 sao + ô nhận xét
>
> \- Chỉ hiện 1 lần sau mỗi chuyến

TẦNG 3 — Thanh toán VNPay Sandbox

Backend:

POST /payments/create

GET /payments/callback

→ Tạo link thanh toán VNPay

> → VNPay gọi lại sau khi thanh toán

GET /payments/:trip_id → Trạng thái thanh toán

DB:

sql

Bảng payments:

\- id, trip_id, amount, method: "cash"\|"vnpay"

\- status: "pending"\|"completed"\|"failed"

\- vnpay_transaction_id, created_at

Kiến thức cần học:

SQL JOIN nhiều bảng

VNPay sandbox SDK

React Native Modal (popup đánh giá)

👤 NGƯỜI 6 — HEALTH MONITOR + CI/CD

Tại sao quan trọng: Health Monitor là phần giám khảo nhìn vào nhiều
nhất.

TẦNG 1 — Health Monitor

DB:

Không tạo bảng mới

Ping từng node, đọc pg_stat_replication

Backend:

GET /health

GET /health/north

GET /health/south

→ Trạng thái 4 node

> → Chi tiết Miền Bắc
>
> → Chi tiết Miền Nam

Response:

{

> "nodes": {
>
> "northPrimary": "online" \| "offline",
>
> "northReplica": "online" \| "offline",
>
> "southPrimary": "online" \| "offline",
>
> "southReplica": "online" \| "offline"
>
> },
>
> "serviceLevel": {
>
> "north": "full" \| "readonly" \| "unavailable",
>
> "south": "full" \| "readonly" \| "unavailable"
>
> }

}

Frontend:

Web: SystemMonitor page

> \- 4 card: xanh=online, đỏ=offline, vàng=readonly
>
> -Auto refresh mỗi 5 giây
>
> \- Timeline log các sự kiện failover

TẦNG 3 — CI/CD với GitHub Actions

yaml

Tạo file .github/workflows/ci.yml:

> \- Trigger: push lên develop hoặc main
>
> \- Steps:
>
> 1\. Cài dependencies
>
> 2\. Chạy lint
>
> 3\. Chạy unit test
>
> 4\. Build Docker image
>
> 5\. Deploy lên Railway (free)

Kiến thức cần học:

NestJS health check

GitHub Actions YAML syntax

Railway deployment (free hosting)

Docker build + push

👤 NGƯỜI 7 — QUẢN LÝ ADMIN + SWAGGER

Tại sao quan trọng: Admin dashboard + Swagger docs là thứ recruiter muốn
thấy.

TẦNG 1 — Quản lý Admin

DB:

sql

Dùng bảng users + drivers

Backend:

GET /admin/users

GET /admin/drivers

→ Danh sách tất cả user

> → Danh sách tài xế

PATCH /admin/users/:id/suspend → Khóa tài khoản

DELETE /admin/users/:id → Xóa user

GET /admin/drivers?region= → Lọc theo vùng

Frontend:

Web: /admin/users, /admin/drivers

> \- Bảng dữ liệu có filter, sort, search
>
> \- Nút Khóa / Xóa
>
> \- Chỉ admin mới vào được

TẦNG 2 — Swagger API Documentation

Cài @nestjs/swagger

Thêm decorator vào từng endpoint:

> @ApiOperation({ summary: 'Đặt chuyến xe' })
>
> @ApiResponse({ status: 201, type: TripDto })
>
> @ApiBody({ type: BookTripDto })

Kết quả: http://localhost:3000/api/docs

> → Trang web interactive test được tất cảAPI
>
> → Recruiter thấy ngay professional

Kiến thức cần học:

@nestjs/swagger

React Table (hiển thị bảng)

Admin Guard, Role decorator

👤 NGƯỜI 8 — BÁO CÁO + LỊCH SỬ THANH TOÁN + DASHBOARD

Tại sao quan trọng: Dashboard analytics là thứ business cần, thể hiện
được data engineering.

TẦNG 1 — Báo cáo vùng

DB:

sql

Query tổng hợp từ trips:

SELECT

> region,
>
> COUNT(\*) as total_trips,
>
> SUM(fare) as total_revenue,
>
> AVG(fare) as avg_fare

FROM trips

WHERE status = 'completed'

GROUP BY region

Backend:

GET /reports/revenue

GET /reports/trips/count

→ Doanh thu theo vùng

> → Số chuyến theo vùng

GET /reports/trips?from=&to= → Lọc theo ngày

GET /reports/drivers/top → Top tài xế

Frontend:

Web: Dashboard /admin

> \- Biểu đồ cột: doanh thu Bắc vs Nam
>
> \- Biểu đồ đường: chuyến theo ngày
>
> \- Thẻ số: tổng chuyến, tổng doanh thu, tài xế active
>
> \- Dùng recharts (free, dễ dùng)

TẦNG 2 — Lịch sử thanh toán

DB:

sql

Dùng bảng payments của Người 5

Query JOIN với trips + users

Backend:

GET /payments/history

GET /admin/payments

→ Lịch sử thanh toán của user

> → Tất cả giao dịch (admin)

GET /admin/payments?status= → Lọc theo trạng thái

Frontend:

Web: /admin/payments — bảng tất cả giao dịch

Mobile: PaymentHistoryScreen — lịch sử của user

Kiến thức cần học:

SQL GROUP BY, SUM, COUNT, AVG

recharts (LineChart, BarChart, PieChart)

Date range picker trong React

👤 NGƯỜI 9 — INFRASTRUCTURE (DB Phân tán)

Tại sao quan trọng: Xương sống kỹ thuật của toàn bộ đề tài. Người này
unblock cả nhóm.

TẦNG 1 — 4 DB Nodes + Replication

Docker Compose:

4 PostgreSQL 15 containers:

> pg-north-primary → port 5432 (Ghi + Đọc)
>
> pg-north-replica → port 5433 (Chỉ Đọc)
>
> pg-south-primary → port 5434 (Ghi + Đọc)
>
> pg-south-replica → port 5435 (Chỉ Đọc)

Streaming Replication:

> north-primary → north-replica (sync tự động)
>
> south-primary → south-replica (sync tự động)

Backend (database module):

4 connection pools riêng biệt

Health check ping mỗi 5 giây

Failover logic:

> \- Primary down → tự chuyển sang Replica
>
> \- Replica chỉ cho phép đọc, không ghi

Location Router:

> \- Tọa độ/thành phố → xác định NORTH hoặc SOUTH
>
> \- NORTH: vĩ độ \>= 16.5
>
> \- SOUTH: vĩ độ \< 16.5

TẦNG 2 — Connection Pooling nâng cao

Thêm PgBouncer vào Docker Compose

> → Quản lý connection pool hiệu quả hơn
>
> → Giảm overhead khi nhiều request đồng thời

TẦNG 3 — Monitoring với Prometheus + Grafana

Thêm vào Docker Compose:

> \- Prometheus: thu thập metrics từ PostgreSQL
>
> \- Grafana: dashboard visualize
>
> \+ Số connection mỗi node
>
> \+ Replication lag
>
> \+ Query performance

Kiến thức cần học:

PostgreSQL Streaming Replication

Docker Compose networking

raw pg connection pooling

PgBouncer (optional)

Prometheus + Grafana (optional)

CHECKLIST TỔNG THỂ

Tầng 1 — Bắt buộc

> 4 node PostgreSQL chạy ổn định
>
> Streaming Replication hoạt động (pg_stat_replication có data)
>
> Location Router định tuyến đúng theo city/tọa độ
>
> Failover tự động khi Primary down
>
> Read-only mode + warning trên UI
>
> Auth: register, login, JWT
>
> Đặt chuyến, nhận chuyến, lịch sử
>
> Health Monitor dashboard
>
> 6 test cases pass

Tầng 2 — Mở rộng

> Google Maps tích hợp
>
> Tính tiền theo km
>
> Real-time tracking WebSocket
>
> Chat real-time
>
> Upload ảnh đại diện
>
> Đánh giá tài xế
>
> Lịch sử thanh toán
>
> Swagger API docs
>
> Admin dashboard với biểu đồ

Tầng 3 — Nâng cao

> VNPay sandbox
>
> Đa ngôn ngữ VI/EN
>
> CI/CD GitHub Actions
>
> Deploy lên Railway

QUYTẮC LÀM VIỆC CHUNG

Mỗi ngày:

> 1\. git pull origin develop
>
> 2\. Làm trên branch riêng: feature/\[ten\]-\[feature\]
>
> 3\. Push ít nhất 1 commit trước khi ngủ
>
> 4\. Bị block \> 2 tiếng → hỏi nhóm ngay

Mỗi feature xong:

> 1\. Tự test chạy được không
>
> 2\. Tạo Pull Request lên develop
>
> 3\. Tag 2 người review
>
> 4\. Được approve → merge

2 lần/tuần:

> → Demo trực tiếp, không báo cáo miệng
>
> → Ai bị block nói ngay
