---
title: Hero scroll choreography polish (Cleo-inspired)
date: 2026-05-25
status: draft
scope: src/components/hero/ScrollPhoneHero.tsx, src/components/hero/PhoneModel.tsx, src/components/sections/HowItWorksSection.tsx
---

# Hero scroll choreography polish

Refines the existing `ScrollPhoneHero` scroll-driven animation so the choreography reads more like Cleo's home page: clean separation between text and phone, no overlap, no clipping by the next section, and a smaller, more elegant title.

## Why

The current hero has four concrete UX issues:

1. **Title is too large.** `clamp(3rem, 11vw, 7rem)` dominates the viewport on desktop.
2. **Title never disappears**, only shrinks and translates up. It stays present behind/around the phone, which is visually noisy.
3. **Subtitle overlaps the phone.** Subtitle fades in between `0.55 → 0.80` while the phone is still growing, so the paragraph sits *on top of* the device screen.
4. **CTAs get covered by the next section.** CTAs are absolute-positioned at `bottom-12` of the sticky container, and `HowItWorksSection` starts immediately when the sticky unsticks, so the CTAs are clipped before the user can read them.

The reference (Cleo) solves all four with a strict phase sequence: title → fade out → phone takes over → phone settles → subtitle + CTAs appear cleanly below the phone, with a "rest" buffer before the next section enters.

## What changes

### Choreography table

Five phases, no temporal overlap between title and subtitle:

| Scroll progress | Title              | Phone                              | Subtitle + CTAs         |
| --------------- | ------------------ | ---------------------------------- | ----------------------- |
| `0.00 → 0.15`   | visible, at rest   | hidden (`scale ≈ 0`)               | hidden                  |
| `0.15 → 0.40`   | **fades out** (opacity `1 → 0`, `y: 0 → -15vh`) | enters and grows (`scale 0 → 0.85` over `0.15 → 0.45`) | hidden                  |
| `0.45 → 0.75`   | hidden             | reaches final pose (`scale 0.85 → 1.0`) + slight float | hidden                  |
| `0.75 → 0.90`   | hidden             | at rest + float + slight tilt      | **fade-in with blur** (opacity `0 → 1`, `blur 8px → 0`, `y: +20 → 0`) |
| `0.90 → 1.00`   | hidden             | at rest                            | fully visible, **rest buffer** before next section |

### Title

- New size: `clamp(2rem, 7vw, 4.5rem)` (was `clamp(3rem, 11vw, 7rem)` on desktop).
- Remove `scale` transform from the title. Drive only `opacity` and a small `y`.
- New transforms:
  - `titleOpacity = useTransform(scrollYProgress, [0.15, 0.40], [1, 0])`
  - `titleY = useTransform(scrollYProgress, [0.15, 0.40], ['0vh', '-15vh'])`
- After fade-out, set `pointerEvents: 'none'` and rely on `aria-hidden` once invisible (no interactive content in the title, but avoids ghost selection).

### Phone (PhoneModel.tsx)

- Keep current `findScreenMesh` / video texture logic untouched.
- Adjust `useFrame` transforms:
  - Entry `smoothstep(p, 0.15, 0.45)` (was `0.10, 0.55`).
  - Scale ramps `0 → 0.85 * finalScale` during entry, then `0.85 → 1.0 * finalScale` during `smoothstep(p, 0.45, 0.75)`.
  - Final `y` raised slightly from `0` to `+0.4` so there is room below the phone for subtitle+CTAs.
  - Floating amplitude unchanged (`0.06` * smoothstep(p, 0.55, 0.8)), still only active in rest phase.
- Add slight tilt at rest (kicks in over `smoothstep(p, 0.75, 0.90)`):
  - `rotation.x = -0.06 * tiltT`
  - `rotation.y = -0.08 * tiltT`
  - This matches the perspective seen in Cleo frames 7-8.

### Subtitle + CTAs

- Move the block from `absolute inset-x-0 bottom-12` to a centered position **below the phone** (still inside the sticky container, but positioned via flex column with the phone area reserving its space). Concrete layout:
  - Sticky container becomes a flex column with two stacked regions:
    1. Phone area: `flex-1 min-h-0` (occupies upper ~70% of viewport)
    2. Subtitle+CTAs area: fixed height region (~22vh on desktop, ~28vh on mobile) at the bottom, with comfortable padding
- New transforms:
  - `subOpacity = useTransform(scrollYProgress, [0.75, 0.90], [0, 1])`
  - `subY = useTransform(scrollYProgress, [0.75, 0.90], [20, 0])`
  - `subBlur = useTransform(scrollYProgress, [0.75, 0.90], [8, 0])` applied as `filter: blur(${value}px)` via a `motionValue` → string template using `useMotionTemplate`.
- CTAs share the same opacity/y/blur as the subtitle (they appear together in this phase, not staggered). This removes the previous `ctaOpacity` / `ctaY` transforms.

### Section height + rest buffer

- Desktop section height: `240vh` (was `200vh`). Mobile: `180vh` (was `150vh`). Reduced motion: unchanged at `100vh`.
- The extra `40vh` desktop / `30vh` mobile is the "rest buffer" mapping to `0.90 → 1.00` progress. During this range, no transforms change. The user has time to read the CTAs before scroll carries them into `HowItWorksSection`.

### HowItWorksSection top buffer

- Add a small spacer at the top of `HowItWorksSection` (`<div className="h-16 md:h-24" aria-hidden />`) so when the hero's sticky container ends, the next section does not abut directly against the CTAs. This protects against any minor timing mismatch on browsers with non-standard scrollbar behavior.

## Components affected

- `src/components/hero/ScrollPhoneHero.tsx` — choreography rewrite (transforms, layout, section height).
- `src/components/hero/PhoneModel.tsx` — `useFrame` adjustments (scale curve, final y, tilt at rest).
- `src/components/sections/HowItWorksSection.tsx` — add top spacer.

`Phone3D.tsx`, `useVideoTexture.ts`, `PhoneSkeleton.tsx`: no changes.

## Reduced motion

Behavior unchanged: when `prefers-reduced-motion: reduce`, the hero collapses to a single 100vh view with:

- Title fully visible (smaller size as specified above)
- `PhoneSkeleton` placeholder instead of `Phone3D`
- Subtitle and CTAs always visible (no transforms applied)

## Accessibility

- Title remains the page `<h1>`; only its visual opacity changes. Screen readers still announce it.
- Faded-out elements get `pointerEvents: 'none'` to prevent interaction with invisible content.
- CTAs reach `opacity: 1` and remain interactive during the rest buffer (no `pointer-events: none` clamp).
- Scroll-driven hero already respects reduced motion (kept).

## Testing

Visual / interaction (manual in browser, desktop + mobile viewport):

1. At scroll `y=0`: title visible at the new smaller size, no phone, no subtitle, no CTAs.
2. Scrolling through `0 → 50%` of the section: title fades to 0 by the time it reaches ~40% progress; phone visibly enters from `scale ≈ 0` and grows.
3. Around `60-70%` progress: phone fully formed and centered, no text anywhere except the persistent nav.
4. Around `80-90%` progress: subtitle and CTAs fade in *below* the phone with the blur-clear effect; no overlap with the device.
5. At end of section (`100%`): subtitle and CTAs fully visible and interactive; pause briefly during the rest buffer before `HowItWorksSection` begins entering.
6. `prefers-reduced-motion: reduce`: entire hero renders statically in 100vh; all elements visible and interactive.

## Out of scope

- Background video / clouds-to-landscape transition (Cleo's signature backdrop). Deferred — would require new assets.
- Changing the title copy or CTA labels.
- Changes to the 3D model, lighting, or video texture pipeline.
- Changes to `HowItWorksSection` beyond the top spacer.
