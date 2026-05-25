'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Camera, ArrowDown } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { PhoneSkeleton } from './PhoneSkeleton';

const Phone3D = dynamic(() => import('./Phone3D'), {
  ssr: false,
  loading: () => <PhoneSkeleton />,
});

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isMobile;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function ScrollPhoneHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Titular: scale 1 → 0.55, y 0 → -38vh (en 0.10 → 0.55)
  const titleScale = useTransform(scrollYProgress, [0.1, 0.55], [1, 0.55]);
  const titleY = useTransform(scrollYProgress, [0.1, 0.55], ['0vh', '-38vh']);

  // Subtítulo: opacity 0 → 1, y +20 → 0 (en 0.55 → 0.80)
  const subOpacity = useTransform(scrollYProgress, [0.55, 0.8], [0, 1]);
  const subY = useTransform(scrollYProgress, [0.55, 0.8], [20, 0]);

  // CTAs: opacity 0 → 1, y +20 → 0 (en 0.80 → 1.00)
  const ctaOpacity = useTransform(scrollYProgress, [0.8, 1], [0, 1]);
  const ctaY = useTransform(scrollYProgress, [0.8, 1], [20, 0]);

  // Mobile: 150vh; desktop: 200vh; reduced motion: 100vh (sin scroll)
  const sectionHeight = reducedMotion ? '100vh' : isMobile ? '150vh' : '200vh';

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-linear-to-b from-background via-background to-muted/20"
      style={{ height: sectionHeight }}
      aria-label="Hero"
    >
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        {/* Canvas 3D detrás */}
        <div className="absolute inset-0">
          {!reducedMotion && (
            <Phone3D scrollProgress={scrollYProgress} isMobile={isMobile} />
          )}
          {reducedMotion && <PhoneSkeleton />}
        </div>

        {/* Overlay: titular */}
        <motion.h1
          className="relative z-10 px-4 text-center font-bold tracking-tighter text-foreground text-[clamp(2.25rem,12vw,4rem)] md:text-[clamp(3rem,11vw,7rem)] leading-[0.95]"
          style={reducedMotion ? undefined : { scale: titleScale, y: titleY }}
        >
          Que tus fotos cobren vida
          <span className="bg-linear-to-r from-primary to-ring bg-clip-text text-transparent">
            .
          </span>
        </motion.h1>

        {/* Overlay: subtítulo + CTAs (debajo) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-12 z-10 flex flex-col items-center gap-6 px-4">
          <motion.p
            className="max-w-2xl text-center text-base md:text-lg leading-relaxed text-muted-foreground"
            style={
              reducedMotion ? { opacity: 1 } : { opacity: subOpacity, y: subY }
            }
          >
            Transformá tus fotos en experiencias de realidad aumentada. Subí una
            imagen y un video, y compartí recuerdos que cobran vida cuando se
            ven a través de la cámara.
          </motion.p>

          <motion.div
            className="pointer-events-auto flex flex-col sm:flex-row gap-3"
            style={
              reducedMotion ? { opacity: 1 } : { opacity: ctaOpacity, y: ctaY }
            }
          >
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
          </motion.div>
        </div>
      </div>
    </section>
  );
}
