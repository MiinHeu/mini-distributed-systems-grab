export type UserRole = 'customer' | 'driver' | 'admin';
export type PreferredLanguage = 'vi' | 'en';

export type AuthUser = {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  preferred_language: PreferredLanguage;
  created_at: string;
  updated_at: string;
};

export type JwtPayload = {
  sub: number;
  role: UserRole;
  email: string;
  iat?: number;
  exp?: number;
};

export type RequestUser = {
  userId: number;
  role: UserRole;
  email: string;
};
