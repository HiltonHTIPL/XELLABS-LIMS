import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/app/lib/session';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const nextUrl = searchParams.get('next') || 'http://localhost:8088/superset/welcome/';

    if (!token) {
      console.error('Autologin redirect rejected: No token provided');
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // 1. Verify and decrypt the short-lived token
    const decrypted = await decrypt(token);
    
    if (!decrypted) {
      console.error('Autologin redirect rejected: Invalid token');
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // 2. Check if the token has expired
    const expiresAt = new Date(decrypted.expiresAt);
    if (expiresAt.getTime() < Date.now()) {
      console.error('Autologin redirect rejected: Token expired');
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const supersetUrl = process.env.SUPERSET_URL;
    const username = process.env.SUPERSET_ADMIN_USERNAME;
    const password = process.env.SUPERSET_ADMIN_PASSWORD;

    if (!supersetUrl || !username || !password) {
      return NextResponse.json({ error: 'Superset configuration missing' }, { status: 500 });
    }

    // 3. Perform Form Login to get authenticated Session Cookie
    // Step 3a: Get initial CSRF for form login
    const loginPageRes = await fetch(`${supersetUrl}/login/`, { cache: 'no-store' });
    let sessionCookie = (loginPageRes.headers.get('set-cookie') || '').split(';')[0];
    const pageHtml = await loginPageRes.text();
    const csrfMatch = pageHtml.match(/name="csrf_token" type="hidden" value="([^"]+)"/);
    const loginCsrf = csrfMatch ? csrfMatch[1] : '';

    // Step 3b: Form Login to get authenticated Session Cookie
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

    // 4. Redirect user to Superset workspace and set the session cookie on their browser
    const response = NextResponse.redirect(nextUrl);
    
    // Set cookie on domain localhost
    response.headers.set('Set-Cookie', `${sessionCookie}; Path=/; SameSite=Lax`);
    
    return response;
  } catch (error) {
    console.error('Error in autologin redirect:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
