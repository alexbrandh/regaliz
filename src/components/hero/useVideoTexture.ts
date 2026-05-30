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
    // Don't preload the bytes — let play() trigger the fetch when the phone
    // actually enters the viewport. Keeps hero.mp4 (~1MB) off the LCP path.
    v.preload = 'none';
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
    // Re-assert the source in case a previous cleanup — or React StrictMode's
    // mount→unmount→mount in dev — left the memoized <video> without one.
    if (!video.getAttribute('src')) {
      video.src = src;
    }
    if (autoplay) {
      void video.play().catch(() => {
        // autoplay bloqueado — el caller puede reintentar con play()
      });
    }
    // Only pause on cleanup. Stripping the src here (removeAttribute + load)
    // broke the texture under StrictMode's double-invoke: the memoized video
    // remounted with no source and never loaded, leaving a blank screen.
    return () => {
      video.pause();
    };
  }, [video, autoplay, src]);

  return {
    texture,
    play: () => void video?.play().catch(() => {}),
    pause: () => video?.pause(),
  };
}
