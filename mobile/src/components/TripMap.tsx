import React from 'react';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { Point } from '../types/trip';

type Props = {
  mapRef: React.RefObject<MapView | null>;
  currentLocation: Point | null;
  pickup: Point | null;
  dropoff: Point | null;
  routeCoords: Point[];
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  onMapPress: (event: any) => void;
};

export default function TripMap({
  mapRef,
  currentLocation,
  pickup,
  dropoff,
  routeCoords,
  initialRegion,
  onMapPress,
}: Props) {
  return (
    <MapView
      ref={mapRef}
      provider="google"
      style={{ flex: 1 }}
      initialRegion={initialRegion}
      onPress={onMapPress}
      mapType="standard"
    >

      {currentLocation && (
        <Marker
          coordinate={currentLocation}
          title="Vị trí hiện tại"
          description="Current location"
          pinColor="blue"
        />
      )}

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
          strokeColor="#2563eb"
        />
      )}
    </MapView>
  );
}