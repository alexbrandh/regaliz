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
