import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { io, Socket } from 'socket.io-client';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';

// =====================================================================
// Kiểu dữ liệu khớp với bảng trips trong database.sql của người 2
// id: SERIAL (number), driver_id: number | null
// =====================================================================
interface Trip {
  id: number;
  customer_id: number;
  driver_id: number | null;
  pickup_address: string;
  dropoff_address: string;
  distance_km: number;
  fare: number;
  region: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  created_at: string;
}

interface PendingResponse {
  trips: Trip[];
  isReadOnly: boolean;  // true khi primary down, đang dùng replica
}

// =====================================================================
// Cấu hình — đổi API_BASE theo IP máy chạy backend
// JWT_TOKEN lấy từ AsyncStorage sau khi login (người 1 cung cấp)
// =====================================================================
const API_BASE = 'http://192.168.1.x:3000'; // ← đổi IP máy chạy NestJS

// Hàm lấy token từ storage của người 1
// Thay bằng: import { getToken } from '../auth/tokenStorage';
const getAuthHeader = () => ({
  'Content-Type': 'application/json',
  Authorization: 'Bearer YOUR_JWT_TOKEN_HERE', // ← thay bằng token thật
});

// =====================================================================
// Component chính
// =====================================================================
const SOCKET_URL = API_BASE;

export default function AcceptTripScreen() {
  const socketRef = useRef<Socket | null>(null);
  const [pendingTrips, setPendingTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

  // Region xác định bởi GPS — người 9 định nghĩa:
  // vĩ độ >= 16.5 → NORTH, < 16.5 → SOUTH
  // Thay bằng: const region = useLocationRegion(); từ người 1/9
  const region = 'SOUTH';

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
      extraHeaders: getAuthHeader(),
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!activeTrip) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const sendDriverLocation = async () => {
      const socket = socketRef.current;
      if (!socket?.connected || !activeTrip.driver_id) return;

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') return;

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (cancelled) return;

      socket.emit('driver:location', {
        tripId: activeTrip.id,
        driverId: activeTrip.driver_id,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        heading: position.coords.heading ?? undefined,
        speed: position.coords.speed ?? undefined,
      });
    };

    socketRef.current?.emit('trip:join', { tripId: activeTrip.id });
    sendDriverLocation();
    timer = setInterval(sendDriverLocation, 10000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      socketRef.current?.emit('trip:leave', { tripId: activeTrip.id });
    };
  }, [activeTrip]);

  // ----------------------------------------------------------------
  // Load danh sách chuyến chờ — GET /trips/pending?region=SOUTH
  // ----------------------------------------------------------------
  const fetchPendingTrips = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/trips/pending?region=${region}`, {
        headers: getAuthHeader(),
      });

      if (!res.ok) {
        if (res.status === 401) {
          Alert.alert('Phiên đăng nhập hết hạn', 'Vui lòng đăng nhập lại');
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data: PendingResponse = await res.json();
      setPendingTrips(data.trips);
      setIsReadOnly(data.isReadOnly);
    } catch (e: any) {
      Alert.alert('Lỗi kết nối', 'Không thể tải danh sách chuyến. Kiểm tra mạng.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [region]);

  // Poll mỗi 10 giây — thay bằng WebSocket ở Tầng 2
  useEffect(() => {
    fetchPendingTrips();
    const timer = setInterval(fetchPendingTrips, 10000);
    return () => clearInterval(timer);
  }, [fetchPendingTrips]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPendingTrips();
  };

  // ----------------------------------------------------------------
  // Nhận chuyến — PATCH /trips/:id/accept
  // driver_id lấy từ JWT trong backend, không cần truyền body
  // ----------------------------------------------------------------
  const handleAccept = async (trip: Trip) => {
    if (isReadOnly) {
      Alert.alert(
        'Không thể nhận chuyến',
        'Server đang ở chế độ dự phòng (Read-Only). Vui lòng thử lại sau.',
      );
      return;
    }

    setAcceptingId(trip.id);
    try {
      const res = await fetch(`${API_BASE}/trips/${trip.id}/accept`, {
        method: 'PATCH',
        headers: getAuthHeader(),
      });

      if (res.status === 409) {
        // Tài xế khác vừa nhận mất — xóa khỏi danh sách
        setPendingTrips(prev => prev.filter(t => t.id !== trip.id));
        Alert.alert('Chuyến đã được nhận', 'Tài xế khác vừa nhận chuyến này.');
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setActiveTrip(data.trip);
      setPendingTrips(prev => prev.filter(t => t.id !== trip.id));
    } catch (e: any) {
      Alert.alert('Lỗi', 'Không thể nhận chuyến. Thử lại.');
    } finally {
      setAcceptingId(null);
    }
  };

  // ----------------------------------------------------------------
  // Từ chối chuyến — PATCH /trips/:id/reject
  // Chuyến vẫn pending để tài xế khác thấy
  // ----------------------------------------------------------------
  const handleReject = async (tripId: number) => {
    try {
      await fetch(`${API_BASE}/trips/${tripId}/reject`, {
        method: 'PATCH',
        headers: getAuthHeader(),
      });
      // Xóa khỏi danh sách hiển thị của tài xế này
      setPendingTrips(prev => prev.filter(t => t.id !== tripId));
    } catch {
      // Lỗi reject không critical — vẫn ẩn khỏi list
      setPendingTrips(prev => prev.filter(t => t.id !== tripId));
    }
  };

  // ----------------------------------------------------------------
  // Hoàn thành chuyến — PATCH /trips/:id/complete
  // ----------------------------------------------------------------
  const handleComplete = async () => {
    if (!activeTrip) return;

    Alert.alert(
      'Xác nhận hoàn thành',
      `Hoàn thành chuyến đến ${activeTrip.dropoff_address}?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE}/trips/${activeTrip.id}/complete`, {
                method: 'PATCH',
                headers: getAuthHeader(),
              });

              if (!res.ok) throw new Error(`HTTP ${res.status}`);

              setActiveTrip(null);
              fetchPendingTrips(); // load lại danh sách mới
            } catch {
              Alert.alert('Lỗi', 'Không thể hoàn thành chuyến. Thử lại.');
            }
          },
        },
      ],
    );
  };

  // ----------------------------------------------------------------
  // Render từng chuyến trong danh sách chờ
  // ----------------------------------------------------------------
  const renderTripItem = ({ item }: { item: Trip }) => {
    const isAccepting = acceptingId === item.id;

    return (
      <View style={styles.tripCard}>
        {/* Địa chỉ đón - trả */}
        <View style={styles.addressRow}>
          <View style={styles.dotOrange} />
          <Text style={styles.addressText} numberOfLines={1}>
            {item.pickup_address}
          </Text>
        </View>
        <View style={styles.verticalLine} />
        <View style={styles.addressRow}>
          <View style={styles.dotBlue} />
          <Text style={styles.addressText} numberOfLines={1}>
            {item.dropoff_address}
          </Text>
        </View>

        {/* Thông tin chuyến */}
        <View style={styles.tripMeta}>
          <Text style={styles.fareText}>
            {item.fare.toLocaleString('vi-VN')}đ
          </Text>
          <Text style={styles.metaText}>{item.distance_km.toFixed(1)} km</Text>
          <View style={styles.regionBadge}>
            <Text style={styles.regionText}>{item.region}</Text>
          </View>
        </View>

        {/* Nút Nhận / Từ chối */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btnAccept, isAccepting && styles.btnDisabled]}
            onPress={() => handleAccept(item)}
            disabled={isAccepting || isReadOnly}
          >
            {isAccepting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnAcceptText}>Nhận chuyến</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnReject}
            onPress={() => handleReject(item.id)}
            disabled={isAccepting}
          >
            <Text style={styles.btnRejectText}>Từ chối</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ----------------------------------------------------------------
  // Render chuyến đang chạy (active)
  // ----------------------------------------------------------------
  const renderActiveTrip = () => {
    if (!activeTrip) return null;
    return (
      <View style={styles.activeTripCard}>
        <Text style={styles.activeTripLabel}>Đang thực hiện</Text>

        <View style={styles.addressRow}>
          <View style={styles.dotOrange} />
          <Text style={styles.addressText} numberOfLines={1}>
            {activeTrip.pickup_address}
          </Text>
        </View>
        <View style={styles.verticalLine} />
        <View style={styles.addressRow}>
          <View style={styles.dotBlue} />
          <Text style={styles.addressText} numberOfLines={1}>
            {activeTrip.dropoff_address}
          </Text>
        </View>

        <View style={styles.tripMeta}>
          <Text style={styles.fareText}>
            {activeTrip.fare.toLocaleString('vi-VN')}đ
          </Text>
          <Text style={styles.metaText}>{activeTrip.distance_km.toFixed(1)} km</Text>
        </View>

        <TouchableOpacity style={styles.btnComplete} onPress={handleComplete}>
          <Text style={styles.btnAcceptText}>Hoàn thành chuyến</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ----------------------------------------------------------------
  // Render chính
  // ----------------------------------------------------------------
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Đang tải chuyến...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF6B35" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chuyến chờ nhận</Text>
        <Text style={styles.headerSub}>Khu vực: {region}</Text>
      </View>

      {/* Banner Read-Only khi primary down */}
      {isReadOnly && (
        <View style={styles.readOnlyBanner}>
          <Text style={styles.readOnlyIcon}>!</Text>
          <Text style={styles.readOnlyText}>
            Server dự phòng đang hoạt động. Không thể nhận chuyến mới.
          </Text>
        </View>
      )}

      <FlatList
        data={pendingTrips}
        keyExtractor={item => String(item.id)}
        renderItem={renderTripItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
          />
        }
        ListHeaderComponent={renderActiveTrip}
        ListHeaderComponentStyle={pendingTrips.length > 0 ? styles.activeSection : undefined}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {isReadOnly
                ? 'Không thể tải chuyến khi server offline'
                : 'Không có chuyến nào trong khu vực'}
            </Text>
            <Text style={styles.emptyHint}>Kéo xuống để làm mới</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

// =====================================================================
// Styles
// =====================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F4F4',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },

  // Header
  header: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // Read-only banner
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0EB',
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B35',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  readOnlyIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF6B35',
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  readOnlyText: {
    flex: 1,
    fontSize: 12,
    color: '#CC4F1F',
    lineHeight: 17,
  },

  // List
  listContent: {
    padding: 12,
    paddingBottom: 32,
  },
  activeSection: {
    marginBottom: 4,
  },

  // Trip card (pending)
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
  },

  // Active trip card
  activeTripCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#FF6B35',
  },
  activeTripLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D9E75',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Address rows
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  dotOrange: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B35',
    flexShrink: 0,
  },
  dotBlue: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#378ADD',
    flexShrink: 0,
  },
  verticalLine: {
    width: 1,
    height: 14,
    backgroundColor: '#E0E0E0',
    marginLeft: 3.5,
    marginBottom: 2,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: '#222',
  },

  // Trip meta
  tripMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  fareText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF6B35',
  },
  metaText: {
    fontSize: 12,
    color: '#888',
  },
  regionBadge: {
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  regionText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  btnAccept: {
    flex: 1,
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  btnReject: {
    flex: 1,
    backgroundColor: '#F4F4F4',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#DDD',
  },
  btnComplete: {
    backgroundColor: '#1D9E75',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  btnDisabled: {
    backgroundColor: '#FFB89A',
  },
  btnAcceptText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  btnRejectText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
  },

  // Empty state
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 12,
    color: '#BBB',
  },
});
