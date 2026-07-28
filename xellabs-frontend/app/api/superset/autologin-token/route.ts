import { NextRequest, NextResponse } from 'next/server';
import { getSession, encrypt } from '@/app/lib/session';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    
    // 1. Authentication Check (using same-site POST which sends SameSite=Strict cookies)
    if (!session || !session.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Create a short-lived token (expires in 30 seconds) containing the session data
    // We reuse the LIMS session payload structure but verify expiration quickly
    const shortLivedPayload = {
      ...session,
      expiresAt: new Date(Date.now() + 30000) // 30 seconds from now
    };
    
    const token = await encrypt(shortLivedPayload);
    
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error generating autologin token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
