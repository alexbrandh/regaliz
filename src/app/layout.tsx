import type { Metadata } from "next"
import { Outfit } from "next/font/google"
import {
  ClerkProvider
} from '@clerk/nextjs'
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { clerkAppearance, clerkLocalization } from "@/lib/clerk-config"
import "./globals.css"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://regaliz.com.co';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Regaliz - Postales en Realidad Aumentada',
    template: '%s | Regaliz',
  },
  description: 'Crea postales en realidad aumentada combinando una foto y un video. Comparte recuerdos que cobran vida cuando se ven a través de la cámara.',
  applicationName: 'Regaliz',
  keywords: ['postales de realidad aumentada', 'realidad aumentada', 'fotos animadas', 'recuerdos', 'regalos', 'postales digitales'],
  authors: [{ name: 'Regaliz' }],
  manifest: '/manifest.json',
  alternates: {
    canonical: '/',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Regaliz',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'Regaliz',
    title: 'Regaliz - Postales en Realidad Aumentada',
    description: 'Crea postales de realidad aumentada mágicas combinando una foto y un video. Comparte recuerdos que cobran vida.',
    url: siteUrl,
    locale: 'es_ES',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Regaliz - Postales en Realidad Aumentada',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Regaliz - Postales en Realidad Aumentada',
    description: 'Crea postales de realidad aumentada mágicas combinando una foto y un video. Comparte recuerdos que cobran vida.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export function generateViewport() {
  return {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#F47B6B',
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      appearance={clerkAppearance}
      localization={clerkLocalization}
    >
      <html lang="es" suppressHydrationWarning>
        <head>
          <link rel="icon" href="/favicon.svg" />
          <link rel="apple-touch-icon" href="/icon-192.png" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Regaliz" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="msapplication-TileColor" content="#F47B6B" />
          <meta name="msapplication-tap-highlight" content="no" />
        </head>
        <body className={`${outfit.variable} font-sans antialiased`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}