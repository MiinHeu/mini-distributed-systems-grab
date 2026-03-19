# Mini Grab — Distributed Database (PostgreSQL) + NestJS + Web + Mobile

Tài liệu này giúp **các thành viên trong nhóm** có thể tiếp tục phát triển dự án dựa trên **nền tảng Infrastructure/DB phân tán (phần Người 9)**: 4 node PostgreSQL + routing theo vùng + health check + read/write rule.

## Tổng quan kiến trúc

- **DB (Người 9)**: 4 node PostgreSQL 15 chạy bằng Docker Compose
  - `pg-north-primary` — `localhost:5432` (Read/Write)
  - `pg-north-replica` — `localhost:5433` (Read-only)
  - `pg-south-primary` — `localhost:5434` (Read/Write)
  - `pg-south-replica` — `localhost:5435` (Read-only)
- **Routing theo vùng (Location Router)**:
  - **NORTH** nếu vĩ độ \(latitude\) >= **16.5**
  - **SOUTH** nếu vĩ độ \(latitude\) < **16.5**
- **Backend (NestJS)**: kết nối 4 pool riêng, health check định kỳ và service chọn **pool đọc/ghi** theo vùng + tình trạng node.
- **Monitoring (đã có sẵn trong Compose)**:
  - Prometheus: `localhost:9090`
  - Grafana: `localhost:3001`

## Cấu trúc thư mục

- `DB/`: Docker Compose cho 4 node Postgres + Prometheus/Grafana
- `backend/`: NestJS API + module kết nối DB + health check + routing
- `web/`: React + Vite (admin/monitor UI nếu nhóm triển khai)
- `mobile/`: React Native / Expo (client app nếu nhóm triển khai)

## Yêu cầu môi trường (Windows 11)

### Những thứ Người 1–8 cần cài để chạy được phần Người 9 (Infra)

Mục tiêu của phần này: **ai cũng tự chạy được DB 4 node + backend routing/health trên máy mình** để không bị block khi làm feature.

- **Git**: clone/pull code
- **Node.js LTS (khuyến nghị Node 20+)**: chạy backend NestJS và tooling
- **Docker Desktop**:
  - Bắt buộc bật **WSL2**
  - Mở Docker Desktop và chờ trạng thái **Engine running** trước khi chạy lệnh `docker compose ...`
- **Cursor/VS Code** (khuyến nghị) + extensions:
  - **Docker** (Microsoft) — xem container/log nhanh
  - **REST Client** (Huachao Mao) — để bấm **Send Request** trong file `backend/requests.http`

Ngoài ra (tuỳ chọn, không bắt buộc):

- **Grafana/Prometheus UI** đã có sẵn trong Docker Compose, bạn chỉ cần mở browser:
  - Grafana: `http://localhost:3001`
  - Prometheus: `http://localhost:9090`

### Checklist kiểm tra nhanh sau khi cài

Chạy các lệnh sau, tất cả phải ra version (không được báo “not recognized”):

```bash
git --version
node --version
npm --version
docker --version
docker compose version
```

## Biến môi trường

### 1) `backend/.env` (cho backend)

Backend dùng `@nestjs/config` và sẽ load `.env` trong thư mục `backend/` khi bạn chạy `npm run start:dev`.

Tạo file `backend/.env` từ `.env.example` ở thư mục gốc:

```bash
cd "c:\Projects\mini-distributed-systems-grab"
copy ".env.example" "backend\.env"
```

Các biến quan trọng (xem `.env.example`):

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `DB_NORTH_PRIMARY_HOST/PORT`, `DB_NORTH_REPLICA_HOST/PORT`, `DB_SOUTH_PRIMARY_HOST/PORT`, `DB_SOUTH_REPLICA_HOST/PORT`
- `HEALTH_CHECK_INTERVAL`, `FAILOVER_TIMEOUT`

### 2) `DB/.env` (cho Docker Compose DB)

Thư mục `DB/` dùng `DB/.env` làm `env_file` cho các container. Repo hiện đã có `DB/.env` (đang bị ignore) — đảm bảo các biến này **khớp** với `backend/.env`:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `PGPASSWORD` (mật khẩu replication user, đang dùng trong init script)

Lưu ý: `DB/init/init-replication.sql` tạo role replication:

- user: `replicator`
- password: `replica123` (đang hard-code trong init script)

## Quick start (chạy full stack)

### Trình tự bắt buộc (tiên quyết)

- **Bắt buộc**: DB phải chạy (`docker compose up -d` trong `DB/`)
- **Tiên quyết để test API / làm feature**: backend phải chạy bằng **`npm run start:dev`**

### 1) Chạy DB 4 node + monitoring

```bash
cd "c:\Projects\mini-distributed-systems-grab\DB"
docker compose up -d
docker ps
```

Kiểm tra các cổng:

- Postgres: `5432, 5433, 5434, 5435`
- Prometheus: `9090`
- Grafana: `3001`

### 2) Kiểm tra replication có hoạt động

Vào primary miền Bắc và xem replication:

```bash
docker exec -it pg-north-primary psql -U rideshare_admin -d rideshare_db
```

Trong `psql`:

```sql
SELECT * FROM pg_stat_replication;
```

Thoát:

```sql
\q
```

### 3) Chạy backend (NestJS)

```bash
cd "c:\Projects\mini-distributed-systems-grab\backend"
npm install
npm run start:dev
```

Lưu ý: nếu bạn **chưa chạy `npm run start:dev`** thì mọi request trong `backend/requests.http` sẽ **không có server để trả lời**.

Health endpoint:

- `GET http://localhost:3000/health` → trả về envelope `{ readOnly, warning, activeNode, data }` (trong `data` có `nodes` + `serviceLevel`)
- `GET http://localhost:3000/trips/history?latitude=10.77` → demo “xem lịch sử” theo vùng (dùng để chứng minh read-only khi primary down)
- `POST http://localhost:3000/trips/book` body `{ "latitude": 10.77, "note": "..." }` → demo “đặt chuyến” (bị chặn khi primary down)

Test nhanh trong IDE:
- Tải extention REST CLIENT của humao để test

- Mở file `backend/requests.http` và bấm **Send Request** để test `health/history/book/test-db` mà không cần Postman.

### 4) Chạy web (React + Vite)

```bash
cd "c:\Projects\mini-distributed-systems-grab\web"
npm install
npm run dev
```

Mặc định: `http://localhost:5173`

### 5) Chạy mobile (Expo)

Tùy dự án trong `mobile/` (Expo), chạy theo README/commands trong thư mục đó. Thông thường:

```bash
cd "c:\Projects\mini-distributed-systems-grab\mobile"
npm install
npx expo start
```

## Contract để mọi người tích hợp theo “nền tảng Người 9”

Trong backend đã có các service chính:

- `LocationRouterService` (`backend/src/router/location-router.service.ts`)
  - Hàm `getRegion(latitude)` trả `'north' | 'south'` theo ngưỡng **16.5**
- `HealthService` (`backend/src/health/health.service.ts`)
  - Ping 4 node bằng `SELECT 1` theo chu kỳ (mặc định 5s trong code hiện tại)
  - `GET /health` trả trạng thái `online/offline` + `serviceLevel` (`full/readonly/unavailable`)
- `DbRoutingService` (`backend/src/db-routing/db-routing.service.ts`)
  - `getReadPool(latitude)`:
    - ưu tiên **replica**, fallback sang **primary**
  - `getWritePool(latitude)`:
    - chỉ cho ghi vào **primary**
    - nếu primary down → **ném lỗi** “Replica is read-only”

### Chuẩn response để frontend/mobile dùng chung

Backend đang chuẩn hóa response theo envelope:

```ts
{
  readOnly: boolean;
  warning: string | null;
  activeNode: string | null;
  data: any;
}
```

### Quy ước khi viết feature (Người 1–8)

- **API cần latitude (hoặc city -> latitude)** để chọn vùng dữ liệu.
- **Query đọc**: dùng pool từ `getReadPool(latitude)`.
- **Query ghi** (create/update/delete): dùng pool từ `getWritePool(latitude)` và phải xử lý lỗi read-only/unavailable.
- UI nên hiển thị cảnh báo khi hệ thống đang read-only (primary down) theo response contract của từng feature.

## Test failover/read-only nhanh

1) Stop primary miền Bắc:

```bash
docker stop pg-north-primary
```

2) Gọi `GET http://localhost:3000/health` → `data.nodes.northPrimary = offline` (sau vài giây).

3) Thử thao tác **ghi** vào NORTH (latitude >= 16.5) → backend phải báo lỗi “Replica is read-only”.

4) Start lại primary:

```bash
docker start pg-north-primary
```

## Quy tắc làm việc nhóm (khuyến nghị)

- Mỗi ngày: pull code mới, làm trên branch riêng, push commit thường xuyên.
- Khi xong feature: tự test → tạo PR → tag review → merge.
- Bị block > 2 giờ: báo nhóm sớm để tránh domino.

---

## Tham khảo nhanh

- **DB Compose**: `DB/docker-compose.yml`
- **Replication init**: `DB/init/init-replication.sql`
- **Postgres access control**: `DB/config/pg_hba.conf`
- **Backend DB pools**: `backend/src/database/database.service.ts`
- **Routing đọc/ghi**: `backend/src/db-routing/db-routing.service.ts`
- **Health endpoint**: `backend/src/health/health.controller.ts`
