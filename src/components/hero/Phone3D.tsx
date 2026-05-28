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
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ background: 'transparent' }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener(
          'webglcontextlost',
          (e) => e.preventDefault(),
          false
        );
      }}
    >
      <PerspectiveCamera
        makeDefault
        position={[0, 0, 7]}
        fov={isMobile ? 38 : 28}
      />
      <ambientLight intensity={isMobile ? 0.9 : 0.6} />
      <directionalLight position={[3, 4, 5]} intensity={isMobile ? 1.6 : 1.2} />
      {/* Skip the ~1MB HDR on mobile — bezel reflections are barely visible at
          mobile scale and the bulk of the visual is the video on the screen.
          Bump ambient + directional intensity to compensate for the missing IBL. */}
      {!isMobile && <Environment preset="city" />}
      <PhoneModel scrollProgress={scrollProgress} isMobile={isMobile} />
    </Canvas>
  );
}
