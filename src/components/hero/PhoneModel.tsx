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
const SCREEN_NAME_RE = /^(screen|display|pantalla|glass|front)/i;

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
  // Fallback: mesh más plana con mayor extensión XY (la pantalla es plana en Z)
  let best: THREE.Mesh | null = null;
  let bestScore = 0;
  for (const m of allMeshes) {
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox;
    if (!bb) continue;
    const sx = bb.max.x - bb.min.x;
    const sy = bb.max.y - bb.min.y;
    const sz = Math.max(bb.max.z - bb.min.z, 1e-6);
    // Score = área XY / espesor Z → premia meshes finas y anchas (como pantallas)
    const score = (sx * sy) / sz;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

// Computa el tamaño máximo del modelo para normalizar a una escala canónica
function computeModelSize(scene: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  return Math.max(size.x, size.y, size.z);
}

export function PhoneModel({ scrollProgress, isMobile }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(MODEL_URL);
  const { texture } = useVideoTexture({ src: VIDEO_URL });

  // Clonar para no mutar el cache global de useGLTF
  const cloned = useMemo(() => scene.clone(true), [scene]);

  // Escala canónica: normalizar el modelo a 3 unidades de tamaño máximo
  // (ocupa cómodamente el frustum a fov 30, z=6)
  const canonicalScale = useMemo(() => {
    const maxDim = computeModelSize(cloned);
    return maxDim > 0 ? 3 / maxDim : 1;
  }, [cloned]);

  useEffect(() => {
    const screen = findScreenMesh(cloned);
    if (!screen || !texture) return;
    screen.material = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
    });
  }, [cloned, texture]);

  // Pose final and start poses
  // Compact final size — phone is centered in viewport with clear room
  // below for the subtitle+CTA block (matches the Cleo reference).
  const finalScale = isMobile ? 0.38 : 0.42;
  // startScale must be large enough that the phone's screen overflows the
  // viewport — user sees only the video content, no bezels. Desktop needs
  // a much larger factor because the viewport is landscape vs the portrait
  // screen; mobile aspect ratios are closer, so a smaller multiplier works.
  const startScale = isMobile ? 3.5 : 6.0;
  // Essentially centered (tiny upward bias) so the phone reads as the
  // visual centerpiece while still clearing the bottom CTA block.
  const finalY = isMobile ? 0.03 : 0.05;

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const p = scrollProgress.get();

    // Zoom-out: 0 → 0.65 — phone shrinks from startScale to finalScale
    const zoom = smoothstep(p, 0, 0.65);
    const sizeFactor = lerp(startScale, finalScale, zoom);
    const scale = sizeFactor * canonicalScale;

    // Rotation: faces forward during zoom; pronounced tilt once settled
    // (0.70 → 0.90) — ~-9.7° on Y and ~-4.6° on X, like the Cleo reference.
    const tiltT = smoothstep(p, 0.7, 0.9);
    const rotX = -0.08 * tiltT;
    const rotY = -0.17 * tiltT;

    // Position: stays centered while zooming out, then settles to finalY
    const baseY = lerp(0, finalY, zoom);

    // Floating only after settle
    const floatAmp = smoothstep(p, 0.7, 0.85) * 0.06;
    const floatY = Math.sin(clock.getElapsedTime() * 1.5) * floatAmp;

    g.scale.setScalar(scale);
    g.rotation.x = rotX;
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
