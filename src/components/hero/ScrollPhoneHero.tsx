'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, useScroll, useTransform, useMotionTemplate } from 'framer-motion';
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

  // Title: opacity 1 → 0 and slight rise in 0.15 → 0.40 (no scale)
  const titleOpacity = useTransform(scrollYProgress, [0.15, 0.4], [1, 0]);
  const titleY = useTransform(scrollYProgress, [0.15, 0.4], ['0vh', '-15vh']);

  // Subtitle + CTAs share one transform block — fade-in with blur 0.75 → 0.90
  const subOpacity = useTransform(scrollYProgress, [0.75, 0.9], [0, 1]);
  const subY = useTransform(scrollYProgress, [0.75, 0.9], [20, 0]);
  const subBlurPx = useTransform(scrollYProgress, [0.75, 0.9], [8, 0]);
  const subFilter = useMotionTemplate`blur(${subBlurPx}px)`;

  // Mobile: 180vh; desktop: 240vh; reduced motion: 100vh (no scroll story).
  // Desktop has 40vh / mobile 30vh of "rest buffer" mapped to 0.90 → 1.00 so
  // the CTAs sit fully visible before HowItWorksSection's -mt-20 overlap.
  const sectionHeight = reducedMotion ? '100vh' : isMobile ? '180vh' : '240vh';

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-linear-to-b from-background via-background to-muted/20"
      style={{ height: sectionHeight }}
      aria-label="Hero"
    >
      <div className="sticky top-0 flex h-screen w-full flex-col overflow-hidden">
        {/* Top region: phone canvas + overlaid title */}
        <div className="relative flex-1 min-h-0">
          <div className="absolute inset-0">
            {!reducedMotion && (
              <Phone3D scrollProgress={scrollYProgress} isMobile={isMobile} />
            )}
            {reducedMotion && <PhoneSkeleton />}
          </div>

          <motion.h1
            className="absolute inset-x-0 top-[18vh] z-10 px-4 text-center font-bold tracking-tighter text-foreground text-[clamp(2rem,7vw,4.5rem)] leading-[0.95]"
            style={
              reducedMotion
                ? undefined
                : { opacity: titleOpacity, y: titleY, pointerEvents: 'none' }
            }
          >
            Que tus fotos cobren vida
            <span className="bg-linear-to-r from-primary to-ring bg-clip-text text-transparent">
              .
            </span>
          </motion.h1>
        </div>

        {/* Bottom region: subtitle + CTAs, guaranteed space above HowItWorks overlap */}
        <motion.div
          className="relative z-10 flex flex-col items-center gap-5 px-4 pb-28 md:pb-32"
          style={
            reducedMotion
              ? undefined
              : {
                  opacity: subOpacity,
                  y: subY,
                  filter: subFilter,
                  WebkitFilter: subFilter,
                }
          }
        >
          <p className="max-w-2xl text-center text-base md:text-lg leading-relaxed text-muted-foreground">
            Transformá tus fotos en experiencias de realidad aumentada. Subí una
            imagen y un video, y compartí recuerdos que cobran vida cuando se
            ven a través de la cámara.
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
        </motion.div>
      </div>
    </section>
  );
}
