import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/server/utils/auth';

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
