import { Point } from '../types/trip';

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
  const res = await fetch(
    'https://unruminant-meticulously-delois.ngrok-free.dev/trips/estimate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickup_lat: pickup.latitude,
        pickup_lng: pickup.longitude,
        dropoff_lat: dropoff.latitude,
        dropoff_lng: dropoff.longitude,
      }),
    }
  );

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