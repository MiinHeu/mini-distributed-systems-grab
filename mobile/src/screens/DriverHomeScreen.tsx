import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Switch, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { reverseGeocode } from '../utils/location';
import { Colors, Spacing, Radius, Shadow } from '../theme';

interface DriverInfo { id: string; user_id: string; vehicle_plate: string; vehicle_type: string; region: string; rating: number; total_trips: number; }
interface Trip { id: string; pickup_address: string; dropoff_address: string; fare: number; status: string; customer_id: string; region: string; }
interface DriverHomeScreenProps { token: string; userId: string; onOpenChat?: (tripId: string, receiverId: string, receiverName: string) => void; }

const VEHICLE_ICON: Record<string, string> = { bike: '🏍️', car: '🚗', truck: '🚛' };

export default function DriverHomeScreen({ token, userId, onOpenChat, mockLoc }: DriverHomeScreenProps & { mockLoc: { lat: number, lng: number } | null }) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [location, setLocation] = useState<{ coords: { latitude: number, longitude: number } } | null>(null);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [pendingTrips, setPendingTrips] = useState<Trip[]>([]);
  const [isLoadingDriver, setIsLoadingDriver] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentAddress, setCurrentAddress] = useState('Đang xác định vị trí...');
  const [lastUpdateTime, setLastUpdateTime] = useState('');
  const locationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);


  useEffect(() => { loadDriverInfo(); return () => { stopLocationTracking(); stopPollingTrips(); }; }, []);
  // Khi mockLoc thay đổi, cập nhật vị trí ngay lập tức nếu đang online
  useEffect(() => { if (isAvailable) sendLocationUpdate(); }, [mockLoc]);
  useEffect(() => { if (isAvailable && driverInfo) startPollingTrips(); else stopPollingTrips(); }, [isAvailable, driverInfo]);

  const loadDriverInfo = async () => {
    setIsLoadingDriver(true);
    let found = false;
    try {
      for (const region of ['NORTH', 'SOUTH']) {
        try {
          const res = await fetch(`${API_BASE_URL}/drivers/by-user/${userId}?region=${region}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          const drivers = data?.data ?? [];
          
          if (drivers.length > 0) { 
            setDriverInfo(drivers[0]); 
            found = true;
            break; 
          }
        } catch (e) {
          console.log(`Không tìm thấy tài xế ở vùng ${region}`);
        }
      }
      if (!found) {
        Alert.alert('Thông báo', 'Tài khoản của bạn chưa được đăng ký thông tin phương tiện (Driver Profile). Vui lòng liên hệ quản trị viên.');
      }
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể kết nối tới máy chủ');
    } finally { 
      setIsLoadingDriver(false); 
    }
  };

  // Hàm hỗ trợ xác định vùng dựa trên tọa độ
  const getCurrentRegionHelper = () => {
    if (mockLoc) return mockLoc.lat > 16.5 ? 'NORTH' : 'SOUTH';
    if (location) return location.coords.latitude > 16.5 ? 'NORTH' : 'SOUTH';
    return driverInfo?.region || 'SOUTH';
  };

  const loadPendingTrips = async () => {
    if (!driverInfo) return;
    const currentRegion = getCurrentRegionHelper();
    try { 
      const res = await fetch(`${API_BASE_URL}/trips/pending?region=${currentRegion}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setPendingTrips(data.trips || []); 
    } catch (e) {
      console.log('Lỗi load trips:', e);
    }
  };

  const startPollingTrips = () => { loadPendingTrips(); pollTimerRef.current = setInterval(loadPendingTrips, 5000); };
  const stopPollingTrips = () => { if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; } setPendingTrips([]); };

  const handleAcceptTrip = async (tripId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/trips/${tripId}/accept`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Không thể nhận chuyến');

      // Tự động hoàn thành chuyến xe ngay lập tức theo yêu cầu
      await fetch(`${API_BASE_URL}/trips/${tripId}/complete`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      Alert.alert('Thành công!', 'Bạn đã hoàn thành chuyến xe này!');
      loadPendingTrips();
    } catch (e: any) { 
      Alert.alert('Lỗi', e.message || 'Không thể xử lý chuyến xe'); 
    }
  };

  const toggleSwitch = async () => {
    if (!driverInfo) return;
    const newVal = !isAvailable;
    try {
      setIsAvailable(newVal);
      const res = await fetch(`${API_BASE_URL}/drivers/availability`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          driver_id: driverInfo.id, 
          is_available: newVal, 
          region: getCurrentRegionHelper() 
        })
      });
      
      if (!res.ok) throw new Error('Lỗi cập nhật trạng thái');
      
      if (newVal) await startLocationTracking(); else stopLocationTracking();
    } catch (e: any) { 
      setIsAvailable(!newVal); 
      stopLocationTracking(); 
      Alert.alert('Lỗi cập nhật', e.message); 
    }
  };

  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { setIsAvailable(false); return; }
    await sendLocationUpdate();
    locationTimerRef.current = setInterval(sendLocationUpdate, 10000);
  };

  const stopLocationTracking = () => { if (locationTimerRef.current) { clearInterval(locationTimerRef.current); locationTimerRef.current = null; } };

  const sendLocationUpdate = async () => {
    if (!driverInfo) return;
    try {
      let lat: number, lng: number;

      if (mockLoc) {
        lat = mockLoc.lat;
        lng = mockLoc.lng;
      } else {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      setLocation({ coords: { latitude: lat, longitude: lng } });
      const addr = await reverseGeocode(lat, lng);
      setCurrentAddress(addr);
      
      await fetch(`${API_BASE_URL}/drivers/location`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          driver_id: driverInfo.id, 
          latitude: lat, 
          longitude: lng 
        })
      });
      
      setLastUpdateTime(new Date().toLocaleTimeString('vi-VN'));
    } catch (err) {
      console.log('Lỗi cập nhật vị trí driver:', err);
    }
  };

  if (isLoadingDriver) return <View style={S.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const currentRegion = getCurrentRegionHelper();

  return (
    <ScrollView style={S.container} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={async () => { setIsRefreshing(true); await loadPendingTrips(); setIsRefreshing(false); }} colors={[Colors.primary]} />}>
      {/* Driver info card */}
      {driverInfo && (
        <View style={S.infoCard}>
          <View style={S.infoCardLeft}>
            <View style={S.vehicleIcon}><Text style={S.vehicleIconText}>{VEHICLE_ICON[driverInfo.vehicle_type] || '🚗'}</Text></View>
            <View>
              <Text style={S.vehiclePlate}>{driverInfo.vehicle_plate}</Text>
              <Text style={S.vehicleType}>{driverInfo.vehicle_type.toUpperCase()}</Text>
            </View>
          </View>
          <View style={S.infoCardRight}>
            <View style={[S.regionBadge, { backgroundColor: currentRegion === 'NORTH' ? '#E3F2FD' : '#F1F8E9', paddingHorizontal: 8 }]}>
              <Text style={[S.regionBadgeText, { color: currentRegion === 'NORTH' ? '#1976D2' : '#388E3C', fontSize: 11 }]}>
                Đang ở: {currentRegion === 'NORTH' ? 'Miền Bắc' : 'Miền Nam'}
              </Text>
            </View>
            <Text style={S.ratingText}>{Number(driverInfo.rating ?? 5).toFixed(1)} sao  {driverInfo.total_trips} chuyến</Text>
          </View>
        </View>
      )}

      {/* Status toggle */}
      <View style={[S.statusCard, isAvailable && S.statusCardActive, !driverInfo && { opacity: 0.5 }]}>
        <View style={S.statusLeft}>
          <View style={[S.statusDot, { backgroundColor: isAvailable ? Colors.primary : Colors.gray300 }]} />
          <View>
            <Text style={S.statusTitle}>{isAvailable ? 'Đang sẵn sàng đón khách' : 'Đang nghỉ'}</Text>
            <Text style={S.statusSub}>
              {driverInfo 
                ? (isAvailable ? 'Bạn đang nhận chuyến' : 'Bật để bắt đầu nhận chuyến') 
                : 'Thiếu hồ sơ phương tiện - Vui lòng liên hệ Admin'}
            </Text>
          </View>
        </View>
        <Switch value={isAvailable} onValueChange={toggleSwitch} trackColor={{ false: Colors.gray200, true: Colors.primaryLight }} thumbColor={isAvailable ? Colors.primary : Colors.gray400} disabled={!driverInfo} />
      </View>

      {/* Location card */}
      {isAvailable && (
        <View style={S.locationCard}>
          <Text style={S.locationTitle}>Vị trí hiện tại</Text>
          <Text style={S.locationAddress}>{currentAddress}</Text>
          {location && <Text style={S.locationCoords}>{location.coords.latitude.toFixed(5)}, {location.coords.longitude.toFixed(5)}</Text>}
          {lastUpdateTime && <Text style={S.locationTime}>Cập nhật lúc {lastUpdateTime}</Text>}
        </View>
      )}

      {/* Pending trips */}
      {isAvailable && (
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <Text style={S.sectionTitle}>Chuyến đang chờ</Text>
            <View style={S.countBadge}><Text style={S.countBadgeText}>{pendingTrips.length}</Text></View>
          </View>
          {pendingTrips.length === 0 ? (
            <View style={S.emptyTrips}>
              <Text style={S.emptyTripsText}>Chưa có chuyến nào trong khu vực của bạn.</Text>
              <Text style={S.emptyTripsHint}>Hệ thống tự động cập nhật mỗi 5 giây</Text>
            </View>
          ) : (
            pendingTrips.map((trip) => (
              <View key={trip.id} style={S.tripCard}>
                <View style={S.tripCardHeader}>
                  <Text style={S.tripCardId}>Chuyến #{trip.id}</Text>
                  <Text style={S.tripCardRegion}>{trip.region === 'NORTH' ? 'Miền Bắc' : 'Miền Nam'}</Text>
                </View>
                <View style={S.tripRoute}>
                  <View style={S.tripRouteRow}><View style={S.dotGreen} /><Text style={S.tripRouteText} numberOfLines={1}>{trip.pickup_address}</Text></View>
                  <View style={S.tripRouteLine} />
                  <View style={S.tripRouteRow}><View style={S.dotRed} /><Text style={S.tripRouteText} numberOfLines={1}>{trip.dropoff_address}</Text></View>
                </View>
                <View style={S.tripCardFooter}>
                  <Text style={S.tripFare}>{Number(trip.fare).toLocaleString('vi-VN')}đ</Text>
                  <TouchableOpacity style={S.acceptBtn} onPress={() => handleAcceptTrip(trip.id)}>
                    <Text style={S.acceptBtnText}>NHẬN CHUYẾN</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgScreen },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  infoCard: { margin: Spacing.base, backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.base, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...Shadow.md },
  infoCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicleIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  vehicleIconText: { fontSize: 22 },
  vehiclePlate: { fontSize: 18, fontWeight: '800', color: Colors.gray900 },
  vehicleType: { fontSize: 12, color: Colors.gray400, fontWeight: '600', marginTop: 2 },
  infoCardRight: { alignItems: 'flex-end', gap: 6 },
  regionBadge: { backgroundColor: Colors.accentLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  regionBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  ratingText: { fontSize: 12, color: Colors.gray600 },
  statusCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.md, backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.base, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 2, borderColor: Colors.gray200, ...Shadow.sm },
  statusCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray900 },
  statusSub: { fontSize: 12, color: Colors.gray400, marginTop: 2 },
  locationCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.md, backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.base, ...Shadow.sm },
  locationTitle: { fontSize: 12, fontWeight: '700', color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  locationAddress: { fontSize: 15, fontWeight: '600', color: Colors.gray900, marginBottom: 4 },
  locationCoords: { fontSize: 12, color: Colors.gray400, fontFamily: 'monospace' },
  locationTime: { fontSize: 11, color: Colors.primary, marginTop: 4, fontWeight: '600' },
  section: { marginHorizontal: Spacing.base, marginBottom: Spacing.base },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: Colors.gray900 },
  countBadge: { backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  countBadgeText: { fontSize: 12, fontWeight: '800', color: Colors.white },
  emptyTrips: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: 24, alignItems: 'center', ...Shadow.sm },
  emptyTripsText: { fontSize: 15, color: Colors.gray600, textAlign: 'center', fontWeight: '500' },
  emptyTripsHint: { fontSize: 12, color: Colors.gray400, marginTop: 6 },
  tripCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.base, marginBottom: 10, ...Shadow.md },
  tripCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tripCardId: { fontSize: 15, fontWeight: '800', color: Colors.gray900 },
  tripCardRegion: { fontSize: 11, fontWeight: '700', color: Colors.accent, backgroundColor: Colors.accentLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  tripRoute: { backgroundColor: Colors.gray50, borderRadius: Radius.md, padding: 12, marginBottom: 12 },
  tripRouteRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tripRouteLine: { width: 2, height: 12, backgroundColor: Colors.gray300, marginLeft: 7, marginVertical: 2 },
  tripRouteText: { flex: 1, fontSize: 14, color: Colors.gray700 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.danger },
  tripCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripFare: { fontSize: 20, fontWeight: '900', color: Colors.gray900 },
  acceptBtn: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.lg, ...Shadow.primary },
  acceptBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
});
