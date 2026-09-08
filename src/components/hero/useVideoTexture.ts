import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

type Options = {
  src: string;
  autoplay?: boolean; // si false, hay que llamar play() manualmente
};

export function useVideoTexture({ src, autoplay = true }: Options) {
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

  /* eslint-disable react-hooks/immutability --
   * This effect mutates `video`, which comes from useMemo, so the rule is
   * right on principle: a <video> is mutable by nature and belongs in a ref,
   * not a memo. Deliberately not refactored here. This hook is what finally
   * got the 3D hero rendering on iOS Safari (see the cleanup note below), the
   * failure mode is a silently blank hero, and it cannot be re-verified
   * without a real device. Move the element to a ref when the hero is ported,
   * with a phone on hand to test it. */
  useEffect(() => {
    if (!video) return;
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
  /* eslint-enable react-hooks/immutability */

  return {
    texture,
    play: () => void video?.play().catch(() => {}),
    pause: () => video?.pause(),
  };
}
