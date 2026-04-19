# Merge notes - Nguoi 3: Nhan chuyen + Real-time tracking

File nay dung de nhac ca nhom khi merge branch cua Nguoi 3 vao repo chung.

## Pham vi cua Nguoi 3

Tang 1:

- Them index cho bang `trips` de query chuyen cho nhanh.
- API danh cho tai xe:
  - `GET /trips/pending`
  - `PATCH /trips/:id/accept`
  - `PATCH /trips/:id/complete`
  - `PATCH /trips/:id/reject`
- Mobile screen cho tai xe: `AcceptTripScreen`.

Tang 2:

- WebSocket real-time tracking.
- Event:
  - `trip:join`
  - `trip:leave`
  - `driver:location`
  - `trip:accepted`
  - `trip:status`
- Mobile screen cho khach theo doi tai xe: `TripTrackingScreen`.

## File nen merge

Backend:

```txt
backend/src/trips/trips.gateway.ts
```

Can merge them code vao file co san cua repo chung:

```txt
backend/src/trips/trips.controller.ts
backend/src/trips/trips.service.ts
backend/src/trips/trips.module.ts
```

Mobile:

```txt
mobile/src/screens/AcceptTripScreen.tsx
mobile/src/screens/TripTrackingScreen.tsx
```

Migration:

```txt
migrations/add_index_trips.sql
```

Neu repo chung dang dung thu muc migration so it, co the doi ten cho khop convention cua nhom, nhung noi dung migration la them:

```sql
CREATE INDEX IF NOT EXISTS idx_trips_status_region ON trips (status, region);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips (driver_id);
```

## File khong nen merge

Khong merge file nay:

```txt
src/trips/db.sql
```

Ly do: file nay trung voi migration index va co the lam moi nguoi hieu nham la schema DB rieng cua Nguoi 3.

## Khong duoc copy de

Repo chung da co san:

```txt
backend/src/trips/trips.controller.ts
backend/src/trips/trips.service.ts
backend/src/trips/trips.module.ts
```

Trong cac file do dang co code cua nguoi khac, vi du:

- `POST /trips/book`
- `GET /trips/history`
- `GET /trips/history/:userId`
- legacy routes

Vi vay khi merge branch cua Nguoi 3, khong copy de toan bo controller/service/module. Hay merge them route va method cua Nguoi 3 vao file hien co.

## Dependency can them

Backend:

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

Mobile:

```bash
npm install socket.io-client
npx expo install expo-location react-native-maps
```

## Diem can thong nhat voi cac thanh vien khac

Voi Nguoi 2:

- Bang `trips` can co cac cot:
  - `id`
  - `customer_id`
  - `driver_id`
  - `pickup_address`
  - `dropoff_address`
  - `pickup_lat`
  - `pickup_lng`
  - `dropoff_lat`
  - `dropoff_lng`
  - `region`
  - `distance_km`
  - `fare`
  - `status`
  - `created_at`
  - `completed_at`
- Status sau khi tai xe nhan chuyen nen la `accepted`, khong phai `active`, de khop bang phan cong.

Voi Nguoi 1:

- `JwtAuthGuard` phai gan `req.user.userId`.
- API cua Nguoi 3 lay `driverId` tu JWT, khong lay tu body.

Voi Nguoi 9:

- Thong nhat database name va port.
- Docker hien dang dung:
  - `POSTGRES_DB=rideshare_db`
  - `POSTGRES_USER=rideshare_admin`
  - `POSTGRES_PASSWORD=Admin@123456`
  - north primary: `5432`
  - north replica: `5433`
  - south primary: `5434`
  - south replica: `5435`

Voi mobile:

- Repo chung dang dung `mobile/src/screens`, khong phai `src/screen`.
- Can gan `AcceptTripScreen` va `TripTrackingScreen` vao `App.tsx` hoac navigation.
- `API_BASE` va token trong screen hien la placeholder, can noi voi auth/token cua Nguoi 1.

## Luu y AppModule

Neu `TripsModule` da duoc import trong `AppModule`, khong nen khai bao truc tiep `TripsController` trong `controllers` cua `AppModule`.

Nen de:

```ts
imports: [TripsModule]
```

Khong nen lap lai:

```ts
controllers: [TripsController]
```

De tranh controller bi instantiate 2 lan hoac loi dependency injection khi them `TripsGateway`.

## Checklist truoc khi merge vao develop

- [ ] Da xoa file thua `src/trips/db.sql`.
- [ ] Migration index da nam dung thu muc migration cua repo chung.
- [ ] Da them `TripsGateway` vao `TripsModule`.
- [ ] Da merge route Nguoi 3 vao `trips.controller.ts` hien co, khong copy de.
- [ ] Da merge method Nguoi 3 vao `trips.service.ts` hien co, khong copy de.
- [ ] Da them dependency backend WebSocket.
- [ ] Da them dependency mobile tracking.
- [ ] Da dat mobile screens trong `mobile/src/screens`.
- [ ] Da thong nhat status `accepted`.
- [ ] Da thong nhat database name voi Docker/env.
- [ ] Chay `npm run build` trong backend thanh cong.
- [ ] Chay mobile khong loi import package.

## Test can chay sau khi merge

Backend REST:

```bash
curl http://localhost:3000/trips/pending?region=SOUTH -H "Authorization: Bearer <token>"
curl -X PATCH http://localhost:3000/trips/1/accept -H "Authorization: Bearer <token>"
curl -X PATCH http://localhost:3000/trips/1/complete -H "Authorization: Bearer <token>"
curl -X PATCH http://localhost:3000/trips/2/reject -H "Authorization: Bearer <token>"
```

Backend WebSocket:

```txt
1. Client khach emit trip:join { tripId: 1 }.
2. Tai xe accept trip 1.
3. Client khach nhan trip:accepted va trip:status.
4. Tai xe gui driver:location moi 10 giay.
5. Client khach nhan driver:location va cap nhat marker.
```
