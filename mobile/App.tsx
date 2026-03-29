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

type Screen = 'login' | 'register' | 'profile';
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

type ApiEnvelope<T> = {
  data: T;
};

const API_BASE_URL = 'http://10.0.2.2:3000';

const i18n = {
  vi: {
    title: 'Mini Grab Auth',
    login: 'Dang nhap',
    register: 'Dang ky',
    profile: 'Ho so',
    logout: 'Dang xuat',
    name: 'Ho ten',
    phone: 'So dien thoai',
    email: 'Email',
    password: 'Mat khau',
    role: 'Vai tro',
    language: 'Ngon ngu',
    save: 'Luu',
    pickImage: 'Chon anh',
    uploadImage: 'Tai anh',
    refresh: 'Tai lai',
  },
  en: {
    title: 'Mini Grab Auth',
    login: 'Login',
    register: 'Register',
    profile: 'Profile',
    logout: 'Logout',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    password: 'Password',
    role: 'Role',
    language: 'Language',
    save: 'Save',
    pickImage: 'Pick image',
    uploadImage: 'Upload image',
    refresh: 'Refresh',
  },
} as const;

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

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [language, setLanguage] = useState<PreferredLanguage>('vi');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const labels = useMemo(() => i18n[language], [language]);

  const handleLogout = async () => {
    if (!token) {
      setScreen('login');
      return;
    }

    try {
      await requestApi<{ message: string }>('/auth/logout', language, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Ignore logout error and clear token locally.
    }

    setToken('');
    setScreen('login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>{labels.title}</Text>

        <View style={styles.tabs}>
          <TouchableOpacity onPress={() => setScreen('login')} style={styles.tabBtn}>
            <Text>{labels.login}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('register')} style={styles.tabBtn}>
            <Text>{labels.register}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('profile')} style={styles.tabBtn}>
            <Text>{labels.profile}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.languageRow}>
          <Text>{labels.language}</Text>
          <View style={styles.langButtons}>
            <Button title="VI" onPress={() => setLanguage('vi')} />
            <Button title="EN" onPress={() => setLanguage('en')} />
          </View>
          <Button title={labels.logout} onPress={handleLogout} />
        </View>

        {loading ? <ActivityIndicator size="large" /> : null}

        <ScrollView style={styles.content}>
          {screen === 'login' ? (
            <LoginScreen
              language={language}
              onLogin={(nextToken) => {
                setToken(nextToken);
                setScreen('profile');
              }}
              setLoading={setLoading}
            />
          ) : null}

          {screen === 'register' ? (
            <RegisterScreen language={language} setLoading={setLoading} />
          ) : null}

          {screen === 'profile' ? (
            <ProfileScreen
              language={language}
              token={token}
              setLoading={setLoading}
              onNeedLogin={() => setScreen('login')}
            />
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function LoginScreen({
  language,
  onLogin,
  setLoading,
}: {
  language: PreferredLanguage;
  onLogin: (token: string) => void;
  setLoading: (value: boolean) => void;
}) {
  const labels = i18n[language];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async () => {
    setLoading(true);
    try {
      const data = await requestApi<{ token: string; message: string }>('/auth/login', language, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      onLogin(data.token);
      Alert.alert(data.message);
    } catch (error) {
      Alert.alert((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.header}>{labels.login}</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder={labels.email} />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder={labels.password}
      />
      <Button title={labels.login} onPress={submit} />
    </View>
  );
}

function RegisterScreen({
  language,
  setLoading,
}: {
  language: PreferredLanguage;
  setLoading: (value: boolean) => void;
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          phone,
          email,
          password,
          role,
          preferred_language: preferredLanguage,
        }),
      });

      Alert.alert(data.message);
      setPassword('');
    } catch (error) {
      Alert.alert((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.header}>{labels.register}</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={labels.name} />
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder={labels.phone} />
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder={labels.email} />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder={labels.password}
      />
      <View style={styles.inlineRow}>
        <Button title="customer" onPress={() => setRole('customer')} />
        <Button title="driver" onPress={() => setRole('driver')} />
        <Button title="admin" onPress={() => setRole('admin')} />
      </View>
      <View style={styles.inlineRow}>
        <Button title="vi" onPress={() => setPreferredLanguage('vi')} />
        <Button title="en" onPress={() => setPreferredLanguage('en')} />
      </View>
      <Button title={labels.register} onPress={submit} />
    </View>
  );
}

function ProfileScreen({
  language,
  token,
  setLoading,
  onNeedLogin,
}: {
  language: PreferredLanguage;
  token: string;
  setLoading: (value: boolean) => void;
  onNeedLogin: () => void;
}) {
  const labels = i18n[language];
  const [profile, setProfile] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>('vi');
  const [pickedImageUri, setPickedImageUri] = useState<string>('');

  useEffect(() => {
    if (!token) {
      onNeedLogin();
      return;
    }

    void loadProfile();
  }, [token]);

  const loadProfile = async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      const data = await requestApi<User>('/auth/me', language, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setProfile(data);
      setName(data.name);
      setPhone(data.phone);
      setEmail(data.email);
      setPreferredLanguage(data.preferred_language);
    } catch (error) {
      Alert.alert((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setLoading(true);
    try {
      const data = await requestApi<User>('/auth/me', language, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          phone,
          email,
          preferred_language: preferredLanguage,
        }),
      });

      setProfile(data);
      Alert.alert('OK');
    } catch (error) {
      Alert.alert((error as Error).message);
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

    if (result.canceled || !result.assets[0]) {
      return;
    }

    setPickedImageUri(result.assets[0].uri);
  };

  const uploadAvatar = async () => {
    if (!pickedImageUri) {
      Alert.alert('Please pick an image first');
      return;
    }

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
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      setProfile(data.user);
      Alert.alert(data.message);
    } catch (error) {
      Alert.alert((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const avatarUrl = profile?.avatar_url ? `${API_BASE_URL}${profile.avatar_url}` : '';

  return (
    <View style={styles.panel}>
      <Text style={styles.header}>{labels.profile}</Text>
      <Button title={labels.refresh} onPress={loadProfile} />
      {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatar} /> : null}
      {pickedImageUri ? <Image source={{ uri: pickedImageUri }} style={styles.avatar} /> : null}
      <View style={styles.inlineRow}>
        <Button title={labels.pickImage} onPress={pickAvatar} />
        <Button title={labels.uploadImage} onPress={uploadAvatar} />
      </View>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={labels.name} />
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder={labels.phone} />
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder={labels.email} />
      <View style={styles.inlineRow}>
        <Button title="vi" onPress={() => setPreferredLanguage('vi')} />
        <Button title="en" onPress={() => setPreferredLanguage('en')} />
      </View>
      <Button title={labels.save} onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#eff5f8',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
    color: '#10283d',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  tabBtn: {
    borderWidth: 1,
    borderColor: '#8da8be',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  languageRow: {
    gap: 8,
    marginBottom: 12,
  },
  langButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  content: {
    flex: 1,
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#c4d0da',
    gap: 8,
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#b5c3d1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 8,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 999,
    alignSelf: 'center',
  },
});
