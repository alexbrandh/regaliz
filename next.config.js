/** @type {import('next').NextConfig} */
const nextConfig = {
  // Type checking enforced at build time. Fix errors instead of disabling this.
  typescript: {
    ignoreBuildErrors: false,
  },
  compress: true,
  poweredByHeader: false,
  generateEtags: true,

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'react-icons',
      'framer-motion',
      '@react-three/drei',
      '@react-three/fiber',
      'sonner',
    ],
  },

  turbopack: {},

  headers: async () => {
    const isProd = process.env.NODE_ENV === 'production';
    return [
      {
        // AR viewer needs cross-origin resources (MindAR CDN, A-Frame)
        source: '/ar/(.*)',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'unsafe-none' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      // All API routes are dynamic and per-request. The blanket no-cache
      // prevents Vercel's edge from caching 404 responses that come from
      // Clerk middleware rewrites — those were sticking and serving stale
      // 404s on /api/postcards/[id] even after deploy invalidation. Routes
      // that want caching opt in via Cache-Control inside the route handler.
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      // Long-cache static assets only in production; in dev we want fresh chunks
      ...(isProd
        ? [{
            source: '/_next/static/(.*)',
            headers: [
              { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
            ],
          }]
        : []),
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'qllfquoqrxvfgdudnrrr.supabase.co',
        port: '',
        pathname: '/storage/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
