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

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);
