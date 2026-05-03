import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios';
import { API_BASE_URL } from '../config';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DriverInfo {
  id: string;           // UUID của driver
  user_id: number;
  vehicle_plate: string;
  vehicle_type: string;
  region: string;
  rating: number;
  total_trips: number;
}

interface DriverHomeScreenProps {
  /** JWT token từ màn hình login */
  token: string;
  /** user_id từ JWT payload (để tìm driver record) */
  userId: number;
  /** Callback khi nhấn nút Chat */
  onOpenChat?: (tripId: number, receiverId: number, receiverName: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DriverHomeScreen({ token, userId, onOpenChat }: DriverHomeScreenProps) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [isLoadingDriver, setIsLoadingDriver] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');

  const locationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Tạo axios instance có auth header ──────────────────────────────────────
  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 8000,
  });

  // ── Lấy thông tin driver của user hiện tại khi mount ──────────────────────
  useEffect(() => {
    loadDriverInfo();
    return () => stopLocationTracking();
  }, []);

  const loadDriverInfo = async () => {
    setIsLoadingDriver(true);
    try {
      // Tìm driver record theo user_id — thử cả 2 region
      for (const region of ['NORTH', 'SOUTH']) {
        try {
          const res = await api.get<{ data: DriverInfo[] }>(
            `/drivers/by-user/${userId}?region=${region}`,
          );
          // Response shape: { data: [...], region_routed_to, is_read_only_fallback }
          const drivers = res.data?.data ?? [];
          if (drivers.length > 0) {
            setDriverInfo(drivers[0]);
            setIsLoadingDriver(false);
            return;
          }
        } catch {
          // thử region kia
        }
      }
      setErrorMsg('Tài khoản này chưa có hồ sơ tài xế. Liên hệ admin để được cấp.');
    } catch {
      setErrorMsg('Không thể tải thông tin tài xế.');
    } finally {
      setIsLoadingDriver(false);
    }
  };

  // ── Toggle sẵn sàng nhận khách ────────────────────────────────────────────
  const toggleSwitch = async () => {
    if (!driverInfo) {
      Alert.alert('Lỗi', 'Chưa tải được thông tin tài xế.');
      return;
    }

    const newValue = !isAvailable;

    try {
      setIsAvailable(newValue);

      await api.patch('/drivers/availability', {
        driver_id: driverInfo.id,
        is_available: newValue,
        // Gửi region để backend không cần tự tìm (tối ưu)
        region: driverInfo.region,
      });

      if (newValue) {
        await startLocationTracking();
      } else {
        stopLocationTracking();
      }
    } catch (error: any) {
      // Rollback UI nếu API thất bại
      setIsAvailable(!newValue);
      stopLocationTracking();

      const msg = error?.response?.data?.message || error.message || 'Lỗi không xác định';
      Alert.alert(
        'Lỗi hệ thống',
        msg.includes('DATABASE_PRIMARY_DOWN')
          ? 'Máy chủ khu vực đang bảo trì. Vui lòng thử lại sau.'
          : `Không thể cập nhật trạng thái: ${msg}`,
      );
    }
  };

  // ── GPS Tracking ──────────────────────────────────────────────────────────
  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setErrorMsg('Quyền truy cập vị trí bị từ chối');
      setIsAvailable(false);
      return;
    }

    setErrorMsg('');
    // Gửi ngay lập tức
    await sendLocationUpdate();

    // Sau đó mỗi 10 giây
    locationTimerRef.current = setInterval(async () => {
      await sendLocationUpdate();
    }, 10000);
  };

  const stopLocationTracking = () => {
    if (locationTimerRef.current) {
      clearInterval(locationTimerRef.current);
      locationTimerRef.current = null;
    }
  };

  const sendLocationUpdate = async () => {
    if (!driverInfo) return;

    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(currentLocation);

      await api.patch('/drivers/location', {
        driver_id: driverInfo.id,
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });

      const now = new Date().toLocaleTimeString('vi-VN');
      setLastUpdateTime(now);
      setErrorMsg('');
    } catch (error: any) {
      const msg = error?.response?.data?.message || error.message || '';
      console.warn('GPS Update Failed:', msg);

      // Nếu primary down → tắt tracking, báo user
      if (
        msg.includes('DATABASE_PRIMARY_DOWN') ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ECONNABORTED'
      ) {
        stopLocationTracking();
        setIsAvailable(false);
        Alert.alert(
          'Mất kết nối',
          'Máy chủ chính không phản hồi. Định vị đã tạm dừng để tránh mất dữ liệu.',
        );
      } else {
        // Lỗi GPS tạm thời (không có tín hiệu) → chỉ log, không tắt
        setErrorMsg(`GPS: ${msg}`);
      }
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoadingDriver) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00af50" />
        <Text style={styles.loadingText}>Đang tải thông tin tài xế...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mini Grab — Tài xế</Text>

      {/* Thông tin tài xế */}
      {driverInfo && (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Thông tin xe</Text>
          <Text style={styles.infoText}>Biển số: {driverInfo.vehicle_plate}</Text>
          <Text style={styles.infoText}>Loại xe: {driverInfo.vehicle_type}</Text>
          <Text style={styles.infoText}>Khu vực: {driverInfo.region}</Text>
          <Text style={styles.infoText}>
            Đánh giá: ⭐ {driverInfo.rating} ({driverInfo.total_trips} chuyến)
          </Text>
        </View>
      )}

      {/* Toggle trạng thái */}
      <View style={styles.statusBox}>
        <View style={styles.statusTextContainer}>
          <Text style={styles.statusLabel}>Trạng thái</Text>
          <Text style={[styles.statusValue, isAvailable ? styles.statusOnline : styles.statusOffline]}>
            {isAvailable ? '🟢 Sẵn sàng nhận khách' : '🔴 Đang nghỉ ngơi'}
          </Text>
        </View>
        <Switch
          trackColor={{ false: '#d1d5db', true: '#86efac' }}
          thumbColor={isAvailable ? '#00af50' : '#9ca3af'}
          ios_backgroundColor="#d1d5db"
          onValueChange={toggleSwitch}
          value={isAvailable}
          disabled={!driverInfo}
        />
      </View>

      {/* Lỗi */}
      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      {/* Vị trí GPS */}
      {location && (
        <View style={styles.locationBox}>
          <Text style={styles.locationTitle}>📍 Vị trí hiện tại</Text>
          <Text style={styles.locationText}>
            {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
          </Text>
          {lastUpdateTime ? (
            <Text style={styles.updateTime}>Cập nhật lúc: {lastUpdateTime}</Text>
          ) : null}
        </View>
      )}

      {/* Nút cập nhật GPS thủ công */}
      <TouchableOpacity
        style={[styles.refreshBtn, !isAvailable && styles.refreshBtnDisabled]}
        onPress={sendLocationUpdate}
        disabled={!isAvailable || !driverInfo}
      >
        <Text style={styles.refreshText}>🔄 Cập nhật GPS ngay</Text>
      </TouchableOpacity>

      {/* Nút mở chat (nếu có active trip) */}
      {onOpenChat && (
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => {
            // Demo: mở chat với trip_id=1, receiver_id=1 (khách hàng)
            // Trong thực tế sẽ lấy từ active trip của tài xế
            onOpenChat(1, 1, 'Khách hàng');
          }}
        >
          <Text style={styles.chatBtnText}>💬 Nhắn tin với khách</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f9fafb',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#00af50',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 10,
  },

  // Info box
  infoBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoText: {
    fontSize: 15,
    color: '#4b5563',
    marginBottom: 4,
  },

  // Status toggle
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statusTextContainer: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusOnline: { color: '#059669' },
  statusOffline: { color: '#6b7280' },

  // Error
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
    fontSize: 13,
    marginBottom: 12,
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 8,
  },

  // Location
  locationBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#15803d',
    fontFamily: 'monospace',
  },
  updateTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },

  // Buttons
  refreshBtn: {
    backgroundColor: '#00af50',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshBtnDisabled: {
    backgroundColor: '#d1d5db',
  },
  refreshText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  chatBtn: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  chatBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
