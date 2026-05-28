import type { Metadata } from "next"
import { Outfit } from "next/font/google"
import {
  ClerkProvider
} from '@clerk/nextjs'
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
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
      appearance={{
        variables: {
          colorPrimary: '#F47B6B',
          colorBackground: '#FAF8F5',
          colorText: '#1a1a1a',
          borderRadius: '12px',
        },
        elements: {
          card: 'shadow-xl border-0',
          headerTitle: 'text-foreground',
          headerSubtitle: 'text-muted-foreground',
          socialButtonsBlockButton: 'border border-border hover:bg-muted',
          formButtonPrimary: 'bg-primary hover:bg-primary/90',
          footerActionLink: 'text-primary hover:text-primary/80',
        },
        layout: {
          socialButtonsPlacement: 'top',
          socialButtonsVariant: 'blockButton',
        },
      }}
      localization={{
        locale: 'es-ES',
        socialButtonsBlockButton: 'Continuar con {{provider|titleize}}',
        dividerText: 'o',
        formFieldLabel__emailAddress: 'Correo electrónico',
        formFieldLabel__password: 'Contraseña',
        formFieldLabel__firstName: 'Nombre',
        formFieldLabel__lastName: 'Apellido',
        formFieldLabel__username: 'Usuario',
        formFieldLabel__confirmPassword: 'Confirmar contraseña',
        formFieldLabel__currentPassword: 'Contraseña actual',
        formFieldLabel__newPassword: 'Nueva contraseña',
        formFieldInputPlaceholder__emailAddress: 'tu@correo.com',
        formFieldInputPlaceholder__password: 'Tu contraseña',
        formFieldAction__forgotPassword: '¿Olvidaste tu contraseña?',
        formButtonPrimary: 'Continuar',
        backButton: 'Atrás',
        signIn: {
          start: {
            title: 'Iniciar sesión en Regaliz',
            subtitle: '¡Bienvenido! Por favor inicia sesión para continuar',
            actionText: '¿No tienes cuenta?',
            actionLink: 'Regístrate',
          },
          password: {
            title: 'Introduce tu contraseña',
            subtitle: 'Para continuar en Regaliz',
            actionLink: 'Usar otro método',
          },
          forgotPassword: {
            title: 'Restablecer contraseña',
            subtitle_email: 'Te enviaremos un enlace por correo',
          },
        },
        signUp: {
          start: {
            title: 'Crear cuenta en Regaliz',
            subtitle: 'Crea tu cuenta para empezar',
            actionText: '¿Ya tienes cuenta?',
            actionLink: 'Inicia sesión',
          },
        },
        userButton: {
          action__signOut: 'Cerrar sesión',
          action__manageAccount: 'Gestionar cuenta',
          action__addAccount: 'Añadir cuenta',
        },
        userProfile: {
          start: {
            headerTitle__account: 'Cuenta',
            headerTitle__security: 'Seguridad',
          },
        },
      }}
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