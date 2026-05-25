# Hero 3D con celular y video — diseño

**Fecha:** 2026-05-25
**Autor:** brainstorming session con el usuario
**Estado:** propuesto

## Objetivo

Reemplazar el hero actual de la home (`<AnimatedHero />`) por un hero estilo
meetcleo.com: un titular gigante centrado y un celular 3D que aparece y crece
mientras el usuario scrollea, con un video reproduciéndose dentro de la pantalla
del celular.

## Contexto y restricciones

- Stack actual: Next.js 16, React 19, Tailwind v4, Framer Motion 12.
- Componente actual a reemplazar:
  [src/components/ui/animated-hero.tsx](../../../src/components/ui/animated-hero.tsx)
  (usa `ArcGallery` con fotos animadas).
- Página que lo monta: [src/app/page.tsx](../../../src/app/page.tsx).
- Assets provistos por el usuario:
  - `phone.glb` (~2.8 MB) — modelo 3D del celular.
  - `high.mp4` (~1 MB) — video que debe reproducirse dentro de la pantalla.
- Aclaración importante: meetcleo.com **no** usa un modelo 3D en tiempo real —
  scrub-ea un video cinemático pre-renderizado (HLS de Mux) según el scroll.
  Replicar ese efecto 1:1 requeriría producción de un video propio. El usuario
  optó por la alternativa práctica: cámara 3D real en R3F con scroll-scrub,
  manteniendo el mismo "sentimiento" (scroll = avance de la cámara y aparición
  del celular).

## Comportamiento de scroll (mapeo por fases)

La sección ocupa `~200vh` de altura total. Adentro hay un contenedor `sticky
top-0 h-screen` que mantiene visible el hero mientras avanza el scroll. El
progreso (`scrollYProgress` de framer-motion `useScroll` sobre la sección, 0 → 1)
maneja todas las transformaciones:

| Progreso | Titular ("Que tus fotos cobren vida.") | Celular 3D | Subtítulo + CTAs |
|---|---|---|---|
| 0.00 – 0.10 | `scale 1`, centrado vertical, `opacity 1` | `scale 0.35`, `y -120`, `rotateY -28°`, `opacity 0.0` | ocultos |
| 0.10 – 0.55 | `scale 1 → 0.55`, `y 0 → -38vh` (sube al top), `opacity 1` | `scale 0.35 → 1.0`, `y -120 → 0`, `rotateY -28° → 0°`, `opacity 0 → 1` | ocultos |
| 0.55 – 0.80 | fijo arriba en chico | en pose final + flotación constante (`y ±6px`, 4s loop) | subtítulo `opacity 0 → 1`, `y +20 → 0` |
| 0.80 – 1.00 | fijo | flotación constante | CTAs `opacity 0 → 1`, `y +20 → 0` |

Easings: `easeInOut` para todas las interpolaciones de transformaciones; las
opacidades usan `easeOut`. La curva exacta puede afinarse en QA.

## Arquitectura de componentes

Todo nuevo bajo `src/components/hero/` para aislar la feature:

- `ScrollPhoneHero.tsx` — componente público que se importa desde `page.tsx`.
  - Maneja la sección `~200vh`, el sticky inner, el `useScroll`, las
    transformaciones del titular/subtítulo/CTAs, y monta `<Phone3D />`.
  - Texto del titular en DOM real (accesible), no dentro del canvas.
- `Phone3D.tsx` — wrapper cliente con `<Canvas>` de R3F.
  - Importado vía `next/dynamic({ ssr: false })` desde `ScrollPhoneHero` con un
    skeleton (`<PhoneSkeleton />`) mientras carga.
  - Recibe `scrollYProgress` (MotionValue) por prop y lo usa adentro para mover
    la cámara/escena.
- `PhoneModel.tsx` — `useGLTF('/models/phone.glb')`, busca el mesh de pantalla,
  le aplica el `VideoTexture`. Usa `useFrame` para suscribirse a
  `scrollYProgress` y aplicar transformaciones internas (rotación residual,
  flotación).
- `PhoneSkeleton.tsx` — placeholder mientras carga (blob con gradiente de marca
  `from-primary to-ring`, dimensiones similares al canvas).
- `useVideoTexture.ts` — hook que crea el `<video>` (autoplay muted loop
  playsInline), lo conecta a `THREE.VideoTexture`, y arranca `.play()` cuando la
  sección entra al viewport (usando `IntersectionObserver`).

### Resolución del mesh de pantalla

`useGLTF` expone `scene.traverse(...)`. Buscar mesh cuyo `name` matchee
`/^(screen|display|pantalla)/i`. Si no encuentra, en `process.env.NODE_ENV ===
'development'` loguear los nombres disponibles y caer en fallback: el mesh con
mayor área proyectada en el eje +Z local (asumiendo que el frente del cel mira
hacia +Z). Reemplazar el material por `new THREE.MeshBasicMaterial({ map:
videoTexture, toneMapped: false })`.

> Nota: si tras inspeccionar `phone.glb` el mesh de pantalla no tiene un nombre
> útil ni es trivial de detectar, durante implementación se evaluará renombrar
> el mesh en el .glb (con un script de gltf-transform o editor 3D) antes de
> persistir el asset en `public/models/`.

### Cámara y escena

- `PerspectiveCamera` (drei) en posición inicial `[0, 0, 6]`, `fov 30`.
- Lighting: `ambientLight intensity 0.6` + `directionalLight position={[3,4,5]}
  intensity 1.2`.
- Environment: drei `<Environment preset="city" />` para reflejos en el chasis.
- Canvas: `transparent` background, `dpr={[1, 2]}`, `gl={{ antialias: true,
  alpha: true }}`.

### Conexión scroll → 3D

El `MotionValue scrollYProgress` se pasa al `<Phone3D>`. Dentro de
`<PhoneModel>` se hace:

```tsx
useFrame(() => {
  const p = scrollYProgress.get(); // 0..1
  // mapear p a scale/rotation/position del grupo
  groupRef.current.scale.setScalar(lerp(0.35, 1.0, smoothstep(p, 0.10, 0.55)));
  groupRef.current.rotation.y = lerp(-0.49, 0, smoothstep(p, 0.10, 0.55));
  groupRef.current.position.y = lerp(-1.2, 0, smoothstep(p, 0.10, 0.55))
    + Math.sin(clock * 1.5) * floatAmplitude(p);
});
```

`floatAmplitude` arranca en 0 y sube a 0.06 cuando `p > 0.55` para que la
flotación solo aparezca cuando el cel está en su pose final.

## Layout y estilo visual

- Fondo: gradiente suave usando tokens existentes (`bg-linear-to-b
  from-background via-background to-muted/20`). No replicamos el cielo nuboso
  de Cleo — sería ajeno al brand.
- Titular: `text-foreground font-bold tracking-tighter
  text-[clamp(3rem,11vw,7rem)] leading-[0.95]` centrado.
  - Texto: **"Que tus fotos cobren vida."**
  - El punto final puede ir resaltado con `bg-clip-text` gradient
    `from-primary to-ring` para guiño de marca.
- Subtítulo: igual al actual.
  > "Transformá tus fotos en experiencias de realidad aumentada. Subí una
  > imagen y un video, y compartí recuerdos que cobran vida cuando se ven a
  > través de la cámara."
- CTAs: idénticos a los del hero actual (Sign-in/Sign-up + "Cómo funciona").
  Reutilizamos los componentes `<Button>` y la lógica `<SignedIn>/<SignedOut>`.

## Responsive

- **≥ md (768px+):** comportamiento descrito arriba.
- **< md (mobile):**
  - Altura total de la sección: `~150vh` en lugar de `200vh` (menos scroll en
    pantallas chicas).
  - Escala final del celular: `0.7` (el celular ocupa menos para no tapar el
    texto).
  - Cámara: `fov 38` para dar aire.
  - Titular: `text-[clamp(2.25rem,12vw,4rem)]`.

## Accesibilidad y performance

- **`prefers-reduced-motion: reduce`:** la sección no hace sticky-scroll; se
  renderiza directamente en estado final (titular chico arriba, celular en pose
  final, subtítulo + CTAs visibles). El video sigue reproduciéndose loop pero
  sin animaciones de scroll. Esto se chequea con
  `window.matchMedia('(prefers-reduced-motion: reduce)')` en un hook.
- **SSR:** `Phone3D` es `ssr: false`. El skeleton se renderiza server-side y se
  hidrata sin layout shift (mismas dimensiones).
- **Bundle:** el chunk de three + drei + r3f va lazy (~250 KB gzipped extra,
  cargado solo cuando se monta el componente).
- **Asset loading:** `useGLTF.preload('/models/phone.glb')` se llama en el
  módulo del componente para que precargue cuando R3F está listo. Video
  `preload="metadata"` hasta entrar al viewport.
- **Texto en DOM:** todo el contenido textual está en HTML real (no dibujado en
  canvas) para SEO y screen readers. El canvas tiene `aria-hidden="true"`.

## Cambios concretos al repo

### Archivos a crear

- `src/components/hero/ScrollPhoneHero.tsx`
- `src/components/hero/Phone3D.tsx`
- `src/components/hero/PhoneModel.tsx`
- `src/components/hero/PhoneSkeleton.tsx`
- `src/components/hero/useVideoTexture.ts`
- `public/models/phone.glb` (copiado desde `C:\Users\copap\Downloads\phone.glb`)
- `public/videos/hero.mp4` (copiado desde `C:\Users\copap\Downloads\high.mp4`)

### Archivos a modificar

- `src/app/page.tsx`:
  - Quitar `import { AnimatedHero } from '@/components/ui/animated-hero'`.
  - Agregar `import { ScrollPhoneHero } from '@/components/hero/ScrollPhoneHero'`.
  - Reemplazar `<AnimatedHero />` por `<ScrollPhoneHero />`.
- `package.json` + `pnpm-lock.yaml`: agregar dependencias
  `three`, `@react-three/fiber`, `@react-three/drei` y devDep `@types/three`.

### Archivos a eliminar (cleanup de código muerto)

- `src/components/ui/animated-hero.tsx` (queda huérfano tras el reemplazo).
- `src/components/ui/arc-gallery.tsx` (su único consumidor era `animated-hero`;
  verificar con grep que no hay otros imports antes de borrar).

## Riesgos y supuestos

1. **Mesh de pantalla en el .glb:** se asume que `phone.glb` tiene un mesh
   identificable como la pantalla. Si no, hay que renombrarlo o ajustarlo
   manualmente — esto se descubre en la primera iteración y se resuelve antes
   de cerrar el feature.
2. **Tamaño del .glb (2.8 MB):** mitigado con lazy loading + skeleton. En
   conexiones lentas se ve el skeleton hasta que carga, sin bloquear el resto
   de la página.
3. **Performance en dispositivos viejos:** R3F a 60fps con un solo modelo y un
   video texture es liviano, pero en mobile-low-end puede caer a 30fps. Se
   acepta como tradeoff; el fallback de `prefers-reduced-motion` cubre el peor
   caso.
4. **Política de autoplay:** el video va con `muted` + `playsInline`, lo cual
   permite autoplay en todos los browsers modernos. Sin audio.
5. **Hidration mismatch:** mitigado renderizando el skeleton con las mismas
   dimensiones server-side y client-side hasta que `Phone3D` (client-only)
   monta.

## Fuera de alcance

- No se cambia el resto de `page.tsx` (la sección "Cómo Funciona" se mantiene
  intacta).
- No se generan variantes de `phone.glb` optimizadas (draco, meshopt) en esta
  iteración — se puede agregar después si el peso molesta.
- No se construye el video cinemático tipo Cleo (cielo → campo → zoom dentro
  del celular). Eso requeriría producción separada.
