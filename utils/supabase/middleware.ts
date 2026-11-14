import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_OUTAGE_MESSAGE, isAuthOutage } from '@/lib/auth-outage'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null;
  let outage = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    user = data?.user ?? null;
    outage = !user && isAuthOutage(error);
  } catch (err) {
    console.warn('Proxy auth check failed:', err);
    user = null;
    outage = isAuthOutage(err);
  }

  const pathname = request.nextUrl.pathname

  // Pages anyone can see, logged in or not
  const isShared = pathname.startsWith('/share/');
  // Sign-in screens: signed-in users are sent on to the app
  const isEntryPage = pathname === '/' || pathname === '/login' || pathname === '/signup';
  // OAuth/email-link callback must work before a session exists
  const isAuthCallback = pathname.startsWith('/auth/');

  // Files the browser fetches before anyone signs in, and the payment provider's webhook (it has no session;
  // the route itself rejects anything without a valid signature).
  const isPublicAsset = pathname === '/sw.js' || pathname === '/manifest.webmanifest';
  const isPaymentWebhook = pathname === '/api/billing/webhook';

  if (!user && !isShared && !isEntryPage && !isAuthCallback && !isPublicAsset && !isPaymentWebhook) {
    // We could not check (connection dropped), which is not the same as signed out: do not send them to the login page.
    if (outage) {
      if (pathname.startsWith('/api/')) return NextResponse.json({ error: AUTH_OUTAGE_MESSAGE }, { status: 503 });
      return new NextResponse(
        `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reconnecting</title><body style="font-family:system-ui;padding:2rem;max-width:32rem;margin:auto"><h1>Having trouble connecting</h1><p>${AUTH_OUTAGE_MESSAGE}</p><p><a href="">Try again</a></p>`,
        { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'retry-after': '5' } }
      );
    }
    // API clients need a status code, not an HTML redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isEntryPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse
}
