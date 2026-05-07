import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DriverHomeScreen from './src/screens/DriverHomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import BookingScreen from './src/screens/BookingScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import { API_BASE_URL } from './src/config';

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen = 'login' | 'register' | 'profile' | 'driver_home' | 'chat' | 'booking' | 'history';
type PreferredLanguage = 'vi' | 'en';

type User = {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: 'customer' | 'driver' | 'admin';
  avatar_url: string | null;
  preferred_language: PreferredLanguage;
  created_at: string;
  updated_at: string;
};

type ChatParams = {
  tripId: number;
  receiverId: number;
  receiverName: string;
};

type ApiEnvelope<T> = { data: T };

// ─── API helper ──────────────────────────────────────────────────────────────

async function requestApi<T>(
  path: string,
  language: PreferredLanguage,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Accept-Language': language,
      ...(options.headers ?? {}),
    },
  });

  const data = (await response.json()) as ApiEnvelope<T> | { message?: string };

  if (!response.ok) {
    const message = 'message' in data && data.message ? data.message : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return (data as ApiEnvelope<T>).data;
}

// ─── i18n ────────────────────────────────────────────────────────────────────

const i18n = {
  vi: {
    title: 'Mini Grab',
    login: 'Đăng nhập',
    register: 'Đăng ký',
    profile: 'Hồ sơ',
    driverHome: 'Tài xế',
    logout: 'Đăng xuất',
    name: 'Họ tên',
    phone: 'Số điện thoại',
    email: 'Email',
    password: 'Mật khẩu',
    language: 'Ngôn ngữ',
    save: 'Lưu',
    pickImage: 'Chọn ảnh',
    uploadImage: 'Tải ảnh',
    refresh: 'Tải lại',
    booking: 'Đặt xe',
    history: 'Lịch sử',
  },
  en: {
    title: 'Mini Grab',
    login: 'Login',
    register: 'Register',
    profile: 'Profile',
    driverHome: 'Driver',
    logout: 'Logout',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    password: 'Password',
    language: 'Language',
    save: 'Save',
    pickImage: 'Pick image',
    uploadImage: 'Upload image',
    refresh: 'Refresh',
    booking: 'Booking',
    history: 'History',
  },
} as const;

// ─── Root App ────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [language, setLanguage] = useState<PreferredLanguage>('vi');
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatParams, setChatParams] = useState<ChatParams | null>(null);

  const labels = useMemo(() => i18n[language], [language]);

  const handleLogin = (nextToken: string, user: User) => {
    setToken(nextToken);
    setCurrentUser(user);
    // Tài xế → vào màn hình driver, khách/admin → vào booking
    setScreen(user.role === 'driver' ? 'driver_home' : 'booking');
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await requestApi<{ message: string }>('/auth/logout', language, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore
      }
    }
    setToken('');
    setCurrentUser(null);
    setChatParams(null);
    setScreen('login');
  };

  const handleOpenChat = (tripId: number, receiverId: number, receiverName: string) => {
    setChatParams({ tripId, receiverId, receiverName });
    setScreen('chat');
  };

  // ── Màn hình Chat ──────────────────────────────────────────────────────────
  if (screen === 'chat' && chatParams && currentUser) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.chatBackBar}>
          <TouchableOpacity onPress={() => setScreen('driver_home')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Quay lại</Text>
          </TouchableOpacity>
        </View>
        <ChatScreen
          tripId={chatParams.tripId}
          currentUserId={currentUser.id}
          receiverId={chatParams.receiverId}
          receiverName={chatParams.receiverName}
          token={token}
        />
      </SafeAreaView>
    );
  }

  // ── Màn hình Driver Home ───────────────────────────────────────────────────
  if (screen === 'driver_home' && currentUser?.role === 'driver') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Mini Grab Driver</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
        <DriverHomeScreen
          token={token}
          userId={currentUser.id}
          onOpenChat={handleOpenChat}
        />
      </SafeAreaView>
    );
  }

  // ── Màn hình Auth (login / register / profile) ────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>{labels.title}</Text>

        {/* Tab navigation */}
        <View style={styles.tabs}>
          {(['login', 'register', 'profile', 'booking', 'history'] as const).map((s) => {
            // Chỉ hiện Profile/Booking/History nếu đã đăng nhập (có token)
            // Hoặc hiện Login/Register nếu chưa đăng nhập
            const isAuthScreen = s === 'login' || s === 'register';
            const isUserScreen = s === 'profile' || s === 'booking' || s === 'history';
            
            if (!token && isUserScreen) return null;
            if (token && isAuthScreen) return null;

            return (
              <TouchableOpacity
                key={s}
                onPress={() => setScreen(s)}
                style={[styles.tabBtn, screen === s && styles.tabBtnActive]}
              >
                <Text style={[styles.tabText, screen === s && styles.tabTextActive]}>
                  {labels[s as keyof typeof labels] || s.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
          {token && currentUser?.role === 'driver' && (
            <TouchableOpacity
              onPress={() => setScreen('driver_home')}
              style={[styles.tabBtn, screen === 'driver_home' && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, screen === 'driver_home' && styles.tabTextActive]}>
                {labels.driverHome}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Language + Logout */}
        <View style={styles.languageRow}>
          <Text style={styles.langLabel}>{labels.language}:</Text>
          <View style={styles.langButtons}>
            <TouchableOpacity
              onPress={() => setLanguage('vi')}
              style={[styles.langBtn, language === 'vi' && styles.langBtnActive]}
            >
              <Text style={language === 'vi' ? styles.langBtnTextActive : styles.langBtnText}>VI</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setLanguage('en')}
              style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
            >
              <Text style={language === 'en' ? styles.langBtnTextActive : styles.langBtnText}>EN</Text>
            </TouchableOpacity>
          </View>
          {token ? (
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutBtnText}>{labels.logout}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {loading ? <ActivityIndicator size="large" color="#00af50" style={{ marginVertical: 8 }} /> : null}

        <View style={styles.content}>
          {screen === 'login' && (
            <LoginScreen language={language} onLogin={handleLogin} setLoading={setLoading} />
          )}
          {screen === 'register' && (
            <RegisterScreen language={language} setLoading={setLoading} />
          )}
          {screen === 'profile' && (
            <ProfileScreen
              language={language}
              token={token}
              setLoading={setLoading}
              onNeedLogin={() => setScreen('login')}
            />
          )}
          {screen === 'booking' && (
            <BookingScreen token={token} />
          )}
          {screen === 'history' && (
            <HistoryScreen token={token} />
          )}
          {screen === 'driver_home' && currentUser && currentUser.role === 'driver' && (
            <DriverHomeScreen token={token} userId={currentUser.id} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({
  language,
  onLogin,
  setLoading,
}: {
  language: PreferredLanguage;
  onLogin: (token: string, user: User) => void;
  setLoading: (v: boolean) => void;
}) {
  const labels = i18n[language];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Vui lòng nhập email và mật khẩu');
      return;
    }
    setLoading(true);
    try {
      const data = await requestApi<{ token: string; message: string; user: User }>(
        '/auth/login',
        language,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password }),
        },
      );
      onLogin(data.token, data.user);
    } catch (error) {
      Alert.alert('Đăng nhập thất bại', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <View style={styles.panel}>
        <Text style={styles.panelHeader}>{labels.login}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={labels.email}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder={labels.password}
        />
        <TouchableOpacity style={styles.submitBtn} onPress={submit}>
          <Text style={styles.submitBtnText}>{labels.login}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Register Screen ──────────────────────────────────────────────────────────

function RegisterScreen({
  language,
  setLoading,
}: {
  language: PreferredLanguage;
  setLoading: (v: boolean) => void;
}) {
  const labels = i18n[language];
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'driver' | 'admin'>('customer');
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>('vi');

  const submit = async () => {
    setLoading(true);
    try {
      const data = await requestApi<{ message: string }>('/auth/register', language, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, password, role, preferred_language: preferredLanguage }),
      });
      Alert.alert('Thành công', data.message);
      setPassword('');
    } catch (error) {
      Alert.alert('Đăng ký thất bại', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.panelHeader}>{labels.register}</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={labels.name} />
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder={labels.phone} keyboardType="phone-pad" />
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder={labels.email} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder={labels.password} />

      <Text style={styles.sectionLabel}>Vai trò:</Text>
      <View style={styles.inlineRow}>
        {(['customer', 'driver', 'admin'] as const).map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => setRole(r)}
            style={[styles.chipBtn, role === r && styles.chipBtnActive]}
          >
            <Text style={[styles.chipText, role === r && styles.chipTextActive]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Ngôn ngữ:</Text>
      <View style={styles.inlineRow}>
        {(['vi', 'en'] as const).map((l) => (
          <TouchableOpacity
            key={l}
            onPress={() => setPreferredLanguage(l)}
            style={[styles.chipBtn, preferredLanguage === l && styles.chipBtnActive]}
          >
            <Text style={[styles.chipText, preferredLanguage === l && styles.chipTextActive]}>{l.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.submitBtn} onPress={submit}>
        <Text style={styles.submitBtnText}>{labels.register}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────────────────

function ProfileScreen({
  language,
  token,
  setLoading,
  onNeedLogin,
}: {
  language: PreferredLanguage;
  token: string;
  setLoading: (v: boolean) => void;
  onNeedLogin: () => void;
}) {
  const labels = i18n[language];
  const [profile, setProfile] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>('vi');
  const [pickedImageUri, setPickedImageUri] = useState('');

  useEffect(() => {
    if (!token) { onNeedLogin(); return; }
    void loadProfile();
  }, [token]);

  const loadProfile = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await requestApi<User>('/auth/me', language, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(data);
      setName(data.name);
      setPhone(data.phone);
      setEmail(data.email);
      setPreferredLanguage(data.preferred_language);
    } catch (error) {
      Alert.alert('Lỗi', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setLoading(true);
    try {
      const data = await requestApi<User>('/auth/me', language, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, preferred_language: preferredLanguage }),
      });
      setProfile(data);
      Alert.alert('Đã lưu thành công');
    } catch (error) {
      Alert.alert('Lỗi', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedImageUri(result.assets[0].uri);
    }
  };

  const uploadAvatar = async () => {
    if (!pickedImageUri) { Alert.alert('Chưa chọn ảnh'); return; }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', {
        uri: pickedImageUri,
        name: `avatar-${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as unknown as Blob);
      const data = await requestApi<{ message: string; user: User }>('/auth/me/avatar', language, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      setProfile(data.user);
      setPickedImageUri('');
      Alert.alert('Thành công', data.message);
    } catch (error) {
      Alert.alert('Lỗi', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const avatarUrl = profile?.avatar_url ? `${API_BASE_URL}${profile.avatar_url}` : '';

  return (
    <View style={styles.panel}>
      <Text style={styles.panelHeader}>{labels.profile}</Text>
      <TouchableOpacity onPress={loadProfile} style={styles.refreshSmallBtn}>
        <Text style={styles.refreshSmallText}>{labels.refresh}</Text>
      </TouchableOpacity>

      {(avatarUrl || pickedImageUri) && (
        <Image source={{ uri: pickedImageUri || avatarUrl }} style={styles.avatar} />
      )}
      <View style={styles.inlineRow}>
        <TouchableOpacity onPress={pickAvatar} style={styles.chipBtn}>
          <Text style={styles.chipText}>{labels.pickImage}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={uploadAvatar} style={[styles.chipBtn, styles.chipBtnActive]}>
          <Text style={styles.chipTextActive}>{labels.uploadImage}</Text>
        </TouchableOpacity>
      </View>

      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={labels.name} />
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder={labels.phone} keyboardType="phone-pad" />
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder={labels.email} keyboardType="email-address" autoCapitalize="none" />

      <Text style={styles.sectionLabel}>Ngôn ngữ:</Text>
      <View style={styles.inlineRow}>
        {(['vi', 'en'] as const).map((l) => (
          <TouchableOpacity
            key={l}
            onPress={() => setPreferredLanguage(l)}
            style={[styles.chipBtn, preferredLanguage === l && styles.chipBtnActive]}
          >
            <Text style={[styles.chipText, preferredLanguage === l && styles.chipTextActive]}>{l.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.submitBtn} onPress={save}>
        <Text style={styles.submitBtnText}>{labels.save}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f4f6' },
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#00af50', marginBottom: 12 },

  // Top bar (driver screen)
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  logoutText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },

  // Chat back bar
  chatBackBar: {
    backgroundColor: '#00af50',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {},
  backBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Tabs
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  tabBtn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  tabBtnActive: { borderColor: '#00af50', backgroundColor: '#f0fdf4' },
  tabText: { color: '#6b7280', fontSize: 13 },
  tabTextActive: { color: '#00af50', fontWeight: '600' },

  // Language row
  languageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  langLabel: { color: '#6b7280', fontSize: 13 },
  langButtons: { flexDirection: 'row', gap: 6 },
  langBtn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#fff',
  },
  langBtnActive: { borderColor: '#00af50', backgroundColor: '#f0fdf4' },
  langBtnText: { color: '#6b7280', fontSize: 13 },
  langBtnTextActive: { color: '#00af50', fontWeight: '600', fontSize: 13 },
  logoutBtn: {
    marginLeft: 'auto',
    backgroundColor: '#fef2f2',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },

  content: { flex: 1 },

  // Panel
  panel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
    marginBottom: 16,
  },
  panelHeader: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },

  // Input
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
    fontSize: 15,
    color: '#111827',
  },

  // Submit button
  submitBtn: {
    backgroundColor: '#00af50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Chips
  sectionLabel: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  inlineRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chipBtn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipBtnActive: { borderColor: '#00af50', backgroundColor: '#f0fdf4' },
  chipText: { color: '#6b7280', fontSize: 13 },
  chipTextActive: { color: '#00af50', fontWeight: '600', fontSize: 13 },

  // Refresh small
  refreshSmallBtn: { alignSelf: 'flex-end' },
  refreshSmallText: { color: '#3b82f6', fontSize: 13 },

  // Avatar
  avatar: { width: 100, height: 100, borderRadius: 50, alignSelf: 'center' },
});
