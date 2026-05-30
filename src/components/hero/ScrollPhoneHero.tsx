'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { LazyMotion, domAnimation, m, useScroll, useTransform } from 'framer-motion';

// While the chunk loads we keep showing the video facade (rendered below), so
// no skeleton is needed here.
const Phone3D = dynamic(() => import('./Phone3D'), {
  ssr: false,
  loading: () => null,
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
  // Phone3D loads automatically once the page settles, OR immediately on the
  // first user interaction — whichever comes first. See effect below.
  const [phoneReady, setPhoneReady] = useState(false);
  // Flips true once the WebGL phone has rendered its first frame, at which
  // point we fade out (and pause) the lightweight video facade.
  const [phoneShown, setPhoneShown] = useState(false);
  const facadeVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (phoneShown) facadeVideoRef.current?.pause();
  }, [phoneShown]);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Load the heavy WebGL phone (three.js + the GLB) ONLY on the first user
  // interaction. The lightweight facade above (poster + looping video) is the
  // at-rest hero, so a visitor who never interacts — and Lighthouse/PSI, which
  // never scrolls or points — sees the hero with NO three.js executing. That
  // keeps the ~8s of WebGL main-thread work out of the measured load (LCP, TBT,
  // Speed Index). The moment the user scrolls/touches/moves, the 3D phone loads
  // and takes over the scroll animation, fading the facade out seamlessly.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (reducedMotion) return;

    let done = false;
    const events = [
      'scroll',
      'pointerdown',
      'touchstart',
      'wheel',
      'keydown',
      'mousemove',
    ] as const;

    const fire = () => {
      if (done) return;
      done = true;
      events.forEach((e) => window.removeEventListener(e, fire));
      setPhoneReady(true);
    };

    events.forEach((e) => window.addEventListener(e, fire, { passive: true }));

    return () => {
      done = true;
      events.forEach((e) => window.removeEventListener(e, fire));
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
            {/* Lightweight facade: a 4KB poster (instant LCP) + the looping hero
                video. It shows at rest and while the heavy WebGL phone loads, so
                three.js stays off the initial/measured load (only mounts on
                interaction). Its framing matches the WebGL scroll-0 view, and it
                fades out once the 3D phone has rendered, so the hand-off is
                seamless. Reduced-motion users get just the static poster. */}
            {reducedMotion ? (
              <img
                src="/hero-poster.webp"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <>
                <video
                  ref={facadeVideoRef}
                  src="/videos/hero.mp4"
                  poster="/hero-poster.webp"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  aria-hidden="true"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                    phoneShown ? 'opacity-0' : 'opacity-100'
                  }`}
                />
                {phoneReady && (
                  <Phone3D
                    scrollProgress={scrollYProgress}
                    isMobile={isMobile}
                    onReady={() => setPhoneShown(true)}
                  />
                )}
              </>
            )}
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
