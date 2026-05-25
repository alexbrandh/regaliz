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
