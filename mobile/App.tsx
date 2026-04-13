import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';

type Point = {
  latitude: number;
  longitude: number;
};

export default function App() {
  const mapRef = useRef<MapView | null>(null);

  const [pickup, setPickup] = useState<Point | null>(null);
  const [dropoff, setDropoff] = useState<Point | null>(null);
  const [mode, setMode] = useState<'pickup' | 'dropoff'>('pickup');

  const [routeCoords, setRouteCoords] = useState<Point[]>([]);
  const [fare, setFare] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  const clearTrip = () => {
    setPickup(null);
    setDropoff(null);
    setRouteCoords([]);
    setFare(null);
    setDuration(null);
    setDistanceKm(null);

    setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          latitude: 10.7769,
          longitude: 106.7009,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        500,
      );
    }, 100);
  };

  const estimateTrip = async (
    nextPickup?: Point | null,
    nextDropoff?: Point | null,
  ) => {
  
    const finalPickup = nextPickup ?? pickup;
    const finalDropoff = nextDropoff ?? dropoff;

    if (!finalPickup || !finalDropoff) return;

    try {
      const res = await fetch('https://unruminant-meticulously-delois.ngrok-free.dev/trips/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_lat: finalPickup.latitude,
          pickup_lng: finalPickup.longitude,
          dropoff_lat: finalDropoff.latitude,
          dropoff_lng: finalDropoff.longitude,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || 'Không gọi được API estimate');
      }

      if (!data.route || !data.route.coordinates) {
        throw new Error('Không có dữ liệu route');
      }

      const coords: Point[] = data.route.coordinates.map(
        ([lng, lat]: [number, number]) => ({
          latitude: lat,
          longitude: lng,
        }),
      );

      setRouteCoords(coords);
      setFare(data.estimated_fare ?? null);
      setDuration(data.duration_minutes ?? null);
      setDistanceKm(data.distance_km ?? null);

      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 50, bottom: 80, left: 50 },
          animated: true,
        });
      }, 300);
    } catch (error) {
  console.log('estimateTrip error:', error);
  console.log('Ngrok/backend lỗi, bỏ qua alert tạm thời');
}
  };

  const onMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const point = { latitude, longitude };

    if (mode === 'pickup') {
      setPickup(point);
      setRouteCoords([]);
      setFare(null);
      setDuration(null);
      setDistanceKm(null);

      if (dropoff) {
        estimateTrip(point, dropoff);
      }
    } else {
      setDropoff(point);
      setRouteCoords([]);
      setFare(null);
      setDuration(null);
      setDistanceKm(null);

      if (pickup) {
        estimateTrip(pickup, point);
      }
    }
  };

  const handleBookTrip = () => {
  if (!pickup || !dropoff) {
    Alert.alert('Thông báo', 'Vui lòng chọn đủ điểm đón và điểm trả.');
    return;
  }

  if (fare === null || distanceKm === null || duration === null) {
    Alert.alert(
      'Thông báo',
      'Chưa tính được chuyến đi. Hãy kiểm tra backend/ngrok rồi chọn lại điểm đón và điểm trả.',
    );
    return;
  }

  Alert.alert(
    'Đặt chuyến thành công',
    `Khoảng cách: ${distanceKm.toFixed(2)} km\nThời gian: ${duration.toFixed(
      1,
    )} phút\nGiá tiền: ${fare.toLocaleString()} VND`,
  );
};

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.title}>Đặt chuyến</Text>

        <View style={styles.row}>
          <Pressable
            style={[styles.button, mode === 'pickup' && styles.activeButton]}
            onPress={() => setMode('pickup')}
          >
            <Text style={styles.buttonText}>Chọn điểm đón</Text>
          </Pressable>

          <Pressable
            style={[styles.button, mode === 'dropoff' && styles.activeButton]}
            onPress={() => setMode('dropoff')}
          >
            <Text style={styles.buttonText}>Chọn điểm trả</Text>
          </Pressable>
        </View>

        <Text>
          Pickup:{' '}
          {pickup
            ? `${pickup.latitude.toFixed(6)}, ${pickup.longitude.toFixed(6)}`
            : 'Chưa chọn'}
        </Text>

        <Text>
          Dropoff:{' '}
          {dropoff
            ? `${dropoff.latitude.toFixed(6)}, ${dropoff.longitude.toFixed(6)}`
            : 'Chưa chọn'}
        </Text>

        {distanceKm !== null && (
          <Text style={styles.infoText}>
            Khoảng cách: {distanceKm.toFixed(2)} km
          </Text>
        )}

        {duration !== null && (
          <Text style={styles.infoText}>
            Thời gian: {duration.toFixed(1)} phút
          </Text>
        )}

        {fare !== null && (
          <Text style={styles.infoText}>
            Giá tiền: {fare.toLocaleString()} VND
          </Text>
        )}

        <View style={styles.actionRow}>
          <Pressable style={styles.bookButton} onPress={handleBookTrip}>
            <Text style={styles.bookButtonText}>Đặt chuyến</Text>
          </Pressable>

          <Pressable style={styles.clearButton} onPress={clearTrip}>
            <Text style={styles.clearButtonText}>Xóa chọn</Text>
          </Pressable>
        </View>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: 10.7769,
          longitude: 106.7009,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={onMapPress}
        mapType="none"
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />

        {pickup && (
          <Marker
            coordinate={pickup}
            title="Điểm đón"
            description="Pickup"
            pinColor="green"
          />
        )}

        {dropoff && (
          <Marker
            coordinate={dropoff}
            title="Điểm trả"
            description="Dropoff"
            pinColor="red"
          />
        )}

        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeWidth={5}
            strokeColor="blue"
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  panel: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    backgroundColor: '#666',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  activeButton: {
    backgroundColor: '#2563eb',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  infoText: {
    fontWeight: '700',
    fontSize: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  bookButton: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  map: {
    flex: 1,
  },
});