# Hero 3D Phone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el hero de la home por una sección sticky con un celular 3D (`phone.glb`) que crece, rota y se centra a medida que el usuario scrollea, reproduciendo `high.mp4` dentro de la pantalla del cel.

**Architecture:** Sección de ~200vh con un `div` interno `sticky h-screen`. `useScroll` de framer-motion produce un `MotionValue` (0→1) que controla en paralelo (a) la escala/posición del titular y subtítulo en DOM HTML, y (b) la cámara/grupo 3D dentro de un `<Canvas>` de React Three Fiber (lazy-loaded, `ssr: false`). El video MP4 se aplica como `THREE.VideoTexture` sobre el mesh de pantalla del `.glb`.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Framer Motion 12, `three`, `@react-three/fiber`, `@react-three/drei`. Verificación manual con Playwright MCP (sin test framework en el repo — TDD visual no aplica).

**Spec:** `docs/superpowers/specs/2026-05-25-hero-3d-phone-design.md`

---

## File map

**Crear:**
- `src/components/hero/ScrollPhoneHero.tsx` — sección, sticky, scroll, overlays HTML, monta `<Phone3D>` con `next/dynamic`.
- `src/components/hero/Phone3D.tsx` — `<Canvas>` R3F con cámara, luces, env; recibe `scrollYProgress` por prop.
- `src/components/hero/PhoneModel.tsx` — carga `.glb`, aplica `VideoTexture` al mesh de pantalla, anima escala/rotación/posición desde `scrollYProgress`.
- `src/components/hero/PhoneSkeleton.tsx` — placeholder mientras carga el bundle 3D.
- `src/components/hero/useVideoTexture.ts` — hook que crea `<video>` + `THREE.VideoTexture` y arranca play en inView.
- `public/models/phone.glb` — copia desde `C:\Users\copap\Downloads\phone.glb`.
- `public/videos/hero.mp4` — copia desde `C:\Users\copap\Downloads\high.mp4`.

**Modificar:**
- `src/app/page.tsx` — quitar import de `AnimatedHero`, agregar `ScrollPhoneHero`.
- `package.json` + `pnpm-lock.yaml` — agregar deps three/r3f/drei y devDep `@types/three`.

**Eliminar (cleanup):**
- `src/components/ui/animated-hero.tsx`
- `src/components/ui/arc-gallery.tsx` (tras grep confirmando que solo lo usaba `animated-hero`)

---

## Convenciones de verificación

El proyecto no tiene Jest/Vitest. Cada tarea verifica con uno de:
- **TypeScript:** `pnpm exec tsc --noEmit` debe pasar limpio.
- **Lint:** `pnpm lint` sin errores nuevos.
- **Visual:** `http://localhost:3000` cargada en el browser (el dev server ya está corriendo en el puerto 3000) + screenshot vía Playwright MCP a posiciones de scroll específicas.
- **Build:** `pnpm build` al final, para garantizar que el lazy-loading y el SSR no se rompen.

---

## Task 1: Agregar dependencias 3D y copiar assets

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (automáticamente por pnpm)
- Create: `public/models/phone.glb`, `public/videos/hero.mp4`

- [ ] **Step 1: Instalar las dependencias**

Ejecutar:
```bash
pnpm add three @react-three/fiber @react-three/drei
pnpm add -D @types/three
```

Esperado: `package.json` queda con `three`, `@react-three/fiber`, `@react-three/drei` en `dependencies` y `@types/three` en `devDependencies`. `pnpm-lock.yaml` se actualiza.

- [ ] **Step 2: Crear carpetas y copiar assets**

Ejecutar (PowerShell):
```powershell
New-Item -ItemType Directory -Force -Path public/models | Out-Null
New-Item -ItemType Directory -Force -Path public/videos | Out-Null
Copy-Item "C:\Users\copap\Downloads\phone.glb" "public/models/phone.glb"
Copy-Item "C:\Users\copap\Downloads\high.mp4"  "public/videos/hero.mp4"
```

- [ ] **Step 3: Verificar que los archivos existen**

```powershell
Get-Item public/models/phone.glb, public/videos/hero.mp4 | Select-Object Name, Length
```

Esperado: `phone.glb` ≈ 2.8 MB, `hero.mp4` ≈ 1 MB.

- [ ] **Step 4: TypeScript check sigue limpio**

```bash
pnpm exec tsc --noEmit
```

Esperado: exit 0, sin errores.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml public/models/phone.glb public/videos/hero.mp4
git commit -m "chore: add three.js stack and hero assets"
```

---

## Task 2: PhoneSkeleton (placeholder visual)

**Files:**
- Create: `src/components/hero/PhoneSkeleton.tsx`

- [ ] **Step 1: Escribir el componente**

`src/components/hero/PhoneSkeleton.tsx`:
```tsx
export function PhoneSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 grid place-items-center"
    >
      <div className="h-[60vh] w-[28vh] max-w-[260px] animate-pulse rounded-[2.5rem] bg-linear-to-br from-primary/20 to-ring/20 blur-2xl" />
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm exec tsc --noEmit
```

Esperado: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/hero/PhoneSkeleton.tsx
git commit -m "feat(hero): add PhoneSkeleton placeholder"
```

---

## Task 3: useVideoTexture hook

**Files:**
- Create: `src/components/hero/useVideoTexture.ts`

- [ ] **Step 1: Escribir el hook**

`src/components/hero/useVideoTexture.ts`:
```ts
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

type Options = {
  src: string;
  autoplay?: boolean; // si false, hay que llamar play() manualmente
};

export function useVideoTexture({ src, autoplay = true }: Options) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const video = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const v = document.createElement('video');
    v.src = src;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.crossOrigin = 'anonymous';
    v.preload = 'metadata';
    return v;
  }, [src]);

  const texture = useMemo(() => {
    if (!video) return null;
    const t = new THREE.VideoTexture(video);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  }, [video]);

  useEffect(() => {
    if (!video) return;
    videoRef.current = video;
    if (autoplay) {
      void video.play().catch(() => {
        // autoplay bloqueado — el caller puede reintentar con play()
      });
    }
    return () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [video, autoplay]);

  return {
    texture,
    play: () => void video?.play().catch(() => {}),
    pause: () => video?.pause(),
  };
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm exec tsc --noEmit
```

Esperado: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/hero/useVideoTexture.ts
git commit -m "feat(hero): add useVideoTexture hook"
```

---

## Task 4: PhoneModel (carga GLB, mapea video, anima por scroll)

**Files:**
- Create: `src/components/hero/PhoneModel.tsx`

Decisión interna: el componente recibe un `MotionValue<number>` (0–1) y lee `.get()` dentro de `useFrame`. Esto evita re-renders de React por cambios de scroll.

- [ ] **Step 1: Escribir el componente con logging de meshes en dev**

`src/components/hero/PhoneModel.tsx`:
```tsx
'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { MotionValue } from 'framer-motion';
import { useVideoTexture } from './useVideoTexture';

type Props = {
  scrollProgress: MotionValue<number>;
  isMobile: boolean;
};

const MODEL_URL = '/models/phone.glb';
const VIDEO_URL = '/videos/hero.mp4';

// Útiles
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (x: number, edge0: number, edge1: number) => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
};
const SCREEN_NAME_RE = /^(screen|display|pantalla)/i;

function findScreenMesh(scene: THREE.Object3D): THREE.Mesh | null {
  const named: THREE.Mesh[] = [];
  const allMeshes: THREE.Mesh[] = [];
  scene.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      allMeshes.push(m);
      if (SCREEN_NAME_RE.test(m.name)) named.push(m);
    }
  });
  if (named.length > 0) return named[0];
  // Fallback: mesh con mayor extensión XY (área de bbox proyectada)
  let best: THREE.Mesh | null = null;
  let bestArea = 0;
  for (const m of allMeshes) {
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox;
    if (!bb) continue;
    const area = (bb.max.x - bb.min.x) * (bb.max.y - bb.min.y);
    if (area > bestArea) {
      bestArea = area;
      best = m;
    }
  }
  return best;
}

export function PhoneModel({ scrollProgress, isMobile }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(MODEL_URL);
  const { texture } = useVideoTexture({ src: VIDEO_URL });

  // Clonar para no mutar el cache global de useGLTF
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const screen = findScreenMesh(cloned);
    if (!screen) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[PhoneModel] No mesh detected for the phone screen');
      }
      return;
    }
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.info('[PhoneModel] Screen mesh:', screen.name || '(unnamed)');
    }
    if (!texture) return;
    screen.material = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
    });
  }, [cloned, texture]);

  // Pose final
  const finalScale = isMobile ? 0.7 : 1.0;

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const p = scrollProgress.get();

    // 0.10 → 0.55: el celular crece, sube de y=-1.2 a y=0, rota de -28° a 0°
    const entry = smoothstep(p, 0.1, 0.55);
    const scale = lerp(0.35 * finalScale, finalScale, entry);
    const rotY = lerp(-0.49, 0, entry);
    const baseY = lerp(-1.2, 0, entry);

    // Flotación solo en pose final (p > 0.55)
    const floatAmp = smoothstep(p, 0.55, 0.8) * 0.06;
    const floatY = Math.sin(clock.getElapsedTime() * 1.5) * floatAmp;

    g.scale.setScalar(scale);
    g.rotation.y = rotY;
    g.position.y = baseY + floatY;
  });

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm exec tsc --noEmit
```

Esperado: exit 0. Si falla por tipos de `framer-motion` MotionValue → confirmar que `framer-motion` está instalado (lo está, v12.29.2).

- [ ] **Step 3: Commit**

```bash
git add src/components/hero/PhoneModel.tsx
git commit -m "feat(hero): add PhoneModel with scroll-driven transforms and VideoTexture"
```

---

## Task 5: Phone3D Canvas wrapper

**Files:**
- Create: `src/components/hero/Phone3D.tsx`

- [ ] **Step 1: Escribir el componente**

`src/components/hero/Phone3D.tsx`:
```tsx
'use client';

import { Canvas } from '@react-three/fiber';
import { Environment, PerspectiveCamera } from '@react-three/drei';
import type { MotionValue } from 'framer-motion';
import { PhoneModel } from './PhoneModel';

type Props = {
  scrollProgress: MotionValue<number>;
  isMobile: boolean;
};

export default function Phone3D({ scrollProgress, isMobile }: Props) {
  return (
    <Canvas
      aria-hidden="true"
      className="absolute inset-0"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <PerspectiveCamera
        makeDefault
        position={[0, 0, 6]}
        fov={isMobile ? 38 : 30}
      />
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} />
      <Environment preset="city" />
      <PhoneModel scrollProgress={scrollProgress} isMobile={isMobile} />
    </Canvas>
  );
}
```

`export default` es a propósito: facilita el `next/dynamic` posterior.

- [ ] **Step 2: TypeScript check**

```bash
pnpm exec tsc --noEmit
```

Esperado: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/hero/Phone3D.tsx
git commit -m "feat(hero): add Phone3D Canvas wrapper"
```

---

## Task 6: ScrollPhoneHero (sección + scroll + overlays)

**Files:**
- Create: `src/components/hero/ScrollPhoneHero.tsx`

- [ ] **Step 1: Escribir el componente**

`src/components/hero/ScrollPhoneHero.tsx`:
```tsx
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
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm exec tsc --noEmit
```

Esperado: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/hero/ScrollPhoneHero.tsx
git commit -m "feat(hero): add ScrollPhoneHero with sticky scroll-driven overlays"
```

---

## Task 7: Wire en `page.tsx`

**Files:**
- Modify: `src/app/page.tsx` (líneas 5 y 41)

- [ ] **Step 1: Reemplazar import**

En `src/app/page.tsx`, cambiar:
```tsx
import { AnimatedHero } from '@/components/ui/animated-hero';
```
por:
```tsx
import { ScrollPhoneHero } from '@/components/hero/ScrollPhoneHero';
```

- [ ] **Step 2: Reemplazar el uso**

En el JSX, cambiar:
```tsx
<AnimatedHero />
```
por:
```tsx
<ScrollPhoneHero />
```

- [ ] **Step 3: TypeScript + Lint check**

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Esperado: ambos exit 0. Lint puede advertir sobre el import muerto si quedó algo, corregir si aplica.

- [ ] **Step 4: Verificar visualmente en el dev server**

El dev server ya corre en `http://localhost:3000`. Usar el MCP de Playwright:

```
mcp__plugin_playwright_playwright__browser_navigate → http://localhost:3000
mcp__plugin_playwright_playwright__browser_take_screenshot → filename: hero-task7-top.jpg
```

Esperado: pantalla con el titular "Que tus fotos cobren vida." centrado, fondo de gradiente, y el celular 3D (o skeleton) detrás. Sin errores rojos en la consola del MCP (`browser_console_messages`).

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(home): swap AnimatedHero for ScrollPhoneHero"
```

---

## Task 8: Verificación de scroll con Playwright

**Files:** ninguno

Esta tarea no modifica código — confirma que las cuatro fases del scroll se comportan como dice el spec.

- [ ] **Step 1: Asegurar que el dev server compiló sin errores**

Refrescar `http://localhost:3000` y revisar consola. Si hay errores de compile, volver a la tarea que los introdujo antes de continuar.

- [ ] **Step 2: Screenshot al tope (scroll = 0)**

```
mcp__plugin_playwright_playwright__browser_navigate → http://localhost:3000
mcp__plugin_playwright_playwright__browser_evaluate → () => window.scrollTo(0, 0)
mcp__plugin_playwright_playwright__browser_take_screenshot → filename: hero-phase-0.jpg
```

Esperado: titular grande centrado, celular pequeño y rotado, subtítulo/CTAs ocultos.

- [ ] **Step 3: Screenshot a mitad de transición (≈ 30% del progreso)**

Calcular: la sección mide `200vh = 2 × window.innerHeight`. Para progreso ≈ 0.3:
```
mcp__plugin_playwright_playwright__browser_evaluate → () => window.scrollTo(0, window.innerHeight * 0.6)
mcp__plugin_playwright_playwright__browser_take_screenshot → filename: hero-phase-30.jpg
```

Esperado: titular más chico subiendo, celular creciendo, video reproduciéndose en pantalla.

- [ ] **Step 4: Screenshot en pose final (≈ 70%)**

```
mcp__plugin_playwright_playwright__browser_evaluate → () => window.scrollTo(0, window.innerHeight * 1.4)
mcp__plugin_playwright_playwright__browser_take_screenshot → filename: hero-phase-70.jpg
```

Esperado: titular chico arriba, celular en pose final centrado, subtítulo visible.

- [ ] **Step 5: Screenshot al fondo de la sección (≈ 95%)**

```
mcp__plugin_playwright_playwright__browser_evaluate → () => window.scrollTo(0, window.innerHeight * 1.9)
mcp__plugin_playwright_playwright__browser_take_screenshot → filename: hero-phase-95.jpg
```

Esperado: titular chico, celular flotando, subtítulo + CTAs visibles.

- [ ] **Step 6: Revisar consola del browser**

```
mcp__plugin_playwright_playwright__browser_console_messages
```

Esperado: log `[PhoneModel] Screen mesh: <name>`. Sin errores rojos. Si hay warning "No mesh detected for the phone screen", el `.glb` no tiene mesh con nombre matcheable — proceder al Step 7 para inspeccionar y resolver.

- [ ] **Step 7 (condicional): Inspeccionar nombres de meshes si el fallback no acertó**

Si en el screenshot la pantalla del celular **no** muestra el video (se ve negra o con el material original), abrir el `.glb` con un editor (Blender / gltf.report en https://gltf.report — subir el archivo) y anotar el nombre real del mesh de pantalla. Luego:
- Editar `src/components/hero/PhoneModel.tsx`: ampliar el regex `SCREEN_NAME_RE` para incluir ese nombre. Ejemplo: `/^(screen|display|pantalla|<nombre_real>)/i`.
- Repetir Steps 2–6.
- Commit: `fix(hero): match additional screen mesh name`.

- [ ] **Step 8: Si todo OK, no se commitea nada (es verificación pura)**

---

## Task 9: Cleanup de código muerto

**Files:**
- Delete: `src/components/ui/animated-hero.tsx`
- Delete (condicional): `src/components/ui/arc-gallery.tsx`

- [ ] **Step 1: Confirmar que no hay otros consumidores**

```bash
pnpm exec grep -r "animated-hero" src --include="*.ts" --include="*.tsx"
pnpm exec grep -r "arc-gallery"   src --include="*.ts" --include="*.tsx"
```

Esperado: solo aparecen las definiciones propias y, eventualmente, `arc-gallery` referenciado por `animated-hero`. Si aparece algún otro consumidor, **no borrar** ese archivo en esta tarea y avisar.

(Alternativa Windows si grep no está disponible: usar el Grep tool del entorno.)

- [ ] **Step 2: Borrar archivos**

```bash
git rm src/components/ui/animated-hero.tsx
git rm src/components/ui/arc-gallery.tsx
```

- [ ] **Step 3: TypeScript + build check**

```bash
pnpm exec tsc --noEmit
pnpm build
```

Esperado: ambos exit 0. Si `pnpm build` falla por algún import roto, revertir el borrado del archivo que faltaba y reabrir investigación.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove unused AnimatedHero and ArcGallery"
```

---

## Task 10: Verificación final — responsive, reduced motion, build

**Files:** ninguno (verificación)

- [ ] **Step 1: Build de producción debe pasar**

```bash
pnpm build
```

Esperado: build exitoso. Tomar nota del tamaño del bundle del primer load — el chunk de three/r3f/drei debe aparecer como chunk separado (lazy), **no** en el bundle inicial de `/`.

- [ ] **Step 2: Verificar mobile (375 × 800)**

```
mcp__plugin_playwright_playwright__browser_resize → 375, 800
mcp__plugin_playwright_playwright__browser_navigate → http://localhost:3000
mcp__plugin_playwright_playwright__browser_take_screenshot → filename: hero-mobile-top.jpg
mcp__plugin_playwright_playwright__browser_evaluate → () => window.scrollTo(0, window.innerHeight * 1.0)
mcp__plugin_playwright_playwright__browser_take_screenshot → filename: hero-mobile-mid.jpg
```

Esperado: titular `clamp(2.25rem, 12vw, 4rem)` visible, celular escala 0.7 en pose final, CTAs en columna.

- [ ] **Step 3: Verificar prefers-reduced-motion**

```
mcp__plugin_playwright_playwright__browser_resize → 1440, 900
mcp__plugin_playwright_playwright__browser_evaluate → () => { Object.defineProperty(window, 'matchMedia', { writable: true, value: (q) => ({ matches: q.includes('reduce'), media: q, addEventListener:()=>{}, removeEventListener:()=>{} }) }); location.reload(); }
```

(Alternativa: en Chrome DevTools → Rendering → Emulate CSS prefers-reduced-motion: reduce, y refrescar.)

```
mcp__plugin_playwright_playwright__browser_take_screenshot → filename: hero-reduced-motion.jpg
```

Esperado: hero ocupa una sola pantalla, titular chico arriba, skeleton (o gradiente) detrás, subtítulo + CTAs visibles. Sin scroll-sticky.

- [ ] **Step 4: Revisar consola por errores**

```
mcp__plugin_playwright_playwright__browser_console_messages
```

Esperado: cero errores. El log `[PhoneModel] Screen mesh: …` puede aparecer (es informativo).

- [ ] **Step 5: Si todo pasó, no se commitea nada nuevo**

---

## Notas para el implementador

- **Orden estricto:** las tareas dependen unas de otras (no se puede hacer Task 6 sin haber terminado 2–5). No paralelizar.
- **Commits chicos y descriptivos:** uno por tarea es ideal; si algo se complica, hacer commits intermedios con mensaje claro.
- **Si el build de Task 10 falla:** lo más probable es un import de `three` que llegó al bundle del server. Confirmar que todo lo que toca `three` está en componentes `'use client'` y que `Phone3D` se monta solo vía `next/dynamic({ ssr: false })`.
- **Si el video no se reproduce:** chequear que el navegador no está bloqueando autoplay. Llamar a `play()` después de la primera interacción del usuario es el fallback estándar; si hace falta, agregar un listener `pointerdown` sobre `window` que llame `play()` del hook.
- **El dev server ya corre** en el puerto 3000 (ver `.claude/launch.json`); no hace falta arrancarlo de nuevo.
