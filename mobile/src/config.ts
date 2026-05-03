/**
 * Cấu hình chung cho mobile app
 * Đổi API_HOST thành IP LAN của máy tính khi test trên điện thoại thật
 * Ví dụ: '192.168.1.7' hoặc '10.0.2.2' (Android emulator)
 */
export const API_HOST = '192.168.1.7';
export const API_BASE_URL = `http://${API_HOST}:3000`;
export const WS_BASE_URL = `http://${API_HOST}:3000`;
