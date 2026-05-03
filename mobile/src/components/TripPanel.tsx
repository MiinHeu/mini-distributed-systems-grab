import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Point, SelectMode } from '../types/trip';

type Props = {
  mode: SelectMode;
  pickup: Point | null;
  dropoff: Point | null;
  distanceKm: number | null;
  duration: number | null;
  fare: number | null;
  loadingLocation: boolean;
  onUseCurrentLocation: () => void;
  onCenterToCurrentLocation: () => void;
  onChangeMode: (mode: SelectMode) => void;
  onBook: () => void;
  onClear: () => void;
};

export default function TripPanel({
  mode,
  pickup,
  dropoff,
  distanceKm,
  duration,
  fare,
  loadingLocation,
  onUseCurrentLocation,
  onCenterToCurrentLocation,
  onChangeMode,
  onBook,
  onClear,
}: Props) {
  const formatPoint = (point: Point | null) => {
    if (!point) return 'Chưa chọn';
    return `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
  };

  return (
    <View style={styles.bottomCard}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.appTitle}>Ứng dụng đặt chuyến</Text>
        <Text style={styles.appSubtitle}>
          Chạm lên bản đồ để chọn vị trí đón và trả khách
        </Text>

        <View style={styles.quickActionRow}>
          <Pressable
            style={styles.quickActionButton}
            onPress={onUseCurrentLocation}
          >
            <Text style={styles.quickActionText}>
              {loadingLocation ? 'Đang lấy vị trí...' : 'Dùng vị trí hiện tại'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.quickActionOutlineButton}
            onPress={onCenterToCurrentLocation}
          >
            <Text style={styles.quickActionOutlineText}>Về vị trí tôi</Text>
          </Pressable>
        </View>

        <View style={styles.toggleRow}>
          <Pressable
            style={[
              styles.toggleButton,
              mode === 'pickup' && styles.toggleButtonActive,
            ]}
            onPress={() => onChangeMode('pickup')}
          >
            <Text
              style={[
                styles.toggleButtonText,
                mode === 'pickup' && styles.toggleButtonTextActive,
              ]}
            >
              Điểm đón
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.toggleButton,
              mode === 'dropoff' && styles.toggleButtonActive,
            ]}
            onPress={() => onChangeMode('dropoff')}
          >
            <Text
              style={[
                styles.toggleButtonText,
                mode === 'dropoff' && styles.toggleButtonTextActive,
              ]}
            >
              Điểm trả
            </Text>
          </Pressable>
        </View>

        <View style={styles.locationCard}>
          <View style={styles.locationHeaderRow}>
            <View style={[styles.dot, { backgroundColor: '#16a34a' }]} />
            <Text style={styles.locationLabel}>Điểm đón</Text>
          </View>
          <Text style={styles.locationValue}>{formatPoint(pickup)}</Text>
        </View>

        <View style={styles.locationCard}>
          <View style={styles.locationHeaderRow}>
            <View style={[styles.dot, { backgroundColor: '#dc2626' }]} />
            <Text style={styles.locationLabel}>Điểm trả</Text>
          </View>
          <Text style={styles.locationValue}>{formatPoint(dropoff)}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statTitle}>Khoảng cách</Text>
            <Text style={styles.statValue}>
              {distanceKm !== null ? `${distanceKm.toFixed(2)} km` : '--'}
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statTitle}>Thời gian</Text>
            <Text style={styles.statValue}>
              {duration !== null ? `${duration.toFixed(1)} phút` : '--'}
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statTitle}>Giá tiền</Text>
            <Text style={styles.statValue}>
              {fare !== null ? `${fare.toLocaleString()}đ` : '--'}
            </Text>
          </View>
        </View>

        <Pressable style={styles.bookButton} onPress={onBook}>
          <Text style={styles.bookButtonText}>Đặt chuyến ngay</Text>
        </Pressable>

        <Pressable style={styles.clearButton} onPress={onClear}>
          <Text style={styles.clearButtonText}>Xóa lựa chọn</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    marginTop: -18,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  appSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#dbeafe',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  quickActionText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 14,
  },
  quickActionOutlineButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  quickActionOutlineText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#eef2ff',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#2563eb',
  },
  toggleButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  toggleButtonTextActive: {
    color: '#ffffff',
  },
  locationCard: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 8,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  locationValue: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 18,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statTitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1d4ed8',
    textAlign: 'center',
  },
  bookButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  clearButton: {
    backgroundColor: '#fee2e2',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '800',
  },
});