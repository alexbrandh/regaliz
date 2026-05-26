'use client';

import Link from 'next/link';
import { Camera, ArrowDown } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';

export function HeroCTAs() {
  return (
    <section
      className="relative w-full bg-background"
      aria-label="Llamada a la acción del hero"
    >
      <div className="container mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-16 md:py-24 text-center">
        <p className="max-w-2xl text-base md:text-lg leading-relaxed text-muted-foreground">
          Transformá tus fotos en experiencias de realidad aumentada. Subí una
          imagen y un video, y compartí recuerdos que cobran vida cuando se ven
          a través de la cámara.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <Button size="lg" className="gap-2 text-lg px-8">
                <Camera className="h-5 w-5" />
                Comenzar Gratis
              </Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard/new">
              <Button size="lg" className="gap-2 text-lg px-8">
                <Camera className="h-5 w-5" />
                Crear Postal AR
              </Button>
            </Link>
          </SignedIn>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="gap-2 text-lg px-8"
          >
            <a href="#features">
              <ArrowDown className="h-5 w-5" />
              Cómo funciona
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
