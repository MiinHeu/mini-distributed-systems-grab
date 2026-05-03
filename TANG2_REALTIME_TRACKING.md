# Nguoi 3 - Tang 2 Real-time Tracking


## Package can cai khi merge vao repo chung

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io socket.io-client
npx expo install expo-location react-native-maps
```

## Backend WebSocket events

```txt
trip:join        client join room theo tripId
trip:leave       client leave room theo tripId
driver:location  driver app gui toa do hien tai
trip:accepted    backend notify khach khi tai xe nhan chuyen
trip:status      backend notify status accepted/completed/cancelled
```

## Flow test sau khi backend chay

```txt
1. Khach mo TripTrackingScreen voi trip.id = 1.
2. TripTrackingScreen emit trip:join { tripId: 1 }.
3. Tai xe bam Nhan chuyen trong AcceptTripScreen.
4. Backend emit trip:accepted va trip:status.
5. AcceptTripScreen gui driver:location moi 10 giay khi co activeTrip.
6. TripTrackingScreen cap nhat marker tai xe va ETA tam tinh.
```

## Luu y merge

- Code da doi trip status sau khi nhan chuyen tu `active` sang `accepted` de khop bang phan cong.
- `API_BASE` va token trong mobile van la placeholder, can noi voi config/auth cua Nguoi 1 khi merge.
- `TripTrackingScreen` can duoc gan vao navigation cua app mobile chung.
