'use client';

import Link from 'next/link';
import { Mail } from 'lucide-react';
import Image from 'next/image';

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background/50 backdrop-blur-sm">
      <div className="container pt-10 md:pt-14 pb-32 md:pb-20 px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <Image 
                src="/regaliz-isotipo.svg" 
                alt="Regaliz" 
                width={36} 
                height={36} 
                className="transition-transform group-hover:scale-105"
              />
              <Image 
                src="/regaliz-logo.svg" 
                alt="Regaliz" 
                width={95} 
                height={26} 
                className="dark:brightness-0 dark:invert"
              />
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Crea experiencias de realidad aumentada mágicas combinando tus fotos con videos.
              Comparte recuerdos que cobran vida.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Producto</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                  Panel
                </Link>
              </li>
              <li>
                <Link href="/dashboard/new" className="text-muted-foreground hover:text-foreground transition-colors">
                  Crear Postal
                </Link>
              </li>
              <li>
                <Link href="/#features" className="text-muted-foreground hover:text-foreground transition-colors">
                  Características
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Soporte</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/help" className="text-muted-foreground hover:text-foreground transition-colors">
                  Centro de Ayuda
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                  Política de Privacidad
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                  Términos de Servicio
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Contacto</h3>
            <a
              href="mailto:hola@regaliz.com.co"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="h-4 w-4" />
              hola@regaliz.com.co
            </a>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 Regaliz. Todos los derechos reservados.
            </p>
            <p className="text-sm text-muted-foreground">
              Hecho con ❤️ para crear recuerdos mágicos
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}