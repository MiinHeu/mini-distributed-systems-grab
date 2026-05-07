import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { reverseGeocode } from '../utils/location';

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

interface Trip {
  id: number;
  pickup_address: string;
  dropoff_address: string;
  fare: number;
  status: string;
  customer_id: number;
  region: string;
}

interface DriverHomeScreenProps {
  token: string;
  userId: number;
  onOpenChat?: (tripId: number, receiverId: number, receiverName: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DriverHomeScreen({ token, userId, onOpenChat }: DriverHomeScreenProps) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [pendingTrips, setPendingTrips] = useState<Trip[]>([]);
  const [isLoadingDriver, setIsLoadingDriver] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [currentAddress, setCurrentAddress] = useState<string>('Đang xác định vị trí...');

  const locationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 8000,
  });

  useEffect(() => {
    loadDriverInfo();
    return () => {
      stopLocationTracking();
      stopPollingTrips();
    };
  }, []);

  useEffect(() => {
    if (isAvailable && driverInfo) {
      startPollingTrips();
    } else {
      stopPollingTrips();
    }
  }, [isAvailable, driverInfo]);

  const loadDriverInfo = async () => {
    setIsLoadingDriver(true);
    try {
      for (const region of ['NORTH', 'SOUTH']) {
        try {
          const res = await api.get<{ data: DriverInfo[] }>(
            `/drivers/by-user/${userId}?region=${region}`,
          );
          const drivers = res.data?.data ?? [];
          if (drivers.length > 0) {
            setDriverInfo(drivers[0]);
            setIsLoadingDriver(false);
            return;
          }
        } catch {
          // ignore
        }
      }
      setErrorMsg('Tài khoản này chưa có hồ sơ tài xế.');
    } catch {
      setErrorMsg('Không thể tải thông tin tài xế.');
    } finally {
      setIsLoadingDriver(false);
    }
  };

  const loadPendingTrips = async () => {
    if (!driverInfo) return;
    try {
      const res = await api.get<{ trips: Trip[] }>(`/trips/pending?region=${driverInfo.region}`);
      setPendingTrips(res.data.trips || []);
    } catch (err) {
      console.warn('Fetch trips failed:', err);
    }
  };

  const startPollingTrips = () => {
    loadPendingTrips();
    pollTimerRef.current = setInterval(loadPendingTrips, 5000);
  };

  const stopPollingTrips = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setPendingTrips([]);
  };

  const handleAcceptTrip = async (tripId: number) => {
    try {
      await api.patch(`/trips/${tripId}/accept`);
      Alert.alert('Thành công', 'Bạn đã nhận chuyến xe này!');
      loadPendingTrips();
      // Sau này có thể chuyển sang màn hình Trip Detail hoặc Chat
      if (onOpenChat) onOpenChat(tripId, 1, 'Khách hàng');
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Không thể nhận chuyến';
      Alert.alert('Lỗi', msg);
    }
  };

  const toggleSwitch = async () => {
    if (!driverInfo) return;
    const newValue = !isAvailable;
    try {
      setIsAvailable(newValue);
      await api.patch('/drivers/availability', {
        driver_id: driverInfo.id,
        is_available: newValue,
        region: driverInfo.region,
      });
      if (newValue) {
        await startLocationTracking();
      } else {
        stopLocationTracking();
      }
    } catch (error: any) {
      setIsAvailable(!newValue);
      stopLocationTracking();
      const msg = error?.response?.data?.message || error.message || 'Lỗi không xác định';
      Alert.alert('Lỗi cập nhật', `Chi tiết: ${msg}`);
    }
  };

  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setIsAvailable(false);
      return;
    }
    await sendLocationUpdate();
    locationTimerRef.current = setInterval(sendLocationUpdate, 10000);
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
      const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(currentLocation);
      
      // Lấy địa chỉ chữ
      const addr = await reverseGeocode(currentLocation.coords.latitude, currentLocation.coords.longitude);
      setCurrentAddress(addr);

      await api.patch('/drivers/location', {
        driver_id: driverInfo.id,
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      setLastUpdateTime(new Date().toLocaleTimeString('vi-VN'));
    } catch (error) {
      console.warn('GPS Update Failed');
    }
  };

  if (isLoadingDriver) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00af50" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={loadPendingTrips} />
        }
      >
        <Text style={styles.title}>Mini Grab — Tài xế</Text>

        {driverInfo && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>Biển số: {driverInfo.vehicle_plate} | {driverInfo.region}</Text>
            <Text style={styles.infoText}>Đánh giá: ⭐ {driverInfo.rating} ({driverInfo.total_trips} chuyến)</Text>
          </View>
        )}

        <View style={styles.statusBox}>
          <Text style={[styles.statusValue, isAvailable ? styles.statusOnline : styles.statusOffline]}>
            {isAvailable ? '🟢 Đang trực' : '🔴 Đang nghỉ'}
          </Text>
          <Switch value={isAvailable} onValueChange={toggleSwitch} />
        </View>

        {isAvailable && (
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>📍 Vị trí hiện tại:</Text>
            <Text style={styles.locationAddress}>{currentAddress}</Text>
            <Text style={styles.locationCoords}>
              ({location?.coords.latitude.toFixed(5)}, {location?.coords.longitude.toFixed(5)}) - {lastUpdateTime}
            </Text>
          </View>
        )}

        {isAvailable && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chuyến xe đang chờ ({pendingTrips.length})</Text>
            {pendingTrips.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có chuyến nào trong khu vực của bạn.</Text>
            ) : (
              pendingTrips.map((trip) => (
                <View key={trip.id} style={styles.tripCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripAddress}>Đón: {trip.pickup_address}</Text>
                    <Text style={styles.tripAddress}>Trả: {trip.dropoff_address}</Text>
                    <Text style={styles.tripFare}>{trip.fare.toLocaleString('vi-VN')}đ</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.acceptBtn} 
                    onPress={() => handleAcceptTrip(trip.id)}
                  >
                    <Text style={styles.acceptBtnText}>NHẬN</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#00af50', marginBottom: 16, textAlign: 'center' },
  infoBox: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  infoText: { fontSize: 13, color: '#6b7280' },
  statusBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  statusValue: { fontSize: 16, fontWeight: '600' },
  statusOnline: { color: '#059669' },
  statusOffline: { color: '#6b7280' },
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 12 },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 20 },
  tripCard: { backgroundColor: '#fff', padding: 14, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb', flexDirection: 'row', alignItems: 'center' },
  tripAddress: { fontSize: 14, color: '#374151', marginBottom: 2 },
  tripFare: { fontSize: 15, fontWeight: '700', color: '#00af50', marginTop: 4 },
  acceptBtn: { backgroundColor: '#00af50', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6 },
  acceptBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  locationInfo: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  locationLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
    marginBottom: 4,
  },
  locationCoords: {
    fontSize: 11,
    color: '#999',
  },
});
