import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { io, Socket } from 'socket.io-client';

type TripStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';

interface Trip {
  id: number;
  customer_id: number;
  driver_id: number | null;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  distance_km: number;
  fare: number;
  region: string;
  status: TripStatus;
  created_at: string;
}

interface DriverLocation {
  tripId: number;
  driverId: number;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  sentAt: string;
}

interface Props {
  trip: Trip;
}

const API_BASE = 'http://192.168.1.x:3000';
const SOCKET_URL = API_BASE;

const getAuthHeader = () => ({
  Authorization: 'Bearer YOUR_JWT_TOKEN_HERE',
});

export default function TripTrackingScreen({ trip }: Props) {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<TripStatus>(trip.status);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [connected, setConnected] = useState(false);

  const initialRegion: Region = useMemo(
    () => ({
      latitude: trip.pickup_lat,
      longitude: trip.pickup_lng,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    }),
    [trip.pickup_lat, trip.pickup_lng],
  );

  const etaMinutes = useMemo(() => {
    if (!driverLocation) return null;

    const distanceKm = haversineKm(
      driverLocation.latitude,
      driverLocation.longitude,
      trip.pickup_lat,
      trip.pickup_lng,
    );
    const citySpeedKmPerHour = 28;
    return Math.max(1, Math.round((distanceKm / citySpeedKmPerHour) * 60));
  }, [driverLocation, trip.pickup_lat, trip.pickup_lng]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      extraHeaders: getAuthHeader(),
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('trip:join', { tripId: trip.id });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('trip:accepted', payload => {
      if (payload.tripId === trip.id) {
        setStatus('accepted');
      }
    });

    socket.on('trip:status', payload => {
      if (payload.tripId === trip.id) {
        setStatus(payload.status);
      }
    });

    socket.on('driver:location', (payload: DriverLocation) => {
      if (payload.tripId === trip.id) {
        setDriverLocation(payload);
      }
    });

    return () => {
      socket.emit('trip:leave', { tripId: trip.id });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [trip.id]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />

      <MapView style={styles.map} initialRegion={initialRegion}>
        <Marker
          coordinate={{ latitude: trip.pickup_lat, longitude: trip.pickup_lng }}
          title="Pickup"
          description={trip.pickup_address}
          pinColor="#FF6B35"
        />
        <Marker
          coordinate={{ latitude: trip.dropoff_lat, longitude: trip.dropoff_lng }}
          title="Dropoff"
          description={trip.dropoff_address}
          pinColor="#378ADD"
        />
        {driverLocation && (
          <Marker
            coordinate={{
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
            }}
            title="Driver"
            description="Driver is on the way"
            pinColor="#1D9E75"
          />
        )}
        <Polyline
          coordinates={[
            { latitude: trip.pickup_lat, longitude: trip.pickup_lng },
            { latitude: trip.dropoff_lat, longitude: trip.dropoff_lng },
          ]}
          strokeColor="#111827"
          strokeWidth={3}
        />
      </MapView>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.label}>Trip status</Text>
            <Text style={styles.statusText}>{formatStatus(status)}</Text>
          </View>
          <View style={[styles.socketDot, connected ? styles.online : styles.offline]} />
        </View>

        <View style={styles.routeBox}>
          <Text style={styles.routeText}>{trip.pickup_address}</Text>
          <Text style={styles.routeArrow}>to</Text>
          <Text style={styles.routeText}>{trip.dropoff_address}</Text>
        </View>

        {driverLocation ? (
          <View style={styles.etaBox}>
            <Text style={styles.etaValue}>{etaMinutes} min</Text>
            <Text style={styles.etaLabel}>estimated driver arrival</Text>
          </View>
        ) : (
          <View style={styles.waitingBox}>
            <ActivityIndicator color="#FF6B35" />
            <Text style={styles.waitingText}>Waiting for driver location...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function formatStatus(status: TripStatus) {
  if (status === 'pending') return 'Waiting for driver';
  if (status === 'accepted') return 'Driver accepted';
  if (status === 'completed') return 'Completed';
  return 'Cancelled';
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  map: {
    flex: 1,
  },
  panel: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  label: {
    color: '#6B7280',
    fontSize: 12,
  },
  statusText: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '700',
    marginTop: 2,
  },
  socketDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  online: {
    backgroundColor: '#1D9E75',
  },
  offline: {
    backgroundColor: '#D64545',
  },
  routeBox: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
  },
  routeText: {
    color: '#111827',
    fontSize: 14,
  },
  routeArrow: {
    color: '#6B7280',
    fontSize: 12,
    marginVertical: 5,
  },
  etaBox: {
    marginTop: 14,
    backgroundColor: '#FFF0EB',
    borderRadius: 8,
    padding: 12,
  },
  etaValue: {
    color: '#FF6B35',
    fontSize: 24,
    fontWeight: '700',
  },
  etaLabel: {
    color: '#7C2D12',
    fontSize: 12,
    marginTop: 2,
  },
  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  waitingText: {
    color: '#6B7280',
    fontSize: 13,
  },
});
