/**
 * Cấu hình chung cho mobile app
 * Đổi API_HOST thành IP LAN của máy tính khi test trên điện thoại thật
 */
export const API_HOST = '172.16.0.3';
export const API_BASE_URL = `http://${API_HOST}:3000`;
export const WS_BASE_URL = `http://${API_HOST}:3000`;
