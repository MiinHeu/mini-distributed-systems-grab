# AUTH + DA NGON NGU + UPLOAD ANH - BAO CAO PHAN TICH
Ngay: 2026-05-11

## 1) Muc tieu
Tong hop hien trang auth, da ngon ngu, upload anh trong source. Ghi nho cac diem lien quan den phan cong viec cua ban de tiep tuc trien khai.

## 2) Tep da ra soat
Backend:
- backend/src/auth/auth.controller.ts
- backend/src/auth/auth.service.ts
- backend/src/auth/auth.module.ts
- backend/src/auth/auth.types.ts
- backend/src/auth/jwt-auth.guard.ts
- backend/src/common/api-response.ts
- backend/src/main.ts
- backend/src/app.module.ts
- backend/src/database/database.module.ts
- backend/src/database/database.service.ts
- backend/package.json

DB:
- DB/init/init-replication.sql
- DB/docker-compose.yml

Frontend:
- mobile/App.tsx
- mobile/package.json
- web/src/App.tsx
- web/package.json

## 3) Backend - Auth
### 3.1 Endpoint hien co
- POST /auth/register
- POST /auth/login
- POST /auth/logout
- GET /auth/me
- PATCH /auth/me
- POST /auth/me/avatar

### 3.2 JWT + Guard
- Guard: JwtAuthGuard lay token tu Authorization: Bearer <token>.
- Token duoc verify bang JWT_SECRET; neu khong co se dung gia tri mac dinh dev-secret-key-change-me.
- Logout chi revoke token tren bo nho (Set), khong luu ben ngoai.
- Token co han 7 ngay.

### 3.3 Response envelope
- Response tra ve qua ok() voi format: { readOnly, warning, activeNode, data }.

### 3.4 Da ngon ngu o backend
- Accept-Language duoc dung de chon vi/en.
- preferred_language luu trong DB, duoc update qua PATCH /auth/me.
- Message login/logout/avatar theo ngon ngu.

## 4) Backend - Upload anh
- Upload dang luu local: uploads/avatars/<filename>.
- Dung multer diskStorage.
- API tra ve avatar_url dang tuong doi: /uploads/avatars/<file>.
- Static assets duoc serve qua /uploads/ tu folder uploads/.

## 5) DB (users)
- Bang users co cot avatar_url va preferred_language.
- preferred_language chi nhan vi/en.

## 6) Frontend - Mobile
- Dung Expo ImagePicker de chon anh tu thu vien.
- Upload bang FormData vao POST /auth/me/avatar.
- Hien thi avatar bang API_BASE_URL + avatar_url.
- Da ngon ngu: dang dung object i18n noi bo (khong dung i18next).
- Nguoi dung chon ngon ngu trong UI; preferred_language gui len server khi register/patch.

## 7) Frontend - Web
- Upload avatar bang input file, POST /auth/me/avatar.
- Hien thi avatar bang API_BASE_URL + avatar_url.
- Da ngon ngu: dang dung object messages noi bo, language luu localStorage.
- preferred_language gui len server khi register/patch.

## 8) Khoang trong so voi yeu cau
### 8.1 Upload anh len Cloudinary
- Chua co Cloudinary SDK trong backend.
- Upload hien tai chi luu local.
- API yeu cau POST /auth/avatar (hien tai la /auth/me/avatar).

### 8.2 Da ngon ngu voi i18next
- Chua co i18next + react-i18next tren web va mobile.
- Chua co file vi.json/en.json.
- Chua co co che tu dong doi UI theo i18next.

## 9) Ghi nho / Huong trien khai tiep
- Neu chuyen sang Cloudinary: dung memoryStorage -> upload buffer -> nhan secure_url -> update avatar_url.
- Can xu ly avatar_url la absolute URL (Cloudinary) hoac relative (/uploads/...).
- Khi doi ngon ngu: goi PATCH /auth/me de luu preferred_language, dong thoi i18next changeLanguage.
- Dong bo ngon ngu luc login/load profile: lay preferred_language tu /auth/me.

## 10) Pham vi cong viec cua ban (Auth + Da ngon ngu + Upload anh)
- Backend: thay doi upload sang Cloudinary, cap nhat endpoint (them alias /auth/avatar neu can).
- Frontend (web + mobile): tich hop i18next va bo doi tuong i18n hardcode.
- Frontend: upload avatar giu endpoint, cap nhat hien thi avatar khi co absolute URL.
- Van giu JWT, Guard, DB field preferred_language/ avatar_url nhu hien tai.
