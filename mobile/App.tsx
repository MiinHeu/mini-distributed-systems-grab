import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DriverHomeScreen from './src/screens/DriverHomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import BookingScreen from './src/screens/BookingScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import { API_BASE_URL } from './src/config';
import { Colors, Spacing, Radius, Shadow } from './src/theme';

type Screen = 'login' | 'register' | 'profile' | 'driver_home' | 'chat' | 'booking' | 'history';
type PreferredLanguage = 'vi' | 'en';
type User = { id: number; name: string; phone: string; email: string; role: 'customer' | 'driver' | 'admin'; avatar_url: string | null; preferred_language: PreferredLanguage; created_at: string; updated_at: string; };
type ChatParams = { tripId: number; receiverId: number; receiverName: string };
type ApiEnvelope<T> = { data: T };

async function requestApi<T>(path: string, language: PreferredLanguage, options: RequestInit = {}): Promise<T> {
  const response = await fetch(API_BASE_URL + path, { ...options, headers: { 'Accept-Language': language, ...(options.headers ?? {}) } });
  const data = (await response.json()) as ApiEnvelope<T> | { message?: string };
  if (!response.ok) { const message = 'message' in data && data.message ? data.message : `HTTP ${response.status}`; throw new Error(message); }
  return (data as ApiEnvelope<T>).data;
}

const i18n = {
  vi: { title: 'Mini Grab', login: 'Đăng nhập', register: 'Đăng ký', profile: 'Hồ sơ', driverHome: 'Tài xế', logout: 'Đăng xuất', name: 'Họ tên', phone: 'Số điện thoại', email: 'Email', password: 'Mật khẩu', language: 'Ngôn ngữ', save: 'Lưu', pickImage: 'Chọn ảnh', uploadImage: 'Tải ảnh', refresh: 'Tải lại', booking: 'Đặt xe', history: 'Lịch sử' },
  en: { title: 'Mini Grab', login: 'Login', register: 'Register', profile: 'Profile', driverHome: 'Driver', logout: 'Logout', name: 'Name', phone: 'Phone', email: 'Email', password: 'Password', language: 'Language', save: 'Save', pickImage: 'Pick image', uploadImage: 'Upload image', refresh: 'Refresh', booking: 'Booking', history: 'History' },
} as const;

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [language, setLanguage] = useState<PreferredLanguage>('vi');
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatParams, setChatParams] = useState<ChatParams | null>(null);
  const labels = useMemo(() => i18n[language], [language]);

  const handleLogin = (nextToken: string, user: User) => {
    setToken(nextToken); setCurrentUser(user);
    setScreen(user.role === 'driver' ? 'driver_home' : 'booking');
  };

  const handleLogout = async () => {
    if (token) { try { await requestApi<{ message: string }>('/auth/logout', language, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); } catch {} }
    setToken(''); setCurrentUser(null); setChatParams(null); setScreen('login');
  };

  const handleOpenChat = (tripId: number, receiverId: number, receiverName: string) => {
    setChatParams({ tripId, receiverId, receiverName }); setScreen('chat');
  };

  if (screen === 'chat' && chatParams && currentUser) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.primary }}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        <View style={S.chatHeader}>
          <TouchableOpacity onPress={() => setScreen('driver_home')} style={S.backBtn}>
            <Text style={S.backBtnText}>{'<'} Quay lại</Text>
          </TouchableOpacity>
          <Text style={S.chatHeaderTitle}>Tin nhắn</Text>
          <View style={{ width: 80 }} />
        </View>
        <ChatScreen tripId={chatParams.tripId} currentUserId={currentUser.id} receiverId={chatParams.receiverId} receiverName={chatParams.receiverName} token={token} />
      </SafeAreaView>
    );
  }

  if (screen === 'driver_home' && currentUser?.role === 'driver') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen }}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <View style={S.topBar}>
          <View style={S.topBarLeft}>
            <View style={S.logoMini}><Text style={S.logoMiniText}>MG</Text></View>
            <Text style={S.topBarTitle}>Mini Grab Driver</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={S.logoutPill}>
            <Text style={S.logoutPillText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
        <DriverHomeScreen token={token} userId={currentUser.id} onOpenChat={handleOpenChat} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <View style={S.header}>
        <View style={S.logoWrap}>
          <View style={S.logoBadge}><Text style={S.logoBadgeText}>MG</Text></View>
          <Text style={S.headerTitle}>{labels.title}</Text>
        </View>
        <View style={S.headerRight}>
          <TouchableOpacity onPress={() => setLanguage(language === 'vi' ? 'en' : 'vi')} style={S.langToggle}>
            <Text style={S.langToggleText}>{language.toUpperCase()}</Text>
          </TouchableOpacity>
          {token && (
            <TouchableOpacity onPress={handleLogout} style={S.headerLogout}>
              <Text style={S.headerLogoutText}>Thoát</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {token && (
        <View style={S.tabBar}>
          {(['booking', 'history', 'profile'] as const).map((s) => (
            <TouchableOpacity key={s} onPress={() => setScreen(s)} style={[S.tabItem, screen === s && S.tabItemActive]}>
              <Text style={[S.tabLabel, screen === s && S.tabLabelActive]}>
                {s === 'booking' ? 'Đặt xe' : s === 'history' ? 'Lịch sử' : 'Hồ sơ'}
              </Text>
            </TouchableOpacity>
          ))}
          {currentUser?.role === 'driver' && (
            <TouchableOpacity onPress={() => setScreen('driver_home')} style={[S.tabItem, screen === 'driver_home' && S.tabItemActive]}>
              <Text style={[S.tabLabel, screen === 'driver_home' && S.tabLabelActive]}>Tài xế</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading && <View style={S.loadingBar}><ActivityIndicator size="small" color={Colors.white} /></View>}

      <View style={S.content}>
        {screen === 'login' && <LoginScreen language={language} onLogin={handleLogin} setLoading={setLoading} onGoRegister={() => setScreen('register')} />}
        {screen === 'register' && <RegisterScreen language={language} setLoading={setLoading} onGoLogin={() => setScreen('login')} />}
        {screen === 'profile' && <ProfileScreen language={language} token={token} setLoading={setLoading} onNeedLogin={() => setScreen('login')} />}
        {screen === 'booking' && <BookingScreen token={token} />}
        {screen === 'history' && <HistoryScreen token={token} />}
      </View>
    </SafeAreaView>
  );
}

// ─── LoginScreen ─────────────────────────────────────────────────────────────
function LoginScreen({ language, onLogin, setLoading, onGoRegister }: { language: PreferredLanguage; onLogin: (t: string, u: User) => void; setLoading: (v: boolean) => void; onGoRegister: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) { Alert.alert('Thông báo', 'Vui lòng nhập email và mật khẩu'); return; }
    setLoading(true);
    try {
      const data = await requestApi<{ token: string; message: string; user: User }>('/auth/login', language, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }) });
      onLogin(data.token, data.user);
    } catch (e) { Alert.alert('Đăng nhập thất bại', (e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={S.authScroll}>
      <View style={S.authCard}>
        <View style={S.authHero}>
          <View style={S.authLogoBig}><Text style={S.authLogoBigText}>MG</Text></View>
          <Text style={S.authHeroTitle}>Chào mừng trở lại!</Text>
          <Text style={S.authHeroSub}>Đăng nhập để tiếp tục</Text>
        </View>
        <View style={S.inputGroup}>
          <Text style={S.inputLabel}>Email</Text>
          <TextInput style={S.input} value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.gray400} />
        </View>
        <View style={S.inputGroup}>
          <Text style={S.inputLabel}>Mật khẩu</Text>
          <TextInput style={S.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" placeholderTextColor={Colors.gray400} />
        </View>
        <TouchableOpacity style={S.primaryBtn} onPress={submit}>
          <Text style={S.primaryBtnText}>Đăng nhập</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onGoRegister} style={S.linkRow}>
          <Text style={S.linkText}>Chưa có tài khoản? <Text style={S.linkBold}>Đăng ký ngay</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── RegisterScreen ───────────────────────────────────────────────────────────
function RegisterScreen({ language, setLoading, onGoLogin }: { language: PreferredLanguage; setLoading: (v: boolean) => void; onGoLogin: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'driver' | 'admin'>('customer');

  const submit = async () => {
    if (!name || !phone || !email || !password) { Alert.alert('Thông báo', 'Vui lòng điền đầy đủ thông tin'); return; }
    setLoading(true);
    try {
      const data = await requestApi<{ message: string }>('/auth/register', language, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone, email, password, role, preferred_language: language }) });
      Alert.alert('Thành công', data.message);
      setPassword('');
      onGoLogin();
    } catch (e) { Alert.alert('Đăng ký thất bại', (e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={S.authScroll}>
      <View style={S.authCard}>
        <Text style={S.authCardTitle}>Tạo tài khoản mới</Text>
        {[{ label: 'Họ tên', val: name, set: setName, type: 'default' as const }, { label: 'Số điện thoại', val: phone, set: setPhone, type: 'phone-pad' as const }, { label: 'Email', val: email, set: setEmail, type: 'email-address' as const }].map(f => (
          <View key={f.label} style={S.inputGroup}>
            <Text style={S.inputLabel}>{f.label}</Text>
            <TextInput style={S.input} value={f.val} onChangeText={f.set} keyboardType={f.type} autoCapitalize="none" placeholderTextColor={Colors.gray400} placeholder={f.label} />
          </View>
        ))}
        <View style={S.inputGroup}>
          <Text style={S.inputLabel}>Mật khẩu</Text>
          <TextInput style={S.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" placeholderTextColor={Colors.gray400} />
        </View>
        <Text style={S.inputLabel}>Vai trò</Text>
        <View style={S.chipRow}>
          {(['customer', 'driver'] as const).map(r => (
            <TouchableOpacity key={r} onPress={() => setRole(r)} style={[S.chip, role === r && S.chipActive]}>
              <Text style={[S.chipText, role === r && S.chipTextActive]}>{r === 'customer' ? 'Khách hàng' : 'Tài xế'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={S.primaryBtn} onPress={submit}>
          <Text style={S.primaryBtnText}>Đăng ký</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onGoLogin} style={S.linkRow}>
          <Text style={S.linkText}>Đã có tài khoản? <Text style={S.linkBold}>Đăng nhập</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────
function ProfileScreen({ language, token, setLoading, onNeedLogin }: { language: PreferredLanguage; token: string; setLoading: (v: boolean) => void; onNeedLogin: () => void }) {
  const [profile, setProfile] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pickedUri, setPickedUri] = useState('');

  useEffect(() => { if (!token) { onNeedLogin(); return; } void load(); }, [token, language]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await requestApi<User>('/auth/me', language, { headers: { Authorization: `Bearer ${token}` } });
      setProfile(data); setName(data.name); setPhone(data.phone); setEmail(data.email);
    } catch (e) { Alert.alert('Lỗi', (e as Error).message); }
    finally { setLoading(false); }
  };

  const save = async () => {
    setLoading(true);
    try {
      const data = await requestApi<User>('/auth/me', language, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone, email }) });
      setProfile(data); Alert.alert('Thông báo', 'Đã lưu thành công');
    } catch (e) { Alert.alert('Lỗi', (e as Error).message); }
    finally { setLoading(false); }
  };

  const pickAvatar = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
    if (!r.canceled && r.assets[0]) setPickedUri(r.assets[0].uri);
  };

  const uploadAvatar = async () => {
    if (!pickedUri) { Alert.alert('Thông báo', 'Chưa chọn ảnh'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', { uri: pickedUri, name: `avatar-${Date.now()}.jpg`, type: 'image/jpeg' } as unknown as Blob);
      const data = await requestApi<{ message: string; user: User }>('/auth/me/avatar', language, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      setProfile(data.user); setPickedUri(''); Alert.alert('Thành công', data.message);
    } catch (e) { Alert.alert('Lỗi', (e as Error).message); }
    finally { setLoading(false); }
  };

  const avatarUrl = profile?.avatar_url ? API_BASE_URL + profile.avatar_url : '';

  return (
    <ScrollView contentContainerStyle={S.authScroll}>
      <View style={S.authCard}>
        <Text style={S.authCardTitle}>Hồ sơ của bạn</Text>
        <View style={S.avatarSection}>
          {(avatarUrl || pickedUri) ? (
            <Image source={{ uri: pickedUri || avatarUrl }} style={S.avatarImg} />
          ) : (
            <View style={S.avatarPlaceholder}><Text style={S.avatarPlaceholderText}>{profile?.name?.[0]?.toUpperCase() ?? 'U'}</Text></View>
          )}
          <View style={S.avatarBtns}>
            <TouchableOpacity onPress={pickAvatar} style={S.avatarBtn}><Text style={S.avatarBtnText}>Chọn ảnh</Text></TouchableOpacity>
            <TouchableOpacity onPress={uploadAvatar} style={[S.avatarBtn, S.avatarBtnPrimary]}><Text style={[S.avatarBtnText, { color: Colors.white }]}>Tải lên</Text></TouchableOpacity>
          </View>
        </View>
        {[{ label: 'Họ tên', val: name, set: setName }, { label: 'Số điện thoại', val: phone, set: setPhone }, { label: 'Email', val: email, set: setEmail }].map(f => (
          <View key={f.label} style={S.inputGroup}>
            <Text style={S.inputLabel}>{f.label}</Text>
            <TextInput style={S.input} value={f.val} onChangeText={f.set} placeholderTextColor={Colors.gray400} />
          </View>
        ))}
        <TouchableOpacity style={S.primaryBtn} onPress={save}><Text style={S.primaryBtnText}>Lưu thay đổi</Text></TouchableOpacity>
        <TouchableOpacity style={S.outlineBtn} onPress={load}><Text style={S.outlineBtnText}>Tải lại</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bgScreen },
  // Header
  header: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.base, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...Shadow.md },
  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center' },
  logoBadgeText: { fontSize: 14, fontWeight: '900', color: Colors.primary },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.white },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langToggle: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full },
  langToggleText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  headerLogout: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full },
  headerLogoutText: { color: Colors.white, fontSize: 13, fontWeight: '600' },
  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray200, ...Shadow.sm },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontSize: 13, fontWeight: '600', color: Colors.gray400 },
  tabLabelActive: { color: Colors.primary },
  // Loading bar
  loadingBar: { backgroundColor: Colors.primaryDark, paddingVertical: 4, alignItems: 'center' },
  content: { flex: 1 },
  // Top bar (driver)
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: 12, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray200, ...Shadow.sm },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMini: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  logoMiniText: { fontSize: 12, fontWeight: '900', color: Colors.white },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray900 },
  logoutPill: { backgroundColor: Colors.dangerLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.danger },
  logoutPillText: { color: Colors.danger, fontSize: 13, fontWeight: '600' },
  // Chat header
  chatHeader: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingVertical: 12 },
  backBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  backBtnText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  chatHeaderTitle: { fontSize: 16, fontWeight: '700', color: Colors.white },
  // Auth
  authScroll: { flexGrow: 1, padding: Spacing.base },
  authCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.xl, ...Shadow.md, gap: 12 },
  authHero: { alignItems: 'center', marginBottom: 8 },
  authLogoBig: { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12, ...Shadow.primary },
  authLogoBigText: { fontSize: 28, fontWeight: '900', color: Colors.white },
  authHeroTitle: { fontSize: 22, fontWeight: '800', color: Colors.gray900, marginBottom: 4 },
  authHeroSub: { fontSize: 14, color: Colors.gray400 },
  authCardTitle: { fontSize: 20, fontWeight: '800', color: Colors.gray900, marginBottom: 4 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.gray700 },
  input: { backgroundColor: Colors.bgInput, borderWidth: 1.5, borderColor: Colors.gray200, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.gray900 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center', ...Shadow.primary },
  primaryBtnText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
  outlineBtn: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 13, alignItems: 'center' },
  outlineBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  linkRow: { alignItems: 'center', paddingVertical: 4 },
  linkText: { fontSize: 14, color: Colors.gray600 },
  linkBold: { color: Colors.primary, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  chip: { flex: 1, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.gray200, alignItems: 'center', backgroundColor: Colors.white },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipText: { fontSize: 14, fontWeight: '600', color: Colors.gray600 },
  chipTextActive: { color: Colors.primary },
  // Avatar
  avatarSection: { alignItems: 'center', gap: 12, marginBottom: 8 },
  avatarImg: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: Colors.primary },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.primary },
  avatarPlaceholderText: { fontSize: 32, fontWeight: '800', color: Colors.primary },
  avatarBtns: { flexDirection: 'row', gap: 10 },
  avatarBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.gray300 },
  avatarBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  avatarBtnText: { fontSize: 13, fontWeight: '600', color: Colors.gray700 },
});
