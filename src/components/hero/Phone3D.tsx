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
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} />
      <Environment preset="city" />
      <PhoneModel scrollProgress={scrollProgress} isMobile={isMobile} />
    </Canvas>
  );
}
