'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { LazyMotion, domAnimation, m, useScroll, useTransform } from 'framer-motion';
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
  // Phone3D is gated behind window 'load' + requestIdleCallback so the LCP
  // element (title) paints first. See effect below.
  const [phoneReady, setPhoneReady] = useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Defer Phone3D until the browser is idle AND the user has scrolled past
  // ~10% of the hero. PSI measures FCP/LCP/TBT within the first ~5s, so
  // pushing the 2.8MB GLB + three/drei JS off that window is the biggest
  // mobile-score lever we have without touching the visual design.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (reducedMotion) return;

    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const arm = () => {
      if (cancelled) return;
      const ric =
        (window as Window & { requestIdleCallback?: typeof requestIdleCallback })
          .requestIdleCallback;
      if (ric) {
        idleHandle = ric(() => !cancelled && setPhoneReady(true), { timeout: 2500 });
      } else {
        timeoutHandle = setTimeout(() => !cancelled && setPhoneReady(true), 1500);
      }
    };

    // Fire after `load` so the LCP element + above-the-fold paint settle
    // before three.js + the GLB start downloading.
    if (document.readyState === 'complete') {
      arm();
    } else {
      window.addEventListener('load', arm, { once: true });
    }

    return () => {
      cancelled = true;
      if (idleHandle != null) {
        const cic =
          (window as Window & { cancelIdleCallback?: typeof cancelIdleCallback })
            .cancelIdleCallback;
        cic?.(idleHandle);
      }
      if (timeoutHandle) clearTimeout(timeoutHandle);
      window.removeEventListener('load', arm);
    };
  }, [reducedMotion]);

  // Title: opacity 1 → 0 and slight rise in 0.15 → 0.40 (no scale)
  const titleOpacity = useTransform(scrollYProgress, [0.15, 0.4], [1, 0]);
  const titleY = useTransform(scrollYProgress, [0.15, 0.4], ['0vh', '-15vh']);

  // Mobile: 180vh; desktop: 240vh; reduced motion: 100vh (no scroll story).
  const sectionHeight = reducedMotion ? '100vh' : isMobile ? '180vh' : '240vh';

  return (
    <LazyMotion features={domAnimation} strict>
      <section
        ref={sectionRef}
        className="relative -mt-16 w-full bg-linear-to-b from-background via-background to-muted/20"
        style={{ height: sectionHeight }}
        aria-label="Hero"
      >
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          {/* Phone canvas — fills full viewport so the zoom-out has room to breathe */}
          <div className="absolute inset-0">
            {!reducedMotion && phoneReady && (
              <Phone3D scrollProgress={scrollYProgress} isMobile={isMobile} />
            )}
            {(reducedMotion || !phoneReady) && <PhoneSkeleton />}
          </div>

          {/* Title overlay — vertically centered over the phone screen during the screen-fill phase */}
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4">
            <m.h1
              className="text-center font-bold tracking-tighter text-white text-[clamp(2rem,7vw,4.5rem)] leading-[0.95] drop-shadow-[0_2px_24px_rgba(0,0,0,0.5)]"
              style={
                reducedMotion ? undefined : { opacity: titleOpacity, y: titleY }
              }
            >
              Que tus fotos cobren vida
              <span className="bg-linear-to-r from-primary to-ring bg-clip-text text-transparent">
                .
              </span>
            </m.h1>
          </div>
        </div>
      </section>
    </LazyMotion>
  );
}
