import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Point, SelectMode } from '../types/trip';
import { Colors, Spacing, Radius, Shadow } from '../theme';

type Props = {
  mode: SelectMode; pickup: Point | null; pickupAddress: string;
  dropoff: Point | null; dropoffAddress: string;
  distanceKm: number | null; duration: number | null; fare: number | null;
  loadingLocation: boolean;
  onUseCurrentLocation: () => void; onCenterToCurrentLocation: () => void;
  onChangeMode: (mode: SelectMode) => void;
  onBook: () => void; onClear: () => void; onSearchAddress: (address: string) => void;
  bookDisabled?: boolean; bookDisabledReason?: string;
};

export default function TripPanel({ mode, pickup, pickupAddress, dropoff, dropoffAddress, distanceKm, duration, fare, loadingLocation, onUseCurrentLocation, onCenterToCurrentLocation, onChangeMode, onBook, onClear, onSearchAddress, bookDisabled = false, bookDisabledReason }: Props) {
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setIsSearching(true);
    await onSearchAddress(searchText);
    setIsSearching(false);
  };

  return (
    <View style={S.panel}>
      <View style={S.handle} />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Search bar */}
        <View style={S.searchRow}>
          <View style={S.searchInputWrap}>
            <Text style={S.searchIcon}>[s]</Text>
            <TextInput style={S.searchInput} placeholder={mode === 'pickup' ? 'Nhap dia chi don...' : 'Nhap dia chi tra...'} value={searchText} onChangeText={setSearchText} onSubmitEditing={handleSearch} returnKeyType="search" placeholderTextColor={Colors.gray400} />
          </View>
          <Pressable style={S.searchBtn} onPress={handleSearch} disabled={isSearching}>
            {isSearching ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={S.searchBtnText}>Tim</Text>}
          </Pressable>
        </View>

        {/* Quick actions */}
        <View style={S.quickRow}>
          <Pressable style={S.quickBtn} onPress={onUseCurrentLocation}>
            <Text style={S.quickBtnText}>{loadingLocation ? 'Dang lay...' : '[gps] Vi tri hien tai'}</Text>
          </Pressable>
          <Pressable style={S.quickBtnOutline} onPress={onCenterToCurrentLocation}>
            <Text style={S.quickBtnOutlineText}>[map] Ve vi tri toi</Text>
          </Pressable>
        </View>

        {/* Mode toggle */}
        <View style={S.modeToggle}>
          <Pressable style={[S.modeBtn, mode === 'pickup' && S.modeBtnActive]} onPress={() => onChangeMode('pickup')}>
            <View style={[S.modeDot, { backgroundColor: mode === 'pickup' ? Colors.white : Colors.primary }]} />
            <Text style={[S.modeBtnText, mode === 'pickup' && S.modeBtnTextActive]}>Diem don</Text>
          </Pressable>
          <Pressable style={[S.modeBtn, mode === 'dropoff' && S.modeBtnActive]} onPress={() => onChangeMode('dropoff')}>
            <View style={[S.modeDot, { backgroundColor: mode === 'dropoff' ? Colors.white : Colors.danger }]} />
            <Text style={[S.modeBtnText, mode === 'dropoff' && S.modeBtnTextActive]}>Diem tra</Text>
          </Pressable>
        </View>

        {/* Route display */}
        <View style={S.routeCard}>
          <View style={S.routeRow}>
            <View style={S.routeDotGreen} />
            <View style={S.routeInfo}>
              <Text style={S.routeLabel}>Diem don</Text>
              <Text style={S.routeAddr} numberOfLines={2}>{pickupAddress}</Text>
            </View>
          </View>
          <View style={S.routeDivider}><View style={S.routeDividerLine} /></View>
          <View style={S.routeRow}>
            <View style={S.routeDotRed} />
            <View style={S.routeInfo}>
              <Text style={S.routeLabel}>Diem tra</Text>
              <Text style={S.routeAddr} numberOfLines={2}>{dropoffAddress}</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        {(distanceKm !== null || duration !== null || fare !== null) && (
          <View style={S.statsRow}>
            <View style={S.statBox}>
              <Text style={S.statLabel}>Khoang cach</Text>
              <Text style={S.statValue}>{distanceKm !== null ? `${distanceKm.toFixed(1)} km` : '--'}</Text>
            </View>
            <View style={S.statDivider} />
            <View style={S.statBox}>
              <Text style={S.statLabel}>Thoi gian</Text>
              <Text style={S.statValue}>{duration !== null ? `${Math.round(duration)} ph` : '--'}</Text>
            </View>
            <View style={S.statDivider} />
            <View style={[S.statBox, { flex: 1.4 }]}>
              <Text style={S.statLabel}>Gia uoc tinh</Text>
              <Text style={[S.statValue, { color: Colors.primary, fontSize: 18 }]}>{fare !== null ? `${fare.toLocaleString()}d` : '--'}</Text>
            </View>
          </View>
        )}

        {/* Book button */}
        <Pressable style={[S.bookBtn, bookDisabled && S.bookBtnDisabled]} onPress={onBook} disabled={bookDisabled}>
          <Text style={S.bookBtnText}>{bookDisabled && bookDisabledReason ? `[khoa] ${bookDisabledReason}` : 'DAT CHUYEN NGAY'}</Text>
        </Pressable>

        <Pressable style={S.clearBtn} onPress={onClear}>
          <Text style={S.clearBtnText}>Xoa lua chon</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  panel: { flex: 1, backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: Spacing.base, paddingTop: 10, paddingBottom: 12, ...Shadow.lg },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.gray200, alignSelf: 'center', marginBottom: 14 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.gray50, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.gray200, paddingHorizontal: 12 },
  searchIcon: { fontSize: 16, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: Colors.gray900 },
  searchBtn: { backgroundColor: Colors.accent, paddingHorizontal: 16, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', minWidth: 60 },
  searchBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickBtn: { flex: 1, backgroundColor: Colors.primaryLight, paddingVertical: 11, borderRadius: Radius.md, alignItems: 'center' },
  quickBtnText: { color: Colors.primaryDark, fontWeight: '700', fontSize: 13 },
  quickBtnOutline: { flex: 1, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.gray200, paddingVertical: 11, borderRadius: Radius.md, alignItems: 'center' },
  quickBtnOutlineText: { color: Colors.gray700, fontWeight: '700', fontSize: 13 },
  modeToggle: { flexDirection: 'row', backgroundColor: Colors.gray100, borderRadius: Radius.lg, padding: 4, marginBottom: 12 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.md },
  modeBtnActive: { backgroundColor: Colors.primary, ...Shadow.sm },
  modeDot: { width: 8, height: 8, borderRadius: 4 },
  modeBtnText: { fontSize: 14, fontWeight: '700', color: Colors.gray600 },
  modeBtnTextActive: { color: Colors.white },
  routeCard: { backgroundColor: Colors.gray50, borderRadius: Radius.lg, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.gray200 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  routeDotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary, marginTop: 4, borderWidth: 2, borderColor: Colors.primaryLight },
  routeDotRed: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.danger, marginTop: 4, borderWidth: 2, borderColor: Colors.dangerLight },
  routeInfo: { flex: 1 },
  routeLabel: { fontSize: 11, fontWeight: '700', color: Colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  routeAddr: { fontSize: 14, color: Colors.gray900, fontWeight: '500', lineHeight: 20 },
  routeDivider: { paddingLeft: 5, paddingVertical: 4 },
  routeDividerLine: { width: 2, height: 16, backgroundColor: Colors.gray300, marginLeft: 1 },
  statsRow: { flexDirection: 'row', backgroundColor: Colors.gray50, borderRadius: Radius.lg, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: Colors.gray200 },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: Colors.gray200, marginVertical: 4 },
  statLabel: { fontSize: 11, color: Colors.gray400, fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '800', color: Colors.gray900 },
  bookBtn: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: Radius.xl, alignItems: 'center', marginBottom: 10, ...Shadow.primary },
  bookBtnDisabled: { backgroundColor: Colors.gray300, shadowOpacity: 0 },
  bookBtnText: { color: Colors.white, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  clearBtn: { backgroundColor: Colors.dangerLight, paddingVertical: 13, borderRadius: Radius.xl, alignItems: 'center' },
  clearBtnText: { color: Colors.danger, fontSize: 14, fontWeight: '700' },
});
