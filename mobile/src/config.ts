/**
 * Cấu hình chung cho mobile app
 *
 * ─── HƯỚNG DẪN CẤU HÌNH ────────────────────────────────────────────────────
 *
 * Khi test trên điện thoại thật (cùng mạng WiFi):
 *   1. Tìm IP LAN của máy tính: ipconfig (Windows) hoặc ifconfig (Mac/Linux)
 *   2. Đổi API_HOST thành IP LAN đó, ví dụ: '192.168.1.100'
 *
 * Khi test trên Android Emulator:
 *   - Dùng '10.0.2.2' (địa chỉ host machine từ emulator)
 *
 * Khi test trên iOS Simulator:
 *   - Dùng 'localhost' hoặc '127.0.0.1'
 *
 * Khi deploy production:
 *   - Đổi thành domain thật, ví dụ: 'api.minigrab.vn'
 *
 * ─── CÁCH ĐỔI NHANH ─────────────────────────────────────────────────────────
 * Chỉ cần thay đổi biến API_HOST bên dưới.
 */

// ⚠️ ĐỔI GIÁ TRỊ NÀY THÀNH IP LAN CỦA MÁY TÍNH KHI TEST TRÊN ĐIỆN THOẠI THẬT
export const API_HOST = process.env.EXPO_PUBLIC_API_HOST ?? '172.16.0.102';

export const API_BASE_URL = `http://${API_HOST}:3000`;
export const WS_BASE_URL = `http://${API_HOST}:3000`;
