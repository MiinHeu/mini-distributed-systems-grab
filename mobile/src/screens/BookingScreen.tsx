import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';

import { Point, SelectMode } from '../types/trip';
import { DEFAULT_REGION } from '../constants/map';
import { estimateTripApi, bookTripApi } from '../services/tripService';
import TripMap from '../components/TripMap';
import TripPanel from '../components/TripPanel';
import { reverseGeocode } from '../utils/location';

interface BookingScreenProps {
  token: string;
}

export default function BookingScreen({ token }: BookingScreenProps) {
  const mapRef = useRef<MapView | null>(null);

  const [pickup, setPickup] = useState<Point | null>(null);
  const [pickupAddress, setPickupAddress] = useState<string>('Chưa chọn');
  const [dropoff, setDropoff] = useState<Point | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState<string>('Chưa chọn');
  const [mode, setMode] = useState<SelectMode>('pickup');

  const [routeCoords, setRouteCoords] = useState<Point[]>([]);
  const [fare, setFare] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  const [currentLocation, setCurrentLocation] = useState<Point | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  // ================= CLEAR =================
  const clearTrip = () => {
    setPickup(null);
    setPickupAddress('Chưa chọn');
    setDropoff(null);
    setDropoffAddress('Chưa chọn');
    setRouteCoords([]);
    setFare(null);
    setDuration(null);
    setDistanceKm(null);

    mapRef.current?.animateToRegion(DEFAULT_REGION, 500);
  };

  // ================= LOCATION =================
  const getCurrentLocation = async () => {
    try {
      setLoadingLocation(true);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Thông báo', 'Bạn chưa cấp quyền vị trí.');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const point = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCurrentLocation(point);
      return point;
    } catch (error) {
      console.log(error);
      Alert.alert('Lỗi', 'Không lấy được vị trí');
      return null;
    } finally {
      setLoadingLocation(false);
    }
  };

  const useCurrentLocationAsPickup = async () => {
    const point = await getCurrentLocation();
    if (!point) return;

    setPickup(point);
    const addr = await reverseGeocode(point.latitude, point.longitude);
    setPickupAddress(addr);
    setMode('dropoff');

    mapRef.current?.animateToRegion(
      {
        latitude: point.latitude,
        longitude: point.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      500
    );

    if (dropoff) estimateTrip(point, dropoff);
  };

  const centerToCurrentLocation = async () => {
    const point = currentLocation ?? (await getCurrentLocation());
    if (!point) return;

    mapRef.current?.animateToRegion(
      {
        latitude: point.latitude,
        longitude: point.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      500
    );
  };

  // ================= API =================
  const estimateTrip = async (
    nextPickup?: Point | null,
    nextDropoff?: Point | null
  ) => {
    const finalPickup = nextPickup ?? pickup;
    const finalDropoff = nextDropoff ?? dropoff;

    if (!finalPickup || !finalDropoff) return;

    try {
      const result = await estimateTripApi(finalPickup, finalDropoff);

      setRouteCoords(result.coords);
      setFare(result.fare);
      setDuration(result.duration);
      setDistanceKm(result.distanceKm);

      setTimeout(() => {
        mapRef.current?.fitToCoordinates(result.coords, {
          edgePadding: { top: 120, right: 60, bottom: 120, left: 60 },
          animated: true,
        });
      }, 300);
    } catch (error) {
      console.log(error);
      Alert.alert('Lỗi', 'Không gọi được API');
    }
  };
  // ================= SEARCH =================
  const handleSearchAddress = async (address: string) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const point = {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        };

        if (mode === 'pickup') {
          setPickup(point);
          setPickupAddress(data[0].display_name);
          setMode('dropoff');
        } else {
          setDropoff(point);
          setDropoffAddress(data[0].display_name);
        }

        mapRef.current?.animateToRegion(
          {
            ...point,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500
        );

        if (mode === 'pickup' && dropoff) estimateTrip(point, dropoff);
        if (mode === 'dropoff' && pickup) estimateTrip(pickup, point);
      } else {
        Alert.alert('Thông báo', 'Không tìm thấy địa chỉ này.');
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Lỗi', 'Lỗi khi tìm kiếm địa chỉ.');
    }
  };

  // ================= MAP =================
  const onMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const point = { latitude, longitude };

    if (mode === 'pickup') {
      setPickup(point);
      reverseGeocode(latitude, longitude).then(setPickupAddress);
      setMode('dropoff'); // Tự động chuyển sang chọn điểm trả
      if (dropoff) estimateTrip(point, dropoff);
    } else {
      setDropoff(point);
      reverseGeocode(latitude, longitude).then(setDropoffAddress);
      if (pickup) estimateTrip(pickup, point);
    }
  };

  // ================= BOOK =================
  const handleBookTrip = async () => {
    if (!pickup || !dropoff) {
      Alert.alert('Thông báo', 'Vui lòng chọn đủ điểm');
      return;
    }

    if (!token) {
      Alert.alert('Lỗi', 'Bạn cần đăng nhập để đặt xe');
      return;
    }

    try {
      setIsBooking(true);
      await bookTripApi(
        token,
        pickup,
        dropoff,
        fare || 0,
        pickupAddress,
        dropoffAddress
      );
      Alert.alert('Thành công', 'Đặt chuyến thành công! Tài xế sẽ sớm liên hệ với bạn.');
      clearTrip();
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể đặt chuyến');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.container}>
        <View style={styles.mapWrapper}>
          <TripMap
            mapRef={mapRef}
            currentLocation={currentLocation}
            pickup={pickup}
            dropoff={dropoff}
            routeCoords={routeCoords}
            initialRegion={DEFAULT_REGION}
            onMapPress={onMapPress}
          />

          <View style={styles.topBadge}>
            <Text style={styles.topBadgeText}>
              {mode === 'pickup' ? 'Đang chọn điểm đón' : 'Đang chọn điểm trả'}
            </Text>
          </View>
          
          {isBooking && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#00af50" />
              <Text style={styles.loadingText}>Đang xử lý đặt xe...</Text>
            </View>
          )}
        </View>

          <TripPanel
            mode={mode}
            pickup={pickup}
            pickupAddress={pickupAddress}
            dropoff={dropoff}
            dropoffAddress={dropoffAddress}
            distanceKm={distanceKm}
            duration={duration}
            fare={fare}
            loadingLocation={loadingLocation}
            onUseCurrentLocation={useCurrentLocationAsPickup}
            onCenterToCurrentLocation={centerToCurrentLocation}
            onChangeMode={setMode}
            onBook={handleBookTrip}
            onClear={clearTrip}
            onSearchAddress={handleSearchAddress}
          />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f7ff' },
  container: { flex: 1 },
  mapWrapper: { flex: 1.15, position: 'relative' },

  topBadge: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 20,
  },
  topBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 10,
    color: '#00af50',
    fontWeight: 'bold',
  }
});