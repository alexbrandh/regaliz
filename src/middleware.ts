import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Routes whose handlers do NOT have their own auth guard.
// /api/postcards POST is already wrapped in withAuth, so it's NOT here.
// /api/postcards/[id] GET is public (AR viewer) — also NOT here.
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/nft(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // Optional: rewrite icon endpoints when ENABLE_ICON_REWRITE=true
  if (process.env.ENABLE_ICON_REWRITE === 'true') {
    if (
      req.nextUrl.pathname === '/icon-512.png' ||
      req.nextUrl.pathname === '/icons/icon-512.png'
    ) {
      const url = new URL('/icon-192.png', req.url)
      return NextResponse.rewrite(url)
    }
  }

  // Skip processing for Next.js internals, prefetch requests, and static assets
  if (
    req.nextUrl.pathname.startsWith('/_next/') ||
    req.headers.get('purpose') === 'prefetch' ||
    req.headers.get('x-middleware-prefetch') ||
    req.nextUrl.pathname.startsWith('/icons/') ||
    req.nextUrl.pathname === '/icon-512.png' ||
    req.nextUrl.pathname === '/icon-192.png' ||
    req.nextUrl.pathname === '/favicon.svg' ||
    req.nextUrl.pathname === '/manifest.json'
  ) {
    return
  }

  // Permitir acceso público a GET /api/postcards/[id] para AR
  if (req.nextUrl.pathname.match(/^\/api\/postcards\/[^/]+$/) && req.method === 'GET') {
    return // Permitir acceso público
  }

  // Proteger DELETE /api/postcards/[id]
  if (req.nextUrl.pathname.match(/^\/api\/postcards\/[^/]+$/) && req.method === 'DELETE') {
    const { userId } = await auth()
    if (!userId) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  if (isProtectedRoute(req)) {
    const { userId } = await auth()
    if (!userId) {
      // Para rutas API, devolver 401 en lugar de redirigir
      if (req.nextUrl.pathname.startsWith('/api/')) {
        return new Response('Unauthorized', { status: 401 })
      }
      // Para rutas de dashboard, proteger normalmente (redirigir a login)
      await auth.protect()
    }
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}