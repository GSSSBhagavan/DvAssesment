import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error('JWT_SECRET environment variable is missing or insecure (minimum 32 characters required). Authentication fails closed.');
  }
  return secret.trim();
}

export const COOKIE_NAME = 'dv_session';

export interface JwtPayload {
  candidateId: string;
  role: 'CANDIDATE' | 'ADMIN';
  email: string;
}

export function signToken(payload: JwtPayload): string {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: '4h', algorithm: 'HS256' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const secret = getJwtSecret();
    return jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: JwtPayload) {
  const token = signToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 4 * 60 * 60, // 4 hours
    path: '/'
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  });
}

export async function getSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Validates Origin header for state-changing requests as CSRF defense-in-depth.
 * Allows same-origin and safe local test origins; rejects foreign origins.
 */
export function validateOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // Non-browser / same-origin without explicit origin header
  const host = req.headers.get('host');
  try {
    const originUrl = new URL(origin);
    if (host && originUrl.host === host) return true;
    if (process.env.NODE_ENV !== 'production' && (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1')) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function requireAuth(handler: (req: Request, session: JwtPayload) => Promise<NextResponse>) {
  return async (req: Request) => {
    // CSRF defense-in-depth: Validate Origin on state-changing methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      if (!validateOrigin(req)) {
        return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
      }
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(req, session);
  };
}
