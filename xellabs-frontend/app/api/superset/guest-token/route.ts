import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/app/lib/session';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    
    // 1. Authentication & Authorization Check
    if (!session || !session.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // (Optional but recommended) Role validation
    // const allowedRoles = ['admin', 'lab_manager', 'analyst'];
    // if (!allowedRoles.includes(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { dashboardId } = await req.json();

    if (!dashboardId) {
      return NextResponse.json({ error: 'Dashboard ID is required' }, { status: 400 });
    }

    const supersetUrl = process.env.SUPERSET_URL;
    const username = process.env.SUPERSET_ADMIN_USERNAME;
    const password = process.env.SUPERSET_ADMIN_PASSWORD;

    if (!supersetUrl || !username || !password) {
      return NextResponse.json({ error: 'Superset configuration missing' }, { status: 500 });
    }

    // 2. Perform 4-Step Authentication Handshake to bypass strict CSRF checks
    // Step 2a: Get initial CSRF for form login
    const loginPageRes = await fetch(`${supersetUrl}/login/`, { cache: 'no-store' });
    let sessionCookie = (loginPageRes.headers.get('set-cookie') || '').split(';')[0];
    const pageHtml = await loginPageRes.text();
    const csrfMatch = pageHtml.match(/name="csrf_token" type="hidden" value="([^"]+)"/);
    const loginCsrf = csrfMatch ? csrfMatch[1] : '';

    // Step 2b: Form Login to get authenticated Session Cookie
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('csrf_token', loginCsrf);
    const loginPostRes = await fetch(`${supersetUrl}/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': sessionCookie
      },
      body: formData.toString(),
      redirect: 'manual',
      cache: 'no-store'
    });
    const setCookie = loginPostRes.headers.get('set-cookie');
    if (setCookie) {
      const newSessionMatch = setCookie.match(/superset_session=([^;]+)/);
      if (newSessionMatch) sessionCookie = `superset_session=${newSessionMatch[1]}`;
    }

    // Step 2c: Get JWT Access Token
    const jwtRes = await fetch(`${supersetUrl}/api/v1/security/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, provider: 'db' }),
      cache: 'no-store'
    });
    if (!jwtRes.ok) {
      console.error('Superset JWT login failed:', jwtRes.status);
      return NextResponse.json({ error: 'Failed to get JWT token' }, { status: jwtRes.status });
    }
    const { access_token } = await jwtRes.json();

    // Step 2d: Get valid CSRF Token using both Session Cookie and JWT
    const csrfRes = await fetch(`${supersetUrl}/api/v1/security/csrf_token/`, {
      headers: { 
        'Cookie': sessionCookie,
        'Authorization': `Bearer ${access_token}`
      },
      cache: 'no-store'
    });
    const { result: api_csrf_token } = await csrfRes.json();

    // 3. Inject User Identity and Row-Level Security
    const guestTokenPayload = {
      user: {
        username: session.username || 'guest_user',
        first_name: session.username || 'Authenticated',
        last_name: 'User',
      },
      resources: [
        {
          type: 'dashboard',
          id: dashboardId,
        },
      ],
      rls: [],
    };

    const guestTokenResponse = await fetch(`${supersetUrl}/api/v1/security/guest_token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
        'Authorization': `Bearer ${access_token}`,
        'X-CSRFToken': api_csrf_token
      },
      body: JSON.stringify(guestTokenPayload),
      cache: 'no-store'
    });

    if (!guestTokenResponse.ok) {
      const errorText = await guestTokenResponse.text();
      console.error('Superset guest token creation failed:', guestTokenResponse.status, errorText);
      return NextResponse.json({ error: 'Failed to create guest token' }, { status: guestTokenResponse.status });
    }

    const { token } = await guestTokenResponse.json();
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error generating Superset guest token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
