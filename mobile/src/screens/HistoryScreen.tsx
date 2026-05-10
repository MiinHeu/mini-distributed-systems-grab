import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Colors, Spacing, Radius, Shadow } from '../theme';

interface TripHistory { id: string; status: string; pickup_address: string; dropoff_address: string; fare: number; created_at: string; driver_name: string | null; region?: string; }
interface HistoryResponse { readOnly: boolean; warning: string | null; activeNode: string; data: TripHistory[]; }
interface HistoryScreenProps { token: string; }

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  completed: { label: 'Hoan thanh', bg: '#D1FAE5', color: '#065F46' },
  accepted:  { label: 'Dang di',    bg: '#DBEAFE', color: '#1E40AF' },
  cancelled: { label: 'Da huy',     bg: '#FEE2E2', color: '#991B1B' },
  pending:   { label: 'Cho tai xe', bg: '#FEF3C7', color: '#92400E' },
};

export default function HistoryScreen({ token }: HistoryScreenProps) {
  const [history, setHistory] = useState<TripHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [activeNode, setActiveNode] = useState<string>('');

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get<HistoryResponse>(`${API_BASE_URL}/trips/history`, { headers: { Authorization: `Bearer ${token}` } });
      setHistory(res.data.data || []);
      setReadOnly(res.data.readOnly);
      setWarning(res.data.warning);
      setActiveNode(res.data.activeNode || '');
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const renderItem = ({ item, index }: { item: TripHistory; index: number }) => {
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
    return (
      <View style={[S.card, index === 0 && { marginTop: 0 }]}>
        <View style={S.cardHeader}>
          <View style={S.tripIdWrap}>
            <Text style={S.tripIdLabel}>Chuyen</Text>
            <Text style={S.tripId}>#{item.id}</Text>
          </View>
          <View style={[S.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[S.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <View style={S.routeWrap}>
          <View style={S.routeRow}>
            <View style={S.dotGreen} />
            <Text style={S.routeText} numberOfLines={1}>{item.pickup_address}</Text>
          </View>
          <View style={S.routeLine} />
          <View style={S.routeRow}>
            <View style={S.dotRed} />
            <Text style={S.routeText} numberOfLines={1}>{item.dropoff_address}</Text>
          </View>
        </View>
        <View style={S.cardFooter}>
          <View style={S.footerLeft}>
            <Text style={S.dateText}>{new Date(item.created_at).toLocaleDateString('vi-VN')}</Text>
            {item.driver_name && <Text style={S.driverText}>Tai xe: {item.driver_name}</Text>}
            {item.region && <Text style={S.regionTag}>{item.region === 'NORTH' ? 'Mien Bac' : 'Mien Nam'}</Text>}
          </View>
          <Text style={S.fareText}>{Number(item.fare).toLocaleString('vi-VN')}d</Text>
        </View>
      </View>
    );
  };

  if (loading) return <View style={S.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={S.container}>
      {readOnly && (
        <View style={S.warningBanner}>
          <Text style={S.warningIcon}>!</Text>
          <View style={{ flex: 1 }}>
            <Text style={S.warningTitle}>Che do chi doc</Text>
            <Text style={S.warningMsg}>{warning || 'He thong dang bao tri.'}</Text>
          </View>
          {activeNode ? <Text style={S.nodeTag}>{activeNode}</Text> : null}
        </View>
      )}
      <FlatList
        data={history}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={S.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(); }} colors={[Colors.primary]} />}
        ListHeaderComponent={
          <View style={S.listHeader}>
            <Text style={S.listHeaderTitle}>Lich su chuyen xe</Text>
            <Text style={S.listHeaderSub}>{history.length} chuyen</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={S.empty}>
            <Text style={S.emptyIcon}>[xe]</Text>
            <Text style={S.emptyTitle}>Chua co chuyen nao</Text>
            <Text style={S.emptySub}>Dat chuyen dau tien cua ban ngay bay gio!</Text>
          </View>
        }
      />
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgScreen },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFBEB', paddingHorizontal: Spacing.base, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  warningIcon: { fontSize: 20, color: Colors.warning },
  warningTitle: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  warningMsg: { fontSize: 12, color: '#B45309', marginTop: 1 },
  nodeTag: { fontSize: 10, fontWeight: '700', color: Colors.warning, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  list: { padding: Spacing.base, gap: 12 },
  listHeader: { marginBottom: 4 },
  listHeaderTitle: { fontSize: 20, fontWeight: '800', color: Colors.gray900 },
  listHeaderSub: { fontSize: 13, color: Colors.gray400, marginTop: 2 },
  card: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.base, ...Shadow.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tripIdWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  tripIdLabel: { fontSize: 12, color: Colors.gray400, fontWeight: '600' },
  tripId: { fontSize: 16, fontWeight: '800', color: Colors.gray900 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { fontSize: 12, fontWeight: '700' },
  routeWrap: { backgroundColor: Colors.gray50, borderRadius: Radius.md, padding: 12, marginBottom: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeLine: { width: 2, height: 14, backgroundColor: Colors.gray300, marginLeft: 7, marginVertical: 2 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, borderWidth: 2, borderColor: Colors.primaryLight },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.danger, borderWidth: 2, borderColor: Colors.dangerLight },
  routeText: { flex: 1, fontSize: 14, color: Colors.gray700, fontWeight: '500' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  footerLeft: { gap: 2 },
  dateText: { fontSize: 12, color: Colors.gray400 },
  driverText: { fontSize: 12, color: Colors.gray600 },
  regionTag: { fontSize: 11, color: Colors.accent, fontWeight: '600' },
  fareText: { fontSize: 18, fontWeight: '800', color: Colors.gray900 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.gray700 },
  emptySub: { fontSize: 14, color: Colors.gray400, textAlign: 'center' },
});
