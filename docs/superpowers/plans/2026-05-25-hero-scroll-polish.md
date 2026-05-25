# Hero Scroll Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the existing scroll-driven hero choreography so the title cleanly fades out before the phone enters, subtitle+CTAs only appear below the settled phone (no overlap), and the CTAs are not clipped by the overlapping `HowItWorksSection`.

**Architecture:** Pure presentational changes across 3 files. No new dependencies, no logic changes to the 3D model, video texture, or scroll detection. Animation timings driven by Framer Motion `useTransform` on the existing `scrollYProgress` motion value, and `useFrame` adjustments in the R3F `PhoneModel`. Layout switches from `absolute` positioning of the CTA block to a flex-column split inside the sticky container so the subtitle+CTAs occupy a guaranteed bottom region above the next section's overlap.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Framer Motion, @react-three/fiber, Tailwind v4.

**Spec reference:** [docs/superpowers/specs/2026-05-25-hero-scroll-polish-design.md](../specs/2026-05-25-hero-scroll-polish-design.md)

**Verification:** This is visual scroll choreography — no unit tests apply. Verification is manual in browser with the running dev server, performed in Task 4. Tasks 1-3 commit as build-clean increments.

---

## File Structure

| File | Role | Action |
| ---- | ---- | ------ |
| `src/components/hero/PhoneModel.tsx` | R3F `useFrame` choreography (scale, rotation, position) | Modify |
| `src/components/hero/ScrollPhoneHero.tsx` | Section layout, motion transforms, JSX structure | Modify |
| `src/components/sections/HowItWorksSection.tsx` | Next section that overlaps the hero by `-mt-12 md:-mt-20` | Modify (add top spacer) |

---

## Task 1: Phone choreography (PhoneModel.tsx)

Update the R3F `useFrame` curve so the phone enters in `0.15 → 0.45` (was `0.10 → 0.55`), reaches final pose in `0.45 → 0.75`, sits slightly higher to leave room for subtitle+CTAs, and tilts gently during `0.75 → 0.90`.

**Files:**
- Modify: `src/components/hero/PhoneModel.tsx` (lines 89-111, the `finalScale` constant and the `useFrame` body)

- [ ] **Step 1: Replace `finalScale` and `useFrame` body**

Open [src/components/hero/PhoneModel.tsx](src/components/hero/PhoneModel.tsx) and replace lines 89-111 with:

```tsx
  // Pose final
  const finalScale = isMobile ? 0.7 : 1.0;
  const finalY = 0.4; // slightly raised to leave room below for subtitle+CTAs

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const p = scrollProgress.get();

    // Entry: 0.15 → 0.45 — phone enters and grows from 0 to 0.85 of finalScale
    const entry = smoothstep(p, 0.15, 0.45);
    // Settle: 0.45 → 0.75 — finishes growing from 0.85 to 1.0 of finalScale
    const settle = smoothstep(p, 0.45, 0.75);
    const sizeFactor = lerp(0, 0.85, entry) + lerp(0, 0.15, settle);
    const scale = sizeFactor * finalScale * canonicalScale;

    // Rotation: entry rotates from -28° to 0°; rest phase adds slight tilt
    const entryRotY = lerp(-0.49, 0, entry);
    const tiltT = smoothstep(p, 0.75, 0.9);
    const restRotX = -0.06 * tiltT;
    const restRotY = -0.08 * tiltT;

    // Position: enters from y=-1.2, settles to y=finalY
    const baseY = lerp(-1.2, finalY, entry);

    // Floating only in rest phase
    const floatAmp = smoothstep(p, 0.55, 0.8) * 0.06;
    const floatY = Math.sin(clock.getElapsedTime() * 1.5) * floatAmp;

    g.scale.setScalar(scale);
    g.rotation.x = restRotX;
    g.rotation.y = entryRotY + restRotY;
    g.position.y = baseY + floatY;
  });
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors related to `PhoneModel.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/hero/PhoneModel.tsx
git commit -m "feat(hero): adjust phone choreography ranges and add rest-phase tilt

Entry 0.15→0.45, settle 0.45→0.75, final y raised to 0.4, slight
tilt during 0.75→0.90 to match the perspective seen in Cleo's hero."
```

---

## Task 2: Hero layout + transforms (ScrollPhoneHero.tsx)

Three changes in one file:

1. Smaller title size, fade-out transform (opacity + y, no scale).
2. Restructure sticky container into a flex column: phone area on top (`flex-1`), subtitle+CTA area at the bottom (`min-h-[28vh] md:min-h-[22vh]`).
3. Subtitle+CTAs share a single `0.75 → 0.90` opacity/y/blur transform (no separate `ctaOpacity`/`ctaY`).
4. Section height: `180vh` mobile, `240vh` desktop (was `150vh` / `200vh`).

**Files:**
- Modify: `src/components/hero/ScrollPhoneHero.tsx` (whole component body)

- [ ] **Step 1: Replace the imports line for framer-motion**

Find line 6:

```tsx
import { motion, useScroll, useTransform } from 'framer-motion';
```

Replace with:

```tsx
import { motion, useScroll, useTransform, useMotionTemplate } from 'framer-motion';
```

- [ ] **Step 2: Replace the `ScrollPhoneHero` function body**

Replace lines 41-144 (the entire `export function ScrollPhoneHero` definition) with:

```tsx
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
```

Notes about this rewrite:

- Removed unused `titleScale` (no scale on the title), removed separate `ctaOpacity` / `ctaY`.
- Sticky container is now `flex flex-col`. The phone area (`flex-1 min-h-0`) hosts the absolute-positioned canvas and the absolutely-positioned title. The bottom block is naturally laid out (no `absolute bottom-12`) so it always reserves space inside the viewport.
- `pb-28 md:pb-32` (112-128px) keeps the CTA block clear of the `-mt-12 md:-mt-20` overlap from `HowItWorksSection`.
- Title is positioned at `top-[18vh]` to roughly center it in the upper area before fade-out.
- `pointerEvents: 'none'` on the title prevents text selection on the invisible element after fade.
- `WebkitFilter` mirrors `filter` for older Safari coverage.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors related to `ScrollPhoneHero.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/hero/ScrollPhoneHero.tsx
git commit -m "feat(hero): rework choreography — title fade-out, subtitle below phone, rest buffer

- Title: smaller (clamp 2rem-4.5rem), opacity 1→0 in 0.15→0.40, removed scale
- Subtitle+CTAs: single 0.75→0.90 fade with motion blur, positioned in
  dedicated bottom flex region (no longer absolute bottom-12)
- Section height: 240vh desktop / 180vh mobile, with 0.90→1.00 rest buffer
- pb-28 md:pb-32 keeps CTAs clear of HowItWorksSection's -mt-20 overlap"
```

---

## Task 3: Top spacer in HowItWorksSection

Add a small spacer inside `HowItWorksSection` so its content starts below the natural overlap zone, protecting the hero's CTAs.

**Files:**
- Modify: `src/components/sections/HowItWorksSection.tsx` (after the opening `<section>` tag)

- [ ] **Step 1: Insert spacer**

In [src/components/sections/HowItWorksSection.tsx](src/components/sections/HowItWorksSection.tsx), find the `<section>` open tag at line 81-84:

```tsx
    <section
      ref={sectionRef}
      className="relative z-10 -mt-12 md:-mt-20 bg-card text-card-foreground rounded-t-[2.5rem] md:rounded-t-[4rem] shadow-2xl shadow-black/10"
    >
      {/* Header */}
```

Insert a spacer immediately inside the `<section>` (before the `{/* Header */}` comment):

```tsx
    <section
      ref={sectionRef}
      className="relative z-10 -mt-12 md:-mt-20 bg-card text-card-foreground rounded-t-[2.5rem] md:rounded-t-[4rem] shadow-2xl shadow-black/10"
    >
      <div className="h-12 md:h-20" aria-hidden />
      {/* Header */}
```

The spacer height matches the negative margin (`mt-12` = 48px mobile, `mt-20` = 80px desktop), so the section's content effectively starts at its natural top — leaving the hero's CTA padding fully visible above.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/HowItWorksSection.tsx
git commit -m "fix(home): add top spacer inside HowItWorksSection

Compensates the section's own -mt-12/-mt-20 negative margin so that
the hero's CTAs are not visually clipped by the rounded overlap."
```

---

## Task 4: Visual verification

This task does not commit code — it confirms the choreography behaves as designed across the scroll range and on a small viewport.

- [ ] **Step 1: Start dev server**

Run (background): `npm run dev`
Expected: server up on a local port (usually 3000).

- [ ] **Step 2: Open landing page and verify the 5 choreography phases**

Open `http://localhost:3000/` in a browser. Scroll slowly through the hero and confirm:

1. **`y=0` (initial):** title visible at the new smaller size; no phone; no subtitle/CTAs.
2. **`~25% scroll through hero`:** title is fading out (opacity around 0.3-0.5); phone is entering and growing; no subtitle yet.
3. **`~45% scroll`:** title gone (opacity 0); phone is roughly 85% of final size, continuing to grow.
4. **`~70% scroll`:** phone fully formed, centered, floating slightly; no subtitle yet.
5. **`~85% scroll`:** subtitle and CTAs fade in below the phone with the blur clearing; no overlap with the phone.
6. **`100% scroll (end of hero)`:** subtitle and CTAs fully visible and clickable; brief rest buffer before `HowItWorksSection`'s curved card begins rising.

- [ ] **Step 3: Verify no overlap and no clipping**

Same page, focus on two specific moments:

- Around `~40% scroll`: the title should be invisible (no ghost text behind the phone).
- At end-of-hero scroll (just before HowItWorks takes over): CTAs should be fully readable and not covered by the curved card's top edge. If the buttons are still clipped, increase `pb-28 md:pb-32` in `ScrollPhoneHero.tsx` to `pb-32 md:pb-40`.

- [ ] **Step 4: Mobile viewport check**

Open devtools → device toolbar → iPhone 14 Pro (or similar 390x844 viewport). Reload. Verify the same five phases work on mobile with the smaller phone scale and shorter section (`180vh`). Pay attention to:

- Title fits on one or two lines without weird wrapping.
- Phone doesn't go off-screen.
- Subtitle + CTAs stack vertically and are reachable.

- [ ] **Step 5: Reduced motion check**

In devtools rendering tab, emulate `prefers-reduced-motion: reduce`. Reload. Verify:

- Hero collapses to a single 100vh view.
- Title fully visible at the smaller size, no animation.
- `PhoneSkeleton` (blurred gradient placeholder) shown instead of the 3D phone.
- Subtitle + CTAs fully visible and interactive immediately, no fade.

- [ ] **Step 6: Stop dev server**

Stop the background `npm run dev` process.

---

## Definition of Done

- All four tasks committed.
- `npx tsc --noEmit` is clean (no new errors introduced by these changes).
- Manual browser verification in Task 4 passes on desktop, mobile viewport, and reduced motion.
- The four user-reported issues are resolved:
  - Title is smaller and fades out cleanly.
  - Subtitle no longer overlaps the phone.
  - CTAs are not clipped by `HowItWorksSection`.
  - Overall feel matches the Cleo-inspired choreography described in the spec.
