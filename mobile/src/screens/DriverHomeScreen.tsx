import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Switch, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios';

// Dùng lại địa chỉ IP LAN của máy tính để gọi từ điện thoại thật
const API_URL = 'http://192.168.1.7:3000/drivers';
const DRIVER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; // Mock ID của node NORTH thiết lập trong CSDL

export default function DriverHomeScreen() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Ref để lưu trữ interval timer
  const locationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Chức năng Toggle "Sẵn sàng nhận khách"
  const toggleSwitch = async () => {
    const newValue = !isAvailable;
    try {
      // 1a. Cập nhật state nội bộ để bật tắt vòng lặp
      setIsAvailable(newValue);

      // 1b. Gửi API thay đổi
      await axios.patch(`${API_URL}/availability`, {
        driver_id: DRIVER_ID,
        is_available: newValue,
      });

      if (newValue) {
        // Bắt đầu tracking
        startLocationTracking();
      } else {
        // Tắt tracking
        stopLocationTracking();
      }
    } catch (error: any) {
      // Xử lý khi Primary DB đang sập nhưng tài xế cố tình bật Online
      setIsAvailable(false);
      stopLocationTracking();
      Alert.alert(
        'Lỗi hệ thống',
        'Máy chủ khu vực của bạn hiện đang bảo trì (Primary Down). Vui lòng thử lại sau.'
      );
    }
  };

  // 2. Chức năng Tracker chạy ngầm/mỗi 10 giây
  const startLocationTracking = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setErrorMsg('Quyền truy cập vị trí bị từ chối');
      setIsAvailable(false);
      return;
    }

    // Gửi ngay 1 lần cập nhật vị trí lập tức
    await sendLocationUpdate();

    // 10s gửi lại 1 lần
    locationTimerRef.current = setInterval(async () => {
      await sendLocationUpdate();
    }, 10000);
  };

  const stopLocationTracking = () => {
    if (locationTimerRef.current) {
      clearInterval(locationTimerRef.current);
      locationTimerRef.current = null;
    }
  };

  const sendLocationUpdate = async () => {
    try {
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);

      await axios.patch(`${API_URL}/location`, {
        driver_id: DRIVER_ID,
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });

      console.log('GPS Updated successfully:', currentLocation.coords);
    } catch (error: any) {
      console.warn('GPS Update Failed:', error.message);
      // NẾU LỖI LÀ DO ĐỨT KẾT NỐI HOẶC PRIMARY NODE SẬP (Fallback Database Failover) => Tự động off
      stopLocationTracking();
      setIsAvailable(false);
      Alert.alert(
        'Mất kết nối',
        'Cơ sở dữ liệu máy chủ chính không phản hồi (Chế độ Read-Only). Định vị đã tạm dừng để tránh thất thoát dữ liệu.'
      );
    }
  };

  // Cleanup effect
  useEffect(() => {
    return () => stopLocationTracking();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mini Grab Driver</Text>

      <View style={styles.statusBox}>
        <Text style={styles.statusText}>
          Trạng thái: {isAvailable ? 'Sẵn sàng nhận khách 🚗' : 'Đang nghỉ ngơi ☕'}
        </Text>
        <Switch
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={isAvailable ? '#f5dd4b' : '#f4f3f4'}
          ios_backgroundColor="#3e3e3e"
          onValueChange={toggleSwitch}
          value={isAvailable}
        />
      </View>

      <Text style={styles.errorText}>{errorMsg}</Text>

      {location && (
        <View style={styles.locationBox}>
          <Text style={styles.locationText}>Vị trí cuối cùng:</Text>
          <Text>Lat: {location.coords.latitude}</Text>
          <Text>Lng: {location.coords.longitude}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.refreshBtn}
        onPress={sendLocationUpdate}
        disabled={!isAvailable}
      >
        <Text style={styles.refreshText}>Cập nhật lại GPS ngay bây giờ</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00af50', // Màu chủ đạo Grab
    textAlign: 'center',
    marginBottom: 40,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    marginBottom: 20,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationBox: {
    marginTop: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
  },
  locationText: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
  },
  refreshBtn: {
    marginTop: 30,
    backgroundColor: '#00af50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    opacity: 0.9,
  },
  refreshText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
