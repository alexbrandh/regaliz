'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { Camera, Zap, Share2, type LucideIcon } from 'lucide-react';

type Step = {
  number: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  titleAccent: string;
  description: string;
  video: string;
  poster: string;
  screenBg: string;
  iconColor: string;
};

const steps: Step[] = [
  {
    number: '01',
    icon: Camera,
    eyebrow: 'Paso 01',
    title: 'Sube tu',
    titleAccent: 'contenido.',
    description:
      'Elige una foto como objetivo AR y sube un video que se reproducirá cuando alguien la escanee con su cámara.',
    video: '/videos/how-it-works-step-1.mp4',
    poster: '/videos/how-it-works-step-1.jpg',
    screenBg:
      'linear-gradient(180deg, oklch(0.95 0.04 25) 0%, oklch(0.82 0.10 25) 100%)',
    iconColor: 'oklch(0.72 0.14 25)',
  },
  {
    number: '02',
    icon: Zap,
    eyebrow: 'Paso 02',
    title: 'La IA hace',
    titleAccent: 'la magia.',
    description:
      'Nuestra inteligencia artificial genera marcadores de seguimiento AR desde tu foto para un reconocimiento perfecto.',
    video: '/videos/how-it-works-step-2.mp4',
    poster: '/videos/how-it-works-step-2.jpg',
    screenBg:
      'linear-gradient(180deg, oklch(0.92 0.05 295) 0%, oklch(0.55 0.12 295) 100%)',
    iconColor: 'oklch(0.55 0.12 295)',
  },
  {
    number: '03',
    icon: Share2,
    eyebrow: 'Paso 03',
    title: 'Comparte y',
    titleAccent: 'vive el AR.',
    description:
      'Comparte el enlace de tu postal AR. Cualquiera puede apuntar su cámara y ver tu video cobrar vida sobre la foto.',
    video: '/videos/how-it-works-step-3.mp4',
    poster: '/videos/how-it-works-step-3.jpg',
    screenBg:
      'linear-gradient(180deg, oklch(0.93 0.04 190) 0%, oklch(0.50 0.10 220) 100%)',
    iconColor: 'oklch(0.55 0.10 220)',
  },
];

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement | null>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Three overlapping opacity tracks. Each step is fully visible for a window
  // of the scroll progress, cross-fading at the edges.
  const op1 = useTransform(scrollYProgress, [0, 0.05, 0.28, 0.36], [1, 1, 1, 0]);
  const op2 = useTransform(scrollYProgress, [0.28, 0.36, 0.62, 0.70], [0, 1, 1, 0]);
  const op3 = useTransform(scrollYProgress, [0.62, 0.70, 0.95, 1], [0, 1, 1, 1]);
  const opacities: MotionValue<number>[] = [op1, op2, op3];

  return (
    <section
      ref={sectionRef}
      className="relative z-10 -mt-12 md:-mt-20 bg-card text-card-foreground rounded-t-[2.5rem] md:rounded-t-[4rem] shadow-2xl shadow-black/10"
    >
      <div className="h-12 md:h-20" aria-hidden />
      {/* Header */}
      <div className="container mx-auto px-4 pt-24 pb-8 md:pt-32 md:pb-16 text-center">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="inline-block px-4 py-1.5 mb-6 text-sm font-semibold text-primary bg-primary/10 rounded-full"
        >
          Simple y Poderoso
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6"
        >
          Cómo Funciona
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          Crea experiencias AR impresionantes en solo{' '}
          <span className="text-primary font-semibold">3 pasos simples</span>
        </motion.p>
      </div>

      {/* Desktop: alternating columns with sticky phone in the middle */}
      <div className="hidden md:block mx-auto max-w-7xl px-6 md:px-10 pb-24">
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-8 lg:gap-16">
          {/* LEFT column: step 1, gap, step 3 */}
          <div className="relative z-10 flex flex-col">
            <TextBlock step={steps[0]} />
            <div className="h-[80svh]" />
            <TextBlock step={steps[2]} />
          </div>

          {/* CENTER column: sticky phone mockup */}
          <div className="relative">
            <div className="sticky top-0 flex h-svh items-center justify-center py-[10svh]">
              <PhoneMockup opacities={opacities} />
            </div>
          </div>

          {/* RIGHT column: gap, step 2, gap */}
          <div className="relative z-10 flex flex-col">
            <div className="h-[80svh]" />
            <TextBlock step={steps[1]} />
            <div className="h-[80svh]" />
          </div>
        </div>
      </div>

      {/* Mobile: sticky phone with overlaid fading text */}
      <div className="md:hidden relative h-[300svh]">
        <div className="sticky top-0 flex h-svh flex-col items-center justify-center gap-6 px-5 pt-4 pb-8">
          <div className="origin-center scale-[0.72] sm:scale-[0.82]">
            <PhoneMockup opacities={opacities} />
          </div>
          <div className="grid w-full max-w-md">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                style={{ opacity: opacities[i] }}
                className="col-start-1 row-start-1 px-2"
              >
                <TextBlock step={step} compact />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- subcomponents ---------- */

function TextBlock({ step, compact = false }: { step: Step; compact?: boolean }) {
  const Icon = step.icon;
  return (
    <div
      className={
        compact
          ? 'flex flex-col items-start gap-3'
          : 'flex h-[80svh] flex-col justify-center items-start gap-5'
      }
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: `color-mix(in oklch, ${step.iconColor} 15%, transparent)`,
            color: step.iconColor,
          }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {step.eyebrow}
        </span>
      </div>

      <h3
        className={
          compact
            ? 'text-2xl font-bold leading-tight tracking-tight text-foreground'
            : 'text-3xl lg:text-5xl font-bold leading-[1.05] tracking-tight text-foreground'
        }
      >
        {step.title}
        <br />
        <span className="font-serif italic font-normal" style={{ color: step.iconColor }}>
          {step.titleAccent}
        </span>
      </h3>

      <p
        className={
          compact
            ? 'text-sm text-muted-foreground leading-relaxed max-w-md'
            : 'text-base lg:text-lg text-muted-foreground leading-relaxed max-w-md'
        }
      >
        {step.description}
      </p>
    </div>
  );
}

function PhoneMockup({ opacities }: { opacities: MotionValue<number>[] }) {
  return (
    <div className="relative aspect-640/1336 w-[260px] sm:w-[280px] md:w-[300px] lg:w-[320px] drop-shadow-2xl">
      {/* Screen area — sits behind the frame. Inset and corner radius tuned
          to the iPhone frame PNG so the screen never bleeds past the device
          bezels. Inset is generous (especially horizontally) so the corner
          ellipse of the rectangle stays inside the frame's screen cutout. */}
      <div className="absolute top-[2.6%] bottom-[2.6%] left-[6%] right-[6%] overflow-hidden rounded-[11%] bg-black">
        {steps.map((step, i) => (
          <motion.div
            key={step.number}
            style={{ opacity: opacities[i] }}
            className="absolute inset-0"
          >
            <div
              className="absolute inset-0"
              style={{ background: step.screenBg }}
            />
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src={step.video}
              poster={step.poster}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
            />
          </motion.div>
        ))}
      </div>

      {/* iPhone frame on top */}
      <img
        src="/image_.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
        draggable={false}
      />
    </div>
  );
}
