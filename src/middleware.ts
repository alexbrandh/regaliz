import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Routes whose handlers do NOT have their own auth guard.
// /api/postcards POST is wrapped in withAuth, so it's NOT here.
// /api/postcards/[id] GET is public (AR viewer) — also NOT here.
const PROTECTED_PATTERNS: RegExp[] = [
  /^\/dashboard(\/.*)?$/,
  /^\/api\/nft(\/.*)?$/,
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATTERNS.some((rx) => rx.test(pathname));
}

function isPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/icon-512.png' ||
    pathname === '/icon-192.png' ||
    pathname === '/favicon.svg' ||
    pathname === '/manifest.json'
  );
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Optional: rewrite icon endpoints when ENABLE_ICON_REWRITE=true
  if (process.env.ENABLE_ICON_REWRITE === 'true') {
    if (pathname === '/icon-512.png' || pathname === '/icons/icon-512.png') {
      return NextResponse.rewrite(new URL('/icon-192.png', req.url));
    }
  }

  if (isPublicAsset(pathname) ||
      req.headers.get('purpose') === 'prefetch' ||
      req.headers.get('x-middleware-prefetch')) {
    return NextResponse.next();
  }

  // Public: GET /api/postcards/[id] is used by the AR viewer
  if (pathname.match(/^\/api\/postcards\/[^/]+$/) && req.method === 'GET') {
    return NextResponse.next();
  }

  // Refresh the Supabase session cookie on every request that might be
  // authenticated. The returned NextResponse carries the new Set-Cookie
  // headers so subsequent server components see the fresh session.
  const { response, userId } = await updateSession(req);

  // Protect DELETE /api/postcards/[id]
  if (pathname.match(/^\/api\/postcards\/[^/]+$/) && req.method === 'DELETE') {
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  if (isProtectedPath(pathname) && !userId) {
    if (pathname.startsWith('/api/')) {
      return new Response('Unauthorized', { status: 401 });
    }
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
