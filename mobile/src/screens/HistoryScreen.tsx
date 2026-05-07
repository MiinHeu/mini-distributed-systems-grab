import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '../config';

interface TripHistory {
  id: number;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  fare: number;
  created_at: string;
  driver_name: string | null;
}

interface HistoryResponse {
  readOnly: boolean;
  warning: string | null;
  activeNode: string;
  data: TripHistory[];
}

interface HistoryScreenProps {
  token: string;
}

export default function HistoryScreen({ token }: HistoryScreenProps) {
  const [history, setHistory] = useState<TripHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      const res = await axios.get<HistoryResponse>(`${API_BASE_URL}/trips/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistory(res.data.data || []);
      setReadOnly(res.data.readOnly);
      setWarning(res.data.warning);
    } catch (error) {
      console.warn('Fetch history failed', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const renderItem = ({ item }: { item: TripHistory }) => (
    <View style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <Text style={styles.tripId}>Chuyến #{item.id}</Text>
        <Text style={[styles.statusTag, getStatusStyle(item.status)]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
      
      <View style={styles.addressRow}>
        <View style={styles.dotPickup} />
        <Text style={styles.addressText} numberOfLines={1}>{item.pickup_address}</Text>
      </View>
      <View style={styles.addressRow}>
        <View style={styles.dotDropoff} />
        <Text style={styles.addressText} numberOfLines={1}>{item.dropoff_address}</Text>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString('vi-VN')}</Text>
        <Text style={styles.fareText}>{item.fare.toLocaleString('vi-VN')}đ</Text>
      </View>
      {item.driver_name && (
        <Text style={styles.driverText}>Tài xế: {item.driver_name}</Text>
      )}
    </View>
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed': return styles.statusCompleted;
      case 'accepted': return styles.statusAccepted;
      case 'cancelled': return styles.statusCancelled;
      default: return styles.statusPending;
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00af50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {readOnly && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️ {warning || 'Hệ thống đang bảo trì. Chế độ chỉ đọc.'}
          </Text>
        </View>
      )}
      
      <FlatList
        data={history}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Bạn chưa có chuyến xe nào.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  warningBanner: {
    backgroundColor: '#fffbeb',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  warningText: { color: '#92400e', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  listContent: { padding: 16 },
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripId: { fontSize: 14, fontWeight: '700', color: '#111827' },
  statusTag: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusPending: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  statusAccepted: { backgroundColor: '#dbeafe', color: '#2563eb' },
  statusCompleted: { backgroundColor: '#dcfce7', color: '#166534' },
  statusCancelled: { backgroundColor: '#fee2e2', color: '#991b1b' },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dotPickup: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00af50', marginRight: 10 },
  dotDropoff: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginRight: 10 },
  addressText: { flex: 1, fontSize: 14, color: '#4b5563' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  dateText: { fontSize: 12, color: '#9ca3af' },
  fareText: { fontSize: 15, fontWeight: '700', color: '#111827' },
  driverText: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  emptyContainer: { marginTop: 100, alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 15 },
});
