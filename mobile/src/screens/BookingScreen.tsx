import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Alert, SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';

import { Point, SelectMode } from '../types/trip';
import { DEFAULT_REGION } from '../constants/map';
import { estimateTripApi, bookTripApi } from '../services/tripService';
import TripMap from '../components/TripMap';
import TripPanel from '../components/TripPanel';
import { reverseGeocode } from '../utils/location';
import { API_BASE_URL } from '../config';
import { Colors, Spacing, Radius, Shadow } from '../theme';

interface BookingScreenProps { token: string; mockLoc: { city: string, lat: number, lng: number } | null; }
interface RegionHealthStatus { serviceLevel: 'full' | 'readonly' | 'unavailable'; warning: string | null; activeNode: string | null; }

const REGION_LATITUDE_THRESHOLD = 16.5;
function getRegionFromLatitude(lat: number): 'NORTH' | 'SOUTH' { return lat >= REGION_LATITUDE_THRESHOLD ? 'NORTH' : 'SOUTH'; }

export default function BookingScreen({ token, mockLoc }: BookingScreenProps) {
  const mapRef = useRef<MapView | null>(null);
  const [pickup, setPickup] = useState<Point | null>(null);
  const [pickupAddress, setPickupAddress] = useState('Chưa chọn');
  const [dropoff, setDropoff] = useState<Point | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState('Chưa chọn');
  const [mode, setMode] = useState<SelectMode>('pickup');
  const [routeCoords, setRouteCoords] = useState<Point[]>([]);
  const [fare, setFare] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Point | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [regionHealth, setRegionHealth] = useState<RegionHealthStatus>({ serviceLevel: 'full', warning: null, activeNode: null });
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [detectedRegion, setDetectedRegion] = useState<'NORTH' | 'SOUTH' | null>(null);

  const checkRegionHealth = useCallback(async (latitude: number) => {
    const region = getRegionFromLatitude(latitude);
    setDetectedRegion(region);
    setIsCheckingHealth(true);
    try {
      const endpoint = region === 'NORTH' ? '/health/north' : '/health/south';
      const res = await axios.get(`${API_BASE_URL}${endpoint}`, { timeout: 5000 });
      const data = res.data?.data;
      
      const serviceLevel: 'full' | 'readonly' | 'unavailable' = data?.serviceLevel?.[region] ?? 'full';
      
      let warning: string | null = null;
      let activeNode: string | null = null;
      if (serviceLevel === 'readonly') {
        warning = `${region === 'NORTH' ? 'Miền Bắc' : 'Miền Nam'} đang bảo trì. Không thể đặt chuyến mới.`;
        activeNode = region === 'NORTH' ? (data?.nodes?.NORTH_REPLICA?.status === 'online' ? 'NORTH_REPLICA' : null) : (data?.nodes?.SOUTH_REPLICA?.status === 'online' ? 'SOUTH_REPLICA' : null);
      } else if (serviceLevel === 'unavailable') {
        warning = `${region === 'NORTH' ? 'Miền Bắc' : 'Miền Nam'} hiện không khả dụng. Vui lòng thử lại sau.`;
      } else {
        activeNode = region === 'NORTH' ? 'NORTH_PRIMARY' : 'SOUTH_PRIMARY';
      }
      setRegionHealth({ serviceLevel, warning, activeNode });
    } catch { setRegionHealth({ serviceLevel: 'full', warning: null, activeNode: null }); }
    finally { setIsCheckingHealth(false); }
  }, []);

  useEffect(() => {
    if (pickup) { void checkRegionHealth(pickup.latitude); }
    else { setRegionHealth({ serviceLevel: 'full', warning: null, activeNode: null }); setDetectedRegion(null); }
  }, [pickup, checkRegionHealth]);

  useEffect(() => {
    if (!pickup) return;
    const id = setInterval(() => void checkRegionHealth(pickup.latitude), 10000);
    return () => clearInterval(id);
  }, [pickup, checkRegionHealth]);

  const clearTrip = () => {
    setPickup(null); setPickupAddress('Chưa chọn'); setDropoff(null); setDropoffAddress('Chưa chọn');
    setRouteCoords([]); setFare(null); setDuration(null); setDistanceKm(null);
    setRegionHealth({ serviceLevel: 'full', warning: null, activeNode: null }); setDetectedRegion(null);
    mapRef.current?.animateToRegion(DEFAULT_REGION, 500);
  };

  const getCurrentLocation = async () => {
    if (mockLoc) {
      const point = { latitude: mockLoc.lat, longitude: mockLoc.lng };
      setCurrentLocation(point);
      return point;
    }
    try {
      setLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Thông báo', 'Bạn chưa cấp quyền vị trí.'); return null; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const point = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setCurrentLocation(point); return point;
    } catch { Alert.alert('Lỗi', 'Không lấy được vị trí'); return null; }
    finally { setLoadingLocation(false); }
  };

  // Tự động nhảy vị trí khi chọn mockLoc từ thanh Demo
  useEffect(() => {
    if (mockLoc) {
      const point = { latitude: mockLoc.lat, longitude: mockLoc.lng };
      setPickup(point);
      setCurrentLocation(point);
      mapRef.current?.animateToRegion({
        ...point,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 500);
      
      // Lấy địa chỉ chữ cho vị trí giả lập
      void reverseGeocode(point.latitude, point.longitude).then(setPickupAddress);
    }
  }, [mockLoc]);

  const useCurrentLocationAsPickup = async () => {
    const point = await getCurrentLocation();
    if (!point) return;
    setPickup(point);
    const addr = await reverseGeocode(point.latitude, point.longitude);
    setPickupAddress(addr); setMode('dropoff');
    mapRef.current?.animateToRegion({ latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    if (dropoff) estimateTrip(point, dropoff);
  };

  const centerToCurrentLocation = async () => {
    const point = currentLocation ?? (await getCurrentLocation());
    if (!point) return;
    mapRef.current?.animateToRegion({ latitude: point.latitude, longitude: point.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
  };

  const estimateTrip = async (nextPickup?: Point | null, nextDropoff?: Point | null) => {
    const fp = nextPickup ?? pickup; const fd = nextDropoff ?? dropoff;
    if (!fp || !fd) return;
    try {
      const result = await estimateTripApi(fp, fd);
      setRouteCoords(result.coords); setFare(result.fare); setDuration(result.duration); setDistanceKm(result.distanceKm);
      setTimeout(() => mapRef.current?.fitToCoordinates(result.coords, { edgePadding: { top: 120, right: 60, bottom: 120, left: 60 }, animated: true }), 300);
    } catch { Alert.alert('Lỗi', 'Không gọi được API ước tính'); }
  };

  const handleSearchAddress = async (address: string) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        const point = { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
        if (mode === 'pickup') { setPickup(point); setPickupAddress(data[0].display_name); setMode('dropoff'); }
        else { setDropoff(point); setDropoffAddress(data[0].display_name); }
        mapRef.current?.animateToRegion({ ...point, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
        if (mode === 'pickup' && dropoff) estimateTrip(point, dropoff);
        if (mode === 'dropoff' && pickup) estimateTrip(pickup, point);
      } else { Alert.alert('Thông báo', 'Không tìm thấy địa chỉ này.'); }
    } catch { Alert.alert('Lỗi', 'Lỗi khi tìm kiếm địa chỉ.'); }
  };

  const onMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const point = { latitude, longitude };
    if (mode === 'pickup') { setPickup(point); reverseGeocode(latitude, longitude).then(setPickupAddress); setMode('dropoff'); if (dropoff) estimateTrip(point, dropoff); }
    else { setDropoff(point); reverseGeocode(latitude, longitude).then(setDropoffAddress); if (pickup) estimateTrip(pickup, point); }
  };

  const isReadOnly = regionHealth.serviceLevel !== 'full';
  const canBook = !!pickup && !!dropoff && !!token && !isReadOnly && !isBooking && !isCheckingHealth;

  const handleBookTrip = async () => {
    console.log('[BookingAudit] Nút Đặt xe được nhấn');
    console.log('[BookingAudit] Pickup:', pickup);
    console.log('[BookingAudit] Dropoff:', dropoff);
    console.log('[BookingAudit] Token exists:', !!token);
    
    if (!pickup || !dropoff) { Alert.alert('Thông báo', 'Vui lòng chọn đủ điểm đón và điểm trả'); return; }
    if (!token) { Alert.alert('Lỗi', 'Bạn cần đăng nhập để đặt xe'); return; }
    if (isReadOnly) { Alert.alert('Không thể đặt xe', regionHealth.warning ?? 'Khu vực này đang bảo trì.'); return; }
    try {
      setIsBooking(true);
      await bookTripApi(token, pickup, dropoff, fare || 0, pickupAddress, dropoffAddress);
      const regionLabel = detectedRegion === 'NORTH' ? 'Miền Bắc' : 'Miền Nam';
      Alert.alert('Đặt xe thành công!', `Chuyến xe đã được tạo tại ${regionLabel}.\nTài xế sẽ sớm liên hệ với bạn.`);
      clearTrip();
    } catch (error: any) {
      const msg = error?.response?.data?.warning || error?.response?.data?.message || error.message || 'Không thể đặt chuyến';
      Alert.alert('Lỗi đặt xe', msg);
    } finally { setIsBooking(false); }
  };

  return (
    <SafeAreaView style={S.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={S.container}>
        <View style={S.mapWrapper}>
          <TripMap mapRef={mapRef} currentLocation={currentLocation} pickup={pickup} dropoff={dropoff} routeCoords={routeCoords} initialRegion={DEFAULT_REGION} onMapPress={onMapPress} />

          {/* Mode badge */}
          <View style={S.modeBadge}>
            <Text style={S.modeBadgeText}>{mode === 'pickup' ? 'Đang chọn điểm đón' : 'Đang chọn điểm trả'}</Text>
          </View>

          {/* Region + node badge */}
          {detectedRegion && (
            <View style={[S.regionBadge, isReadOnly ? S.regionBadgeWarn : S.regionBadgeOk]}>
              <View style={[S.regionDot, { backgroundColor: isReadOnly ? Colors.warning : Colors.primary }]} />
              <Text style={S.regionBadgeText}>
                {detectedRegion === 'NORTH' ? 'Mien Bac' : 'Mien Nam'}
                {regionHealth.activeNode ? ` - ${regionHealth.activeNode}` : ''}
                {isCheckingHealth ? ' ...' : ''}
              </Text>
            </View>
          )}

          {/* Booking overlay */}
          {isBooking && (
            <View style={S.bookingOverlay}>
              <View style={S.bookingOverlayCard}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={S.bookingOverlayText}>Dang xu ly dat xe...</Text>
              </View>
            </View>
          )}
        </View>

        {/* Warning banner */}
        {isReadOnly && regionHealth.warning && (
          <View style={[S.warningBanner, regionHealth.serviceLevel === 'unavailable' ? S.warningBannerRed : S.warningBannerYellow]}>
            <Text style={S.warningIcon}>{regionHealth.serviceLevel === 'unavailable' ? '[x]' : '[!]'}</Text>
            <Text style={[S.warningText, regionHealth.serviceLevel === 'unavailable' ? S.warningTextRed : S.warningTextYellow]}>
              {regionHealth.warning}
            </Text>
          </View>
        )}

        <TripPanel
          mode={mode} pickup={pickup} pickupAddress={pickupAddress}
          dropoff={dropoff} dropoffAddress={dropoffAddress}
          distanceKm={distanceKm} duration={duration} fare={fare}
          loadingLocation={loadingLocation}
          onUseCurrentLocation={useCurrentLocationAsPickup}
          onCenterToCurrentLocation={centerToCurrentLocation}
          onChangeMode={setMode} onBook={handleBookTrip} onClear={clearTrip}
          onSearchAddress={handleSearchAddress}
          bookDisabled={!canBook}
          bookDisabledReason={
            !token ? 'Chưa đăng nhập' :
            !pickup ? 'Chưa chọn điểm đón' :
            !dropoff ? 'Chưa chọn điểm trả' :
            isCheckingHealth ? 'Đang kiểm tra vùng...' :
            isReadOnly ? (regionHealth.serviceLevel === 'unavailable' ? 'Khu vực không khả dụng' : 'Chế độ chỉ đọc') :
            undefined
          }
        />
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bgScreen },
  container: { flex: 1 },
  mapWrapper: { flex: 1.2, position: 'relative' },
  modeBadge: {
    position: 'absolute', top: 14, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: Radius.full,
  },
  modeBadgeText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  regionBadge: {
    position: 'absolute', top: 56, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full,
  },
  regionBadgeOk: { backgroundColor: 'rgba(0,175,80,0.88)' },
  regionBadgeWarn: { backgroundColor: 'rgba(245,158,11,0.92)' },
  regionDot: { width: 7, height: 7, borderRadius: 4 },
  regionBadgeText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  bookingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.80)', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  bookingOverlayCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: 28, alignItems: 'center', gap: 14, ...Shadow.lg },
  bookingOverlayText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.base, paddingVertical: 10, borderBottomWidth: 1 },
  warningBannerYellow: { backgroundColor: '#FFFBEB', borderBottomColor: '#FDE68A' },
  warningBannerRed: { backgroundColor: '#FEF2F2', borderBottomColor: '#FECACA' },
  warningIcon: { fontSize: 16 },
  warningText: { flex: 1, fontSize: 13, fontWeight: '600' },
  warningTextYellow: { color: '#92400E' },
  warningTextRed: { color: '#991B1B' },
});
