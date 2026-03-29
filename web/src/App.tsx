import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'

type PreferredLanguage = 'vi' | 'en'

type User = {
  id: number
  name: string
  phone: string
  email: string
  role: 'customer' | 'driver' | 'admin'
  avatar_url: string | null
  preferred_language: PreferredLanguage
  created_at: string
  updated_at: string
}

type ApiEnvelope<T> = {
  data: T
}

type LoginResponse = {
  token: string
  user: User
  message: string
}

type RegisterResponse = {
  user: User
  message: string
}

type ProfileResponse = User

type LogoutResponse = {
  message: string
}

type UpdateResponse = User

type AvatarResponse = {
  message: string
  user: User
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
const TOKEN_KEY = 'grab_auth_token'
const LANGUAGE_KEY = 'grab_lang'

const messages = {
  vi: {
    appName: 'Mini Grab Auth',
    login: 'Dang nhap',
    register: 'Dang ky',
    profile: 'Ho so',
    logout: 'Dang xuat',
    noAccount: 'Chua co tai khoan?',
    hasAccount: 'Da co tai khoan?',
    goRegister: 'Tao moi',
    goLogin: 'Dang nhap ngay',
    name: 'Ho ten',
    phone: 'So dien thoai',
    email: 'Email',
    password: 'Mat khau',
    role: 'Vai tro',
    language: 'Ngon ngu',
    avatar: 'Anh dai dien',
    uploadAvatar: 'Tai anh',
    save: 'Luu thay doi',
    loading: 'Dang tai...',
    authRequired: 'Vui long dang nhap de xem profile',
  },
  en: {
    appName: 'Mini Grab Auth',
    login: 'Login',
    register: 'Register',
    profile: 'Profile',
    logout: 'Logout',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    goRegister: 'Create one',
    goLogin: 'Sign in now',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    password: 'Password',
    role: 'Role',
    language: 'Language',
    avatar: 'Avatar',
    uploadAvatar: 'Upload image',
    save: 'Save changes',
    loading: 'Loading...',
    authRequired: 'Please log in to view profile',
  },
} as const

function getStoredLanguage(): PreferredLanguage {
  const raw = localStorage.getItem(LANGUAGE_KEY)
  return raw === 'en' ? 'en' : 'vi'
}

async function requestApi<T>(
  path: string,
  options: RequestInit = {},
  language: PreferredLanguage,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Accept-Language': language,
      ...(options.headers ?? {}),
    },
  })

  const data = (await response.json()) as ApiEnvelope<T> | { message?: string }

  if (!response.ok) {
    const errorMessage = 'message' in data && data.message ? data.message : `HTTP ${response.status}`
    throw new Error(errorMessage)
  }

  return (data as ApiEnvelope<T>).data
}

function App() {
  const [language, setLanguage] = useState<PreferredLanguage>(getStoredLanguage)
  const [token, setToken] = useState<string>(localStorage.getItem(TOKEN_KEY) ?? '')

  useEffect(() => {
    localStorage.setItem(LANGUAGE_KEY, language)
  }, [language])

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
      return
    }

    localStorage.removeItem(TOKEN_KEY)
  }, [token])

  const labels = useMemo(() => messages[language], [language])

  const handleLogout = async () => {
    if (!token) {
      return
    }

    try {
      await requestApi<LogoutResponse>(
        '/auth/logout',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        language,
      )
    } catch {
      // Ignore logout API error and clear local token.
    }

    setToken('')
  }

  return (
    <BrowserRouter>
      <div className="shell">
        <header className="topbar">
          <h1>{labels.appName}</h1>
          <div className="actions">
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as PreferredLanguage)}
            >
              <option value="vi">VI</option>
              <option value="en">EN</option>
            </select>
            <nav>
              <Link to="/login">{labels.login}</Link>
              <Link to="/register">{labels.register}</Link>
              <Link to="/profile">{labels.profile}</Link>
              <button type="button" onClick={handleLogout}>
                {labels.logout}
              </button>
            </nav>
          </div>
        </header>

        <main className="content">
          <Routes>
            <Route
              path="/login"
              element={<LoginPage language={language} onLogin={setToken} token={token} />}
            />
            <Route path="/register" element={<RegisterPage language={language} />} />
            <Route
              path="/profile"
              element={
                <RequireAuth token={token} fallback={labels.authRequired}>
                  <ProfilePage language={language} token={token} />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

function LoginPage({
  language,
  onLogin,
  token,
}: {
  language: PreferredLanguage
  onLogin: (value: string) => void
  token: string
}) {
  const labels = messages[language]
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (token) {
      navigate('/profile')
    }
  }, [token, navigate])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const data = await requestApi<LoginResponse>(
        '/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        },
        language,
      )

      onLogin(data.token)
      setMessage(data.message)
      navigate('/profile')
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card">
      <h2>{labels.login}</h2>
      <form onSubmit={onSubmit}>
        <label>
          {labels.email}
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <label>
          {labels.password}
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? labels.loading : labels.login}
        </button>
      </form>
      <p>{message}</p>
      <p>
        {labels.noAccount} <Link to="/register">{labels.goRegister}</Link>
      </p>
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
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>(language)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const data = await requestApi<RegisterResponse>(
        '/auth/register',
        {
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
        },
        language,
      )

      setMessage(data.message)
      setPassword('')
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card">
      <h2>{labels.register}</h2>
      <form onSubmit={onSubmit}>
        <label>
          {labels.name}
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          {labels.phone}
          <input value={phone} onChange={(event) => setPhone(event.target.value)} required />
        </label>
        <label>
          {labels.email}
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <label>
          {labels.password}
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
          />
        </label>
        <label>
          {labels.role}
          <select value={role} onChange={(event) => setRole(event.target.value as 'customer' | 'driver' | 'admin')}>
            <option value="customer">customer</option>
            <option value="driver">driver</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <label>
          {labels.language}
          <select
            value={preferredLanguage}
            onChange={(event) => setPreferredLanguage(event.target.value as PreferredLanguage)}
          >
            <option value="vi">vi</option>
            <option value="en">en</option>
          </select>
        </label>
        <button type="submit" disabled={loading}>
          {loading ? labels.loading : labels.register}
        </button>
      </form>
      <p>{message}</p>
      <p>
        {labels.hasAccount} <Link to="/login">{labels.goLogin}</Link>
      </p>
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
      const data = await requestApi<ProfileResponse>(
        '/auth/me',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        language,
      )

      setProfile(data)
      setName(data.name)
      setPhone(data.phone)
      setEmail(data.email)
      setPreferredLanguage(data.preferred_language)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMe()
  }, [token, language])

  const onSaveProfile = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const data = await requestApi<UpdateResponse>(
        '/auth/me',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            phone,
            email,
            preferred_language: preferredLanguage,
          }),
        },
        language,
      )

      setProfile(data)
      setMessage('OK')
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const onUploadAvatar = async () => {
    if (!avatar) {
      setMessage('Please select image first')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('avatar', avatar)

      const data = await requestApi<AvatarResponse>(
        '/auth/me/avatar',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
        language,
      )

      setProfile(data.user)
      setMessage(data.message)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const avatarUrl = profile?.avatar_url ? `${API_BASE_URL}${profile.avatar_url}` : ''

  return (
    <section className="card">
      <h2>{labels.profile}</h2>
      <button type="button" onClick={loadMe} disabled={loading}>
        {loading ? labels.loading : 'Refresh'}
      </button>

      {avatarUrl ? <img className="avatar" src={avatarUrl} alt="avatar" /> : null}

      <label>
        {labels.avatar}
        <input type="file" accept="image/*" onChange={(event) => setAvatar(event.target.files?.[0] ?? null)} />
      </label>
      <button type="button" onClick={onUploadAvatar} disabled={loading}>
        {labels.uploadAvatar}
      </button>

      <form onSubmit={onSaveProfile}>
        <label>
          {labels.name}
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          {labels.phone}
          <input value={phone} onChange={(event) => setPhone(event.target.value)} required />
        </label>
        <label>
          {labels.email}
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <label>
          {labels.language}
          <select
            value={preferredLanguage}
            onChange={(event) => setPreferredLanguage(event.target.value as PreferredLanguage)}
          >
            <option value="vi">vi</option>
            <option value="en">en</option>
          </select>
        </label>
        <button type="submit" disabled={loading}>
          {loading ? labels.loading : labels.save}
        </button>
      </form>

      <p>{message}</p>
    </section>
  )
}

function RequireAuth({
  token,
  children,
  fallback,
}: {
  token: string
  children: ReactElement
  fallback: string
}) {
  if (!token) {
    return (
      <section className="card">
        <p>{fallback}</p>
        <Link to="/login">Login</Link>
      </section>
    )
  }

  return children
}

export default App
