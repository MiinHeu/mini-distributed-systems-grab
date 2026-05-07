import { Point } from '../types/trip';
import { API_BASE_URL } from '../config';

type EstimateResponse = {
  route?: {
    coordinates?: [number, number][];
  };
  estimated_fare?: number;
  duration_minutes?: number;
  distance_km?: number;
  message?: string;
};

export async function estimateTripApi(pickup: Point, dropoff: Point) {
  const res = await fetch(`${API_BASE_URL}/trips/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pickup_lat: pickup.latitude,
      pickup_lng: pickup.longitude,
      dropoff_lat: dropoff.latitude,
      dropoff_lng: dropoff.longitude,
    }),
  });

  const data: EstimateResponse = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || 'Không gọi được API estimate');
  }

  if (!data.route || !data.route.coordinates) {
    throw new Error('Không có dữ liệu route');
  }

  const coords: Point[] = data.route.coordinates.map(([lng, lat]) => ({
    latitude: lat,
    longitude: lng,
  }));

  return {
    coords,
    fare: data.estimated_fare ?? null,
    duration: data.duration_minutes ?? null,
    distanceKm: data.distance_km ?? null,
  };
}

export async function bookTripApi(
  token: string,
  pickup: Point,
  dropoff: Point,
  fare: number,
  pickupAddress?: string,
  dropoffAddress?: string,
) {
  const res = await fetch(`${API_BASE_URL}/trips/book`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      pickup_lat: pickup.latitude,
      pickup_lng: pickup.longitude,
      dropoff_lat: dropoff.latitude,
      dropoff_lng: dropoff.longitude,
      pickup: pickupAddress || `Vị trí tại [${pickup.latitude.toFixed(4)}, ${pickup.longitude.toFixed(4)}]`,
      dropoff: dropoffAddress || `Vị trí tại [${dropoff.latitude.toFixed(4)}, ${dropoff.longitude.toFixed(4)}]`,
      fare: fare,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || 'Lỗi khi đặt chuyến');
  }
  return data;
}