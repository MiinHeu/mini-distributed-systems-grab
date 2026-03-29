import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { compare, hash } from 'bcryptjs';
import { sign, verify } from 'jsonwebtoken';
import {
  AuthUser,
  JwtPayload,
  PreferredLanguage,
  RequestUser,
  UserRole,
} from './auth.types';

type RegisterInput = {
  name?: string;
  phone?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  preferred_language?: PreferredLanguage;
};

type LoginInput = {
  email?: string;
  password?: string;
};

type PatchProfileInput = {
  name?: string;
  phone?: string;
  email?: string;
  preferred_language?: PreferredLanguage;
  avatar_url?: string;
};

@Injectable()
export class AuthService {
  private readonly revokedTokens = new Set<string>();

  constructor(private readonly database: DatabaseService) {}

  private readonly messages = {
    vi: {
      registered: 'Dang ky thanh cong',
      loggedIn: 'Dang nhap thanh cong',
      loggedOut: 'Dang xuat thanh cong',
      avatarUploaded: 'Tai anh dai dien thanh cong',
    },
    en: {
      registered: 'Register successfully',
      loggedIn: 'Login successfully',
      loggedOut: 'Logout successfully',
      avatarUploaded: 'Avatar uploaded successfully',
    },
  };

  private userSelectColumns =
    'id, name, phone, email, role, avatar_url, preferred_language, created_at, updated_at';

  resolveLanguage(languageRaw?: string | null, preferred?: PreferredLanguage): PreferredLanguage {
    if (preferred === 'vi' || preferred === 'en') {
      return preferred;
    }

    if (!languageRaw) {
      return 'vi';
    }

    const lowered = languageRaw.toLowerCase();
    if (lowered.startsWith('en')) {
      return 'en';
    }

    return 'vi';
  }

  private getJwtSecret() {
    return process.env.JWT_SECRET ?? 'dev-secret-key-change-me';
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private normalizeRole(role?: UserRole): UserRole {
    if (role === 'customer' || role === 'driver' || role === 'admin') {
      return role;
    }
    return 'customer';
  }

  private normalizePreferredLanguage(lang?: PreferredLanguage): PreferredLanguage {
    if (lang === 'en' || lang === 'vi') {
      return lang;
    }
    return 'vi';
  }

  private sanitizeUser(row: Record<string, unknown>): AuthUser {
    return {
      id: Number(row.id),
      name: String(row.name ?? ''),
      phone: String(row.phone ?? ''),
      email: String(row.email ?? ''),
      role: (row.role as UserRole) ?? 'customer',
      avatar_url: (row.avatar_url as string | null) ?? null,
      preferred_language: (row.preferred_language as PreferredLanguage) ?? 'vi',
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  async register(input: RegisterInput) {
    const name = input.name?.trim();
    const phone = input.phone?.trim();
    const email = input.email?.trim();
    const password = input.password;

    if (!name || !phone || !email || !password) {
      throw new BadRequestException('name, phone, email, password are required');
    }

    if (password.length < 6) {
      throw new BadRequestException('password must be at least 6 chars');
    }

    const normalizedEmail = this.normalizeEmail(email);
    const role = this.normalizeRole(input.role);
    const preferredLanguage = this.normalizePreferredLanguage(input.preferred_language);

    const existed = await this.database.northPrimary.query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [normalizedEmail],
    );

    if (existed.rowCount) {
      throw new ConflictException('email already exists');
    }

    const passwordHash = await hash(password, 10);

    const created = await this.database.northPrimary.query(
      `INSERT INTO users(name, phone, email, password, role, preferred_language)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${this.userSelectColumns}`,
      [name, phone, normalizedEmail, passwordHash, role, preferredLanguage],
    );

    const user = this.sanitizeUser(created.rows[0]);
    const lang = user.preferred_language;

    return {
      message: this.messages[lang].registered,
      user,
    };
  }

  async login(input: LoginInput, languageRaw?: string | null) {
    const email = input.email?.trim();
    const password = input.password;

    if (!email || !password) {
      throw new BadRequestException('email and password are required');
    }

    const normalizedEmail = this.normalizeEmail(email);

    const found = await this.database.northPrimary.query(
      `SELECT ${this.userSelectColumns}, password
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [normalizedEmail],
    );

    const row = found.rows[0];
    if (!row) {
      throw new UnauthorizedException('invalid credentials');
    }

    const passwordMatched = await compare(password, String(row.password ?? ''));
    if (!passwordMatched) {
      throw new UnauthorizedException('invalid credentials');
    }

    const user = this.sanitizeUser(row);
    const token = sign(
      {
        sub: user.id,
        role: user.role,
        email: user.email,
      },
      this.getJwtSecret(),
      { expiresIn: '7d' },
    );

    const lang = this.resolveLanguage(languageRaw, user.preferred_language);

    return {
      message: this.messages[lang].loggedIn,
      token,
      user,
    };
  }

  verifyToken(token: string): JwtPayload {
    try {
      const payload = verify(token, this.getJwtSecret());
      if (
        typeof payload === 'string' ||
        typeof payload.sub !== 'number' ||
        (payload.role !== 'customer' && payload.role !== 'driver' && payload.role !== 'admin') ||
        typeof payload.email !== 'string'
      ) {
        throw new UnauthorizedException('invalid token payload');
      }

      return {
        sub: payload.sub,
        role: payload.role,
        email: payload.email,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch {
      throw new UnauthorizedException('invalid or expired token');
    }
  }

  revokeToken(token: string) {
    this.revokedTokens.add(token);
  }

  isTokenRevoked(token: string) {
    return this.revokedTokens.has(token);
  }

  async me(requestUser: RequestUser) {
    const found = await this.database.northReplica.query(
      `SELECT ${this.userSelectColumns}
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [requestUser.userId],
    );

    const row = found.rows[0];
    if (!row) {
      throw new UnauthorizedException('user not found');
    }

    return this.sanitizeUser(row);
  }

  async patchMe(requestUser: RequestUser, input: PatchProfileInput) {
    const updates: string[] = [];
    const values: unknown[] = [];

    const pushUpdate = (column: string, value: unknown) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    if (typeof input.name === 'string' && input.name.trim()) {
      pushUpdate('name', input.name.trim());
    }

    if (typeof input.phone === 'string' && input.phone.trim()) {
      pushUpdate('phone', input.phone.trim());
    }

    if (typeof input.email === 'string' && input.email.trim()) {
      pushUpdate('email', this.normalizeEmail(input.email));
    }

    if (typeof input.avatar_url === 'string' && input.avatar_url.trim()) {
      pushUpdate('avatar_url', input.avatar_url.trim());
    }

    if (input.preferred_language === 'vi' || input.preferred_language === 'en') {
      pushUpdate('preferred_language', input.preferred_language);
    }

    if (!updates.length) {
      throw new BadRequestException('no valid field provided for update');
    }

    pushUpdate('updated_at', new Date());

    values.push(requestUser.userId);

    const query = `UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${values.length}
      RETURNING ${this.userSelectColumns}`;

    try {
      const updated = await this.database.northPrimary.query(query, values);

      if (!updated.rows[0]) {
        throw new UnauthorizedException('user not found');
      }

      return this.sanitizeUser(updated.rows[0]);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('failed to update profile');
    }
  }

  async updateAvatar(
    requestUser: RequestUser,
    avatarUrl: string,
    languageRaw?: string | null,
  ) {
    const updated = await this.database.northPrimary.query(
      `UPDATE users
       SET avatar_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING ${this.userSelectColumns}`,
      [avatarUrl, requestUser.userId],
    );

    if (!updated.rows[0]) {
      throw new UnauthorizedException('user not found');
    }

    const user = this.sanitizeUser(updated.rows[0]);
    const lang = this.resolveLanguage(languageRaw, user.preferred_language);

    return {
      message: this.messages[lang].avatarUploaded,
      user,
    };
  }

  logout(token: string, languageRaw?: string | null) {
    this.revokeToken(token);
    const lang = this.resolveLanguage(languageRaw);
    return {
      message: this.messages[lang].loggedOut,
    };
  }
}
