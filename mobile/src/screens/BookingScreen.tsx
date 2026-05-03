import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, SafeAreaView, StatusBar } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';

import { Point, SelectMode } from '../types/trip';
import { DEFAULT_REGION } from '../constants/map';
import { estimateTripApi } from '../services/tripService';
import TripMap from '../components/TripMap';
import TripPanel from '../components/TripPanel';

export default function BookingScreen() {
  const mapRef = useRef<MapView | null>(null);

  const [pickup, setPickup] = useState<Point | null>(null);
  const [dropoff, setDropoff] = useState<Point | null>(null);
  const [mode, setMode] = useState<SelectMode>('pickup');

  const [routeCoords, setRouteCoords] = useState<Point[]>([]);
  const [fare, setFare] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  const [currentLocation, setCurrentLocation] = useState<Point | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  // ================= CLEAR =================
  const clearTrip = () => {
    setPickup(null);
    setDropoff(null);
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

  // ================= MAP =================
  const onMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const point = { latitude, longitude };

    if (mode === 'pickup') {
      setPickup(point);
      if (dropoff) estimateTrip(point, dropoff);
    } else {
      setDropoff(point);
      if (pickup) estimateTrip(pickup, point);
    }
  };

  // ================= BOOK =================
  const handleBookTrip = () => {
    if (!pickup || !dropoff) {
      Alert.alert('Thông báo', 'Vui lòng chọn đủ điểm');
      return;
    }

    Alert.alert('Thành công', 'Đặt chuyến thành công!');
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
        </View>

        <TripPanel
          mode={mode}
          pickup={pickup}
          dropoff={dropoff}
          distanceKm={distanceKm}
          duration={duration}
          fare={fare}
          loadingLocation={loadingLocation}
          onUseCurrentLocation={useCurrentLocationAsPickup}
          onCenterToCurrentLocation={centerToCurrentLocation}
          onChangeMode={setMode}
          onBook={handleBookTrip}
          onClear={clearTrip}
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
});