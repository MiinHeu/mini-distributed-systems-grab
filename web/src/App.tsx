import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import SystemMonitor from './SystemMonitor'
import Dashboard from './Dashboard'
import AdminUsers from './AdminUsers'
import AdminDrivers from './AdminDrivers'
import AdminPayments from './AdminPayments'
import './App.css'

type PreferredLanguage = 'vi' | 'en'
type User = { id: number; name: string; phone: string; email: string; role: 'customer' | 'driver' | 'admin'; avatar_url: string | null; preferred_language: PreferredLanguage; created_at: string; updated_at: string; }
type ApiEnvelope<T> = { data: T }

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const TOKEN_KEY = 'grab_auth_token'
const LANGUAGE_KEY = 'grab_lang'

const messages = {
  vi: {
    appName: 'Mini Grab',
    login: 'Đăng nhập',
    register: 'Đăng ký',
    profile: 'Hồ sơ',
    logout: 'Đăng xuất',
    noAccount: 'Chưa có tài khoản?',
    hasAccount: 'Đã có tài khoản?',
    goRegister: 'Tạo tài khoản',
    goLogin: 'Đăng nhập ngay',
    name: 'Họ và tên',
    phone: 'Số điện thoại',
    email: 'Email',
    password: 'Mật khẩu',
    role: 'Vai trò',
    language: 'Ngôn ngữ',
    avatar: 'Ảnh đại diện',
    uploadAvatar: 'Tải ảnh lên',
    save: 'Lưu thay đổi',
    loading: 'Đang tải...',
    authRequired: 'Vui lòng đăng nhập để xem hồ sơ',
  },
  en: {
    appName: 'Mini Grab',
    login: 'Login',
    register: 'Register',
    profile: 'Profile',
    logout: 'Logout',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    goRegister: 'Create one',
    goLogin: 'Sign in now',
    name: 'Full Name',
    phone: 'Phone Number',
    email: 'Email',
    password: 'Password',
    role: 'Role',
    language: 'Language',
    avatar: 'Avatar',
    uploadAvatar: 'Upload Image',
    save: 'Save Changes',
    loading: 'Loading...',
    authRequired: 'Please log in to view profile',
  },
} as const

function getStoredLanguage(): PreferredLanguage {
  const raw = localStorage.getItem(LANGUAGE_KEY)
  return raw === 'en' ? 'en' : 'vi'
}

export let setGlobalWarning: (msg: string | null) => void = () => {}

async function requestApi<T>(path: string, options: RequestInit = {}, language: PreferredLanguage): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    ...options,
    headers: {
      'Accept-Language': language,
      ...(options.headers ?? {}),
    },
  })
  
  let data: any
  try {
    data = await response.json()
  } catch {
    throw new Error('Không thể đọc dữ liệu từ máy chủ (Invalid JSON)')
  }

  // Cập nhật cảnh báo hệ thống từ envelope (nếu có)
  if (data && typeof data === 'object') {
    const warning = data.warning || data.message?.warning
    if (warning) setGlobalWarning(warning)
  }

  if (!response.ok) {
    let errorMessage = 'Lỗi hệ thống'
    if (typeof data?.message === 'string') {
      errorMessage = data.message
    } else if (typeof data?.message === 'object' && data.message.warning) {
      errorMessage = data.message.warning
    } else if (data?.error) {
      errorMessage = data.error
    }
    throw new Error(errorMessage)
  }
  
  // Backend wrap data trong field 'data' qua hàm ok()
  // Hoặc trả về trực tiếp đối tượng có field data (như getTripHistory)
  return (data?.data !== undefined ? data.data : data) as T
}

function App() {
  const [language, setLanguage] = useState<PreferredLanguage>(getStoredLanguage)
  const [token, setToken] = useState<string>(localStorage.getItem(TOKEN_KEY) ?? '')
  const [user, setUser] = useState<User | null>(null)
  const [systemWarning, setSystemWarning] = useState<string | null>(null)

  setGlobalWarning = setSystemWarning

  useEffect(() => {
    localStorage.setItem(LANGUAGE_KEY, language)
  }, [language])

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
      requestApi<User>('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      }, language)
        .then(setUser)
        .catch(() => {
          setToken('')
          setUser(null)
        })
      return
    }
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [token, language])

  const labels = useMemo(() => messages[language], [language])

  const handleLogout = async () => {
    if (token) {
      try {
        await requestApi('/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }, language)
      } catch {}
    }
    setToken('')
  }

  return (
    <BrowserRouter>
      <div className="shell">
        <header className="topbar">
          <Link to="/login" className="topbar-brand">
            <div className="topbar-logo">MG</div>
            <span className="topbar-title">{labels.appName}</span>
          </Link>
          <div className="topbar-actions">
            <select value={language} onChange={e => setLanguage(e.target.value as PreferredLanguage)}>
              <option value="vi">VI</option>
              <option value="en">EN</option>
            </select>
            {user?.role === 'admin' && (
              <>
                <Link to="/admin">Admin</Link>
                <Link to="/dashboard">Dashboard</Link>
                <Link to="/monitor">Monitor</Link>
              </>
            )}
            {!token ? (
              <>
                <Link to="/login">{labels.login}</Link>
                <Link to="/register">{labels.register}</Link>
              </>
            ) : (
              <>
                <Link to="/profile">{labels.profile}</Link>
                <button type="button" onClick={handleLogout}>{labels.logout}</button>
              </>
            )}
          </div>
        </header>

        {systemWarning && (
          <div className="global-warning-banner">
            <span className="warning-icon">⚠️</span>
            <span className="warning-text">{systemWarning}</span>
            <button className="close-warning" onClick={() => setSystemWarning(null)}>×</button>
          </div>
        )}

        <main className="content">
          <Routes>
            <Route path="/login" element={<LoginPage language={language} onLogin={setToken} token={token} />} />
            <Route path="/register" element={<RegisterPage language={language} />} />
            <Route path="/profile" element={<RequireAuth token={token} fallback={labels.authRequired}><ProfilePage language={language} token={token} /></RequireAuth>} />
            <Route path="/monitor" element={<SystemMonitor />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

function LoginPage({ language, onLogin, token }: { language: PreferredLanguage; onLogin: (v: string) => void; token: string }) {
  const labels = messages[language]
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (token) navigate('/profile')
  }, [token, navigate])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const data = await requestApi<{ token: string; message: string; user: User }>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      }, language)
      onLogin(data.token)
      navigate('/profile')
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card">
      <div className="card-hero">
        <div className="card-logo">MG</div>
        <h1 className="card-title">{language === 'vi' ? 'Chào mừng trở lại!' : 'Welcome back!'}</h1>
        <p className="card-sub">{language === 'vi' ? 'Đăng nhập để tiếp tục sử dụng Mini Grab' : 'Login to continue using Mini Grab'}</p>
      </div>
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label>{labels.email}</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="email@example.com" />
        </div>
        <div className="form-group">
          <label>{labels.password}</label>
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" required placeholder="••••••••" />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? labels.loading : labels.login}
        </button>
      </form>
      {message && (
        <p style={{
          marginTop: 12,
          fontSize: 14,
          color: message.toLowerCase().includes('thành') || message.toLowerCase().includes('success') ? '#065F46' : '#991B1B',
          textAlign: 'center'
        }}>
          {message}
        </p>
      )}
      <p className="link-row">{labels.noAccount} <Link to="/register">{labels.goRegister}</Link></p>
    </section>
  )
}

function RegisterPage({ language }: { language: PreferredLanguage }) {
  const labels = messages[language]
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'customer' | 'driver' | 'admin'>('customer')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const data = await requestApi<{ message: string }>('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, password, role, preferred_language: language })
      }, language)
      setMessage(data.message)
      setPassword('')
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card">
      <h2 className="card-section-title">{labels.register}</h2>
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label>{labels.name}</label>
          <input value={name} onChange={e => setName(e.target.value)} required placeholder={language === 'vi' ? 'Nguyễn Văn A' : 'John Doe'} />
        </div>
        <div className="form-group">
          <label>{labels.phone}</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="0901234567" />
        </div>
        <div className="form-group">
          <label>{labels.email}</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="email@example.com" />
        </div>
        <div className="form-group">
          <label>{labels.password}</label>
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" required placeholder="••••••••" />
        </div>
        <div className="form-group">
          <label>{labels.role}</label>
          <div className="chip-row">
            {(['customer', 'driver'] as const).map(r => (
              <button
                key={r}
                type="button"
                className={`chip${role === r ? ' active' : ''}`}
                onClick={() => setRole(r)}
              >
                {r === 'customer' ? (language === 'vi' ? 'Khách hàng' : 'Customer') : (language === 'vi' ? 'Tài xế' : 'Driver')}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? labels.loading : labels.register}
        </button>
      </form>
      {message && (
        <p style={{
          marginTop: 12,
          fontSize: 14,
          textAlign: 'center',
          color: message.toLowerCase().includes('thành') || message.toLowerCase().includes('success') ? '#065F46' : '#991B1B'
        }}>
          {message}
        </p>
      )}
      <p className="link-row">{labels.hasAccount} <Link to="/login">{labels.goLogin}</Link></p>
    </section>
  )
}
function ProfilePage({ language, token }: { language: PreferredLanguage; token: string }) {
  const labels = messages[language]
  const [profile, setProfile] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>('vi')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const loadMe = async () => {
    setLoading(true)
    setMessage('')
    try {
      const data = await requestApi<User>('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      }, language)
      setProfile(data)
      setName(data.name)
      setPhone(data.phone)
      setEmail(data.email)
      setPreferredLanguage(data.preferred_language)
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadMe() }, [token, language])

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const data = await requestApi<User>('/auth/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, phone, email, preferred_language: preferredLanguage })
      }, language)
      setProfile(data)
      setMessage(language === 'vi' ? 'Đã lưu thành công!' : 'Saved successfully!')
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const onUploadAvatar = async () => {
    if (!avatar) {
      setMessage(language === 'vi' ? 'Vui lòng chọn ảnh trước' : 'Please select an image first')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const fd = new FormData()
      fd.append('avatar', avatar)
      const data = await requestApi<{ message: string; user: User }>('/auth/me/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      }, language)
      setProfile(data.user)
      setMessage(data.message)
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const avatarUrl = profile?.avatar_url ? API_BASE_URL + profile.avatar_url : ''

  return (
    <section className="card">
      <h2 className="card-section-title">{labels.profile}</h2>
      <button type="button" className="btn-outline" onClick={loadMe} disabled={loading} style={{ marginBottom: 16 }}>
        {loading ? labels.loading : (language === 'vi' ? 'Tải lại' : 'Reload')}
      </button>
      
      {avatarUrl && <img className="avatar" src={avatarUrl} alt="avatar" />}
      
      <div className="form-group">
        <label>{labels.avatar}</label>
        <input type="file" accept="image/*" onChange={e => setAvatar(e.target.files?.[0] ?? null)} />
        <button type="button" className="btn-outline" onClick={onUploadAvatar} disabled={loading} style={{ marginTop: 8 }}>
          {labels.uploadAvatar}
        </button>
      </div>

      <form onSubmit={onSave}>
        <div className="form-group">
          <label>{labels.name}</label>
          <input value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>{labels.phone}</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>{labels.email}</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required />
        </div>
        <div className="form-group">
          <label>{labels.language}</label>
          <select value={preferredLanguage} onChange={e => setPreferredLanguage(e.target.value as PreferredLanguage)}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? labels.loading : labels.save}
        </button>
      </form>
      
      {message && (
        <p style={{
          marginTop: 12,
          fontSize: 14,
          textAlign: 'center',
          color: message.toLowerCase().includes('thành') || message.toLowerCase().includes('success') ? '#065F46' : '#991B1B'
        }}>
          {message}
        </p>
      )}
    </section>
  )
}

function RequireAuth({ token, children, fallback }: { token: string; children: ReactElement; fallback: string }) {
  if (!token) {
    return (
      <section className="card">
        <p style={{ textAlign: 'center', color: '#6B7280', marginBottom: 16 }}>{fallback}</p>
        <Link to="/login" className="btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
          Đăng nhập
        </Link>
      </section>
    )
  }
  return children
}

function AdminDashboard() {
  const [tab, setTab] = useState<'users' | 'drivers' | 'payments'>('users')
  const tabs = [
    { id: 'users' as const, label: 'Quản lý User' },
    { id: 'drivers' as const, label: 'Quản lý Tài xế' },
    { id: 'payments' as const, label: 'Thanh toán' }
  ]
  
  return (
    <div className="admin-shell" style={{ width: 'calc(100% + 32px)', margin: '-24px -16px', minWidth: 0 }}>
      <nav className="admin-nav">
        <div className="admin-nav-brand">
          <div className="admin-nav-logo">MG</div>
          <span className="admin-nav-title">Mini Grab Admin</span>
        </div>
        {tabs.map(t => (
          <button
            key={t.id}
            className={`admin-nav-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="admin-content">
        {tab === 'users' && <AdminUsers />}
        {tab === 'drivers' && <AdminDrivers />}
        {tab === 'payments' && <AdminPayments />}
      </div>
    </div>
  )
}

export default App
