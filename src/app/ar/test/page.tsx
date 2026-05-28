'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Camera, Download, Volume2, VolumeX, RotateCcw, ExternalLink, Shield, Wifi } from 'lucide-react';
import { toast } from 'sonner';

// Type declarations for A-Frame elements
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    AFRAME: any;
    THREEx: any;
    eruda?: { init: () => void; destroy?: () => void };
  }
}

// Extend JSX to include A-Frame elements
/* eslint-disable @typescript-eslint/no-namespace */
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'a-scene': any;
      'a-assets': any;
      'a-nft': any;
      'a-video': any;
      'a-entity': any;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */
/* eslint-enable @typescript-eslint/no-explicit-any */

type CameraStatus = 'checking' | 'granted' | 'denied' | 'unavailable' | 'insecure_context';

interface AFrameSceneEl extends HTMLElement {
  renderer?: { dispose?: () => void; domElement?: HTMLCanvasElement | null };
  canvas?: HTMLCanvasElement | null;
}

export default function ARTestPage() {
  const [isARReady, setIsARReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('checking');
  const [isMuted, setIsMuted] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingLost, setTrackingLost] = useState(false);
  const [isInIDE, setIsInIDE] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sceneRef = useRef<HTMLElement>(null);
  const initializedRef = useRef(false);
  const [debugMode, setDebugMode] = useState(true); // Always debug for test page

  // Test postcard data using AR.js example
  const testPostcard = {
    id: 'test',
    title: 'Postal de realidad aumentada de Prueba',
    description: 'Prueba la funcionalidad de realidad aumentada con descriptores de ejemplo',
    image_url: '/images/pinball-marker.jpg',
    video_url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
    nft_descriptors: {
      descriptorUrl: 'https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.5/data/dataNFT/pinball',
      generated: true,
      timestamp: new Date().toISOString(),
      files: {
        iset: 'https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.5/data/dataNFT/pinball.iset',
        fset: 'https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.5/data/dataNFT/pinball.fset',
        fset3: 'https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.5/data/dataNFT/pinball.fset3'
      }
    }
  };

  // Enhanced camera permission and availability check
  useEffect(() => {
    const detectIDEContext = () => {
      const hostname = window.location.hostname;
      const userAgent = navigator.userAgent;
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
      const hasIDEIndicators = userAgent.includes('Chrome') && window.location.port === '3001';
      
      setIsInIDE(isLocalhost && hasIDEIndicators);
    };

    const detectMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test((userAgent || '').toLowerCase()) ||
                            (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform)) ||
                            window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
    };

    const checkCameraAvailability = async () => {
      try {
        if (!window.isSecureContext && window.location.protocol !== 'http:') {
          setCameraStatus('insecure_context');
          setError('La cámara requiere HTTPS o localhost para funcionar');
          return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraStatus('unavailable');
          setError('La API de cámara no está disponible en este navegador');
          return;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(device => device.kind === 'videoinput');
        
        if (!hasCamera) {
          setCameraStatus('unavailable');
          setError('No se detectaron cámaras disponibles');
          return;
        }

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 10000);
        });

        const streamPromise = navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 }
          } 
        });

        const stream = await Promise.race([streamPromise, timeoutPromise]) as MediaStream;
        
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack || videoTrack.readyState !== 'live') {
          throw new Error('Camera stream not active');
        }

        setCameraStatus('granted');
        stream.getTracks().forEach(track => track.stop());
        
      } catch (error) {
        console.error('Camera check error:', error);
        
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            setCameraStatus('denied');
            setError('Acceso a la cámara denegado. Por favor, permite el acceso a la cámara.');
          } else if (error.name === 'NotFoundError') {
            setCameraStatus('unavailable');
            setError('No se encontró ninguna cámara disponible.');
          } else if (error.name === 'NotSupportedError') {
            setCameraStatus('unavailable');
            setError('La cámara no es compatible con este navegador.');
          } else if (error.message === 'Timeout') {
            setCameraStatus('unavailable');
            setError('Timeout al acceder a la cámara. Puede que no esté disponible en el preview del IDE.');
          } else {
            setCameraStatus('unavailable');
            setError('Error al acceder a la cámara. Intenta abrir en un navegador externo.');
          }
        } else {
          setCameraStatus('unavailable');
          setError('Error desconocido al acceder a la cámara.');
        }
      }
    };

    detectIDEContext();
    detectMobile();
    checkCameraAvailability();
    
    const handleResize = () => {
      detectMobile();
    };
    
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load AR scripts
  const loadScripts = async () => {
    if (!window.AFRAME) {
      await new Promise((resolve, reject) => {
        const aframeScript = document.createElement('script');
        aframeScript.src = 'https://aframe.io/releases/1.4.0/aframe.min.js';
        aframeScript.async = true;
        aframeScript.crossOrigin = 'anonymous';
        
        const timeout = setTimeout(() => {
          reject(new Error('A-Frame loading timeout'));
        }, 20000);
        
        aframeScript.onload = () => {
          clearTimeout(timeout);
          console.log('✅ [AR Test] A-Frame loaded successfully');
          resolve(void 0);
        };
        
        aframeScript.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load A-Frame'));
        };
        
        document.head.appendChild(aframeScript);
      });
    }

    if (!window.THREEx) {
      await new Promise((resolve, reject) => {
        const arScript = document.createElement('script');
        arScript.src = 'https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.5/aframe/build/aframe-ar-nft.js';
        arScript.async = true;
        arScript.crossOrigin = 'anonymous';
        
        const timeout = setTimeout(() => {
          reject(new Error('AR.js loading timeout'));
        }, 20000);
        
        arScript.onload = () => {
          clearTimeout(timeout);
          console.log('✅ [AR Test] AR.js loaded successfully');
          resolve(void 0);
        };
        
        arScript.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load AR.js'));
        };
        
        document.head.appendChild(arScript);
      });
    }

    await new Promise((resolve) => {
      if (window.AFRAME && window.AFRAME.registerComponent) {
        resolve(void 0);
      } else {
        const checkInterval = setInterval(() => {
           if (window.AFRAME && window.AFRAME.registerComponent) {
             clearInterval(checkInterval);
             resolve(void 0);
           }
         }, 250) as NodeJS.Timeout;
      }
    });
  };

  const initializeAR = useCallback(async () => {
    console.log('🎯 [AR Test] Starting AR initialization');
    
    try {
      await loadScripts();
      setIsARReady(true);
      console.log('✅ [AR Test] AR initialization completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ [AR Test] AR initialization failed:', errorMessage);
      setError(`Error al inicializar realidad aumentada: ${errorMessage}`);
    }
  }, []);

  // Events
  useEffect(() => {
    const onMarkerFound = () => {
      console.log('🎯 [AR Test] Marker found');
      setIsTracking(true);
      setTrackingLost(false);
      toast.success('¡Marcador detectado!');
      
      const v = videoRef.current;
      if (v) {
        console.log('🎬 [AR Test] Playing video after marker detection');
        v.muted = true;
        v.playsInline = true;
        v.play().catch(() => console.warn('Video autoplay failed'));
      }
    };

    const onMarkerLost = () => {
      console.log('❌ [AR Test] Marker lost');
      setIsTracking(false);
      setTrackingLost(true);
    };

    document.addEventListener('markerFound', onMarkerFound, { passive: true });
    document.addEventListener('markerLost', onMarkerLost, { passive: true });

    return () => {
      document.removeEventListener('markerFound', onMarkerFound);
      document.removeEventListener('markerLost', onMarkerLost);
    };
  }, []);

  // Load AR when camera is ready
  useEffect(() => {
    if (cameraStatus !== 'granted') return;
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    // Add a small delay to ensure camera is fully ready
    setTimeout(() => {
      initializeAR();
    }, 500);
  }, [cameraStatus, initializeAR]);

  // Force camera video styles after AR is ready
  useEffect(() => {
    if (!isARReady) return;
    
    let attempts = 0;
    const maxAttempts = 20;
    
    const fixCameraVideo = () => {
      attempts++;
      
      // Find the AR.js injected video element
      const arVideo = document.getElementById('arjs-video') as HTMLVideoElement;
      if (arVideo) {
        console.log('🎥 [AR Test] Found AR video element, applying fixes');
        
        // Ensure video properties
        arVideo.setAttribute('playsinline', 'true');
        arVideo.setAttribute('webkit-playsinline', 'true');
        arVideo.setAttribute('muted', 'true');
        arVideo.setAttribute('autoplay', 'true');
        arVideo.playsInline = true;
        arVideo.muted = true;
        arVideo.autoplay = true;
        
        // Force video styles to be visible
         arVideo.style.setProperty('position', 'fixed', 'important');
         arVideo.style.setProperty('top', '0', 'important');
         arVideo.style.setProperty('left', '0', 'important');
         arVideo.style.setProperty('width', '100vw', 'important');
         arVideo.style.setProperty('height', '100vh', 'important');
         arVideo.style.setProperty('object-fit', 'cover', 'important');
         arVideo.style.setProperty('z-index', '-1', 'important');
         arVideo.style.setProperty('display', 'block', 'important');
         arVideo.style.setProperty('visibility', 'visible', 'important');
         arVideo.style.setProperty('opacity', '1', 'important');
         arVideo.style.setProperty('background', 'black', 'important');
         arVideo.style.setProperty('margin', '0', 'important');
         arVideo.style.setProperty('padding', '0', 'important');
         arVideo.style.setProperty('border', 'none', 'important');
         arVideo.style.setProperty('outline', 'none', 'important');
         
         // Try to play the video
         arVideo.play().catch(() => {
           console.warn('⚠️ [AR Test] Video autoplay failed, waiting for user interaction');
         });
         
         return true;
       }
       
       // Find the canvas and ensure it's transparent
        const canvas = document.querySelector('canvas.a-canvas') as HTMLCanvasElement;
        if (canvas) {
          console.log('🎨 [AR Test] Found A-Frame canvas, making it transparent');
          canvas.style.setProperty('background', 'transparent', 'important');
          canvas.style.setProperty('background-color', 'transparent', 'important');
          canvas.style.setProperty('background-image', 'none', 'important');
          canvas.style.setProperty('z-index', '1', 'important');
          canvas.style.setProperty('position', 'fixed', 'important');
          canvas.style.setProperty('top', '0', 'important');
          canvas.style.setProperty('left', '0', 'important');
          canvas.style.setProperty('width', '100vw', 'important');
          canvas.style.setProperty('height', '100vh', 'important');
          canvas.style.setProperty('margin', '0', 'important');
          canvas.style.setProperty('padding', '0', 'important');
          canvas.style.setProperty('border', 'none', 'important');
          canvas.style.setProperty('pointer-events', 'auto', 'important');
        }
        
        // Also try to find any other canvas elements
        const allCanvases = document.querySelectorAll('canvas');
        allCanvases.forEach((canvasEl, index) => {
          console.log(`🎨 [AR Test] Found canvas ${index + 1}, making it transparent`);
          (canvasEl as HTMLCanvasElement).style.setProperty('background', 'transparent', 'important');
          (canvasEl as HTMLCanvasElement).style.setProperty('background-color', 'transparent', 'important');
          (canvasEl as HTMLCanvasElement).style.setProperty('background-image', 'none', 'important');
        });
       
       // Remove any A-Frame UI elements that might be white
       const aframeUI = document.querySelectorAll('.a-enter-vr, .a-orientation-modal, .a-dialog');
       aframeUI.forEach(el => {
         (el as HTMLElement).style.display = 'none';
       });
       
       // Ensure the scene itself has no white background
        const scene = document.querySelector('a-scene') as HTMLElement;
        if (scene) {
          scene.style.setProperty('background', 'transparent', 'important');
          scene.style.setProperty('background-color', 'transparent', 'important');
          scene.style.setProperty('position', 'fixed', 'important');
          scene.style.setProperty('top', '0', 'important');
          scene.style.setProperty('left', '0', 'important');
          scene.style.setProperty('width', '100vw', 'important');
          scene.style.setProperty('height', '100vh', 'important');
          scene.style.setProperty('margin', '0', 'important');
          scene.style.setProperty('padding', '0', 'important');
          
          // Force A-Frame renderer to be transparent
          scene.setAttribute('background', 'color: transparent');
          scene.setAttribute('renderer', 'clearColor: transparent; alpha: true');
        }
        
        // Force WebGL context to be transparent
        setTimeout(() => {
          const canvases = document.querySelectorAll('canvas');
          canvases.forEach(canvas => {
            const gl = (canvas as HTMLCanvasElement).getContext('webgl') || (canvas as HTMLCanvasElement).getContext('webgl2');
            if (gl) {
              gl.clearColor(0, 0, 0, 0); // Transparent clear color
              gl.clear(gl.COLOR_BUFFER_BIT);
            }
          });
        }, 2000);
      
      if (attempts < maxAttempts) {
        setTimeout(fixCameraVideo, 500);
      } else {
        console.warn('⚠️ [AR Test] Could not find AR video element after', maxAttempts, 'attempts');
      }
      
      return false;
    };
    
    // Start trying to fix the camera video
    setTimeout(fixCameraVideo, 1000);
  }, [isARReady]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
      toast.success(isMuted ? 'Audio activado' : 'Audio silenciado');
    }
  }, [isMuted]);

  const resetTracking = useCallback(() => {
    if (sceneRef.current) {
      const scene = sceneRef.current as HTMLElement & {
        systems?: {
          arjs?: {
            restart?: () => void;
          };
        };
      };
      const arSystem = scene.systems?.arjs;
      if (arSystem && arSystem.restart) {
        arSystem.restart();
      }
      setTrackingLost(false);
      toast.success('Tracking reiniciado');
    }
  }, []);

  if (error || cameraStatus === 'denied' || cameraStatus === 'unavailable' || cameraStatus === 'insecure_context') {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Prueba de realidad aumentada - Error</h1>
          <p className="text-gray-600 dark:text-gray-300">{error}</p>
          
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4 text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Cómo solucionarlo:</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>1. Permite el acceso a la cámara</li>
              <li>2. Usa HTTPS o localhost</li>
              <li>3. Intenta con un navegador diferente</li>
            </ul>
          </div>

          <Button onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Intentar de Nuevo
          </Button>
        </div>
      </div>
    );
  }

  if (cameraStatus === 'checking' || !isARReady) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Camera className="h-16 w-16 text-blue-500 mx-auto animate-pulse" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cargando Prueba de realidad aumentada</h1>
          <p className="text-gray-600 dark:text-gray-300 max-w-md">
            {cameraStatus === 'checking' ? 'Verificando acceso a la cámara...' : 'Cargando librerías de realidad aumentada...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Global styles to prevent white backgrounds */}
      <style>{`
        html, body, #__next { 
          height: 100%; 
          margin: 0; 
          padding: 0; 
          overflow: hidden; 
          background: #000;
          -webkit-overflow-scrolling: touch;
          touch-action: none;
        }
        
        /* Force A-Frame scene to fill entire viewport */
        a-scene {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          background: transparent !important;
        }
        
        /* AR.js camera video element - optimized for mobile */
        #arjs-video {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          min-height: 100vh !important;
          min-height: 100dvh !important;
          object-fit: cover !important;
          background: black !important;
          object-position: center center !important;
          max-width: none !important;
          max-height: none !important;
          transform: none !important;
          z-index: -1 !important;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          outline: none !important;
        }
        
        /* A-Frame canvas - mobile optimized */
         canvas.a-canvas {
           position: fixed !important;
           top: 0 !important;
           left: 0 !important;
           right: 0 !important;
           bottom: 0 !important;
           width: 100vw !important;
           height: 100vh !important;
           min-height: 100vh !important;
           min-height: 100dvh !important;
           display: block !important;
           background: transparent !important;
           background-color: transparent !important;
           background-image: none !important;
           transform: none !important;
           z-index: 1 !important;
           pointer-events: auto !important;
           touch-action: none !important;
           margin: 0 !important;
           padding: 0 !important;
           border: none !important;
         }
         
         /* Force canvas transparency with multiple selectors */
         canvas, canvas.a-canvas, .a-canvas {
           background: transparent !important;
           background-color: transparent !important;
           background-image: none !important;
         }
         
         /* Override any A-Frame default styles */
         a-scene canvas {
           background: transparent !important;
           background-color: transparent !important;
         }
        
        /* Hide A-Frame UI elements */
        .a-enter-vr, .a-orientation-modal, .a-dialog {
          display: none !important;
        }
        
        /* Mobile-specific optimizations */
        @media screen and (max-width: 768px) {
          #arjs-video {
            height: 100vh !important;
            height: 100dvh !important;
            width: 100vw !important;
            object-fit: cover !important;
            z-index: -1 !important;
          }
          
          canvas.a-canvas {
            height: 100vh !important;
            height: 100dvh !important;
            width: 100vw !important;
            z-index: 1 !important;
          }
          
          /* Ensure proper stacking on mobile */
          a-scene {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            height: 100dvh !important;
            z-index: 0 !important;
          }
        }
        
        /* iPhone Pro 16 specific optimizations (402x874) */
        @media screen and (max-width: 430px) and (max-height: 932px) {
          #arjs-video {
            height: 100vh !important;
            height: 100dvh !important;
            width: 100vw !important;
            object-fit: cover !important;
            object-position: center center !important;
            z-index: -1 !important;
          }
          
          canvas.a-canvas {
            height: 100vh !important;
            height: 100dvh !important;
            width: 100vw !important;
            z-index: 1 !important;
          }
          
          /* Optimized UI positioning for iPhone Pro 16 */
          .ar-instructions {
            bottom: 8px !important;
            left: 8px !important;
            right: auto !important;
            max-width: calc(100vw - 80px) !important;
            font-size: 12px !important;
            padding: 8px !important;
          }
          
          .ar-controls {
            bottom: 8px !important;
            right: 8px !important;
            gap: 6px !important;
          }
          
          .ar-header {
            top: 8px !important;
            left: 8px !important;
            right: 8px !important;
            padding: 8px !important;
            font-size: 14px !important;
          }
        }
        
        /* iPad Pro specific optimizations (1024x1366) */
        @media screen and (min-width: 1000px) and (max-width: 1100px) and (min-height: 1300px) {
          #arjs-video {
            height: 100vh !important;
            height: 100dvh !important;
            width: 100vw !important;
            object-fit: cover !important;
            object-position: center center !important;
            z-index: -1 !important;
            /* Fix for black bar issue */
            transform: scale(1.02) !important;
            -webkit-transform: scale(1.02) !important;
          }
          
          canvas.a-canvas {
            height: 100vh !important;
            height: 100dvh !important;
            width: 100vw !important;
            z-index: 1 !important;
          }
          
          /* Ensure no black bars on iPad Pro */
          a-scene {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            height: 100dvh !important;
            z-index: 0 !important;
            overflow: hidden !important;
          }
          
          .ar-instructions {
            bottom: 16px !important;
            left: 16px !important;
            max-width: 400px !important;
            font-size: 14px !important;
          }
          
          .ar-controls {
            bottom: 16px !important;
            right: 16px !important;
            gap: 8px !important;
          }
          
          .ar-header {
            top: 16px !important;
            left: 16px !important;
            right: 16px !important;
            max-width: none !important;
          }
        }
        
        /* iOS Safari specific fixes */
        @supports (-webkit-touch-callout: none) {
          #arjs-video {
            height: 100vh !important;
            height: -webkit-fill-available !important;
          }
          
          canvas.a-canvas {
            height: 100vh !important;
            height: -webkit-fill-available !important;
          }
        }
        
        /* Prevent scrolling and zooming on mobile */
         body {
           -webkit-user-select: none;
           -webkit-touch-callout: none;
           -webkit-text-size-adjust: none;
           -webkit-tap-highlight-color: transparent;
           user-select: none;
         }
         
         /* Dynamic mobile-specific styles */
         ${isMobile ? `
           #arjs-video {
             transform: translateZ(0) !important;
             -webkit-transform: translateZ(0) !important;
             backface-visibility: hidden !important;
             -webkit-backface-visibility: hidden !important;
             will-change: transform !important;
           }
           
           canvas.a-canvas {
             transform: translateZ(0) !important;
             -webkit-transform: translateZ(0) !important;
             backface-visibility: hidden !important;
             -webkit-backface-visibility: hidden !important;
             will-change: transform !important;
           }
           
           /* Force hardware acceleration on mobile */
           a-scene {
             transform: translateZ(0) !important;
             -webkit-transform: translateZ(0) !important;
           }
         ` : ''}
         
         /* Orientation-specific styles for mobile */
         @media screen and (orientation: portrait) and (max-width: 768px) {
           #arjs-video, canvas.a-canvas {
             width: 100vw !important;
             height: 100vh !important;
             height: 100dvh !important;
           }
         }
         
         @media screen and (orientation: landscape) and (max-width: 768px) {
           #arjs-video, canvas.a-canvas {
             width: 100vw !important;
             height: 100vh !important;
             height: 100dvh !important;
           }
         }
      `}
      </style>

      {/* AR Scene */}
      <a-scene
        ref={sceneRef}
        vr-mode-ui="enabled: false"
        renderer="logarithmicDepthBuffer: true; antialias: true; colorManagement: true; alpha: true; preserveDrawingBuffer: true; clearColor: transparent;"
        arjs="trackingMethod: best; sourceType: webcam; debugUIEnabled: true; detectionMode: mono_and_matrix; matrixCodeType: 3x3; maxDetectionRate: 20; smooth: true; smoothCount: 3; smoothTolerance: 0.02; smoothThreshold: 3; displayWidth: 640; displayHeight: 480;"
        embedded
        style={{ height: '100vh', width: '100vw' }}
        background="color: transparent"
      >
        <a-assets timeout="30000">
          <video
            ref={videoRef}
            id="vid"
            src={testPostcard.video_url}
            preload="auto"
            loop
            crossOrigin="anonymous"
            autoPlay
            muted={isMuted}
            playsInline
            controls={false}
          />
        </a-assets>

        <a-nft
          type="nft"
          url="https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.5/data/dataNFT/pinball"
          smooth="true"
          smoothCount="5"
          smoothTolerance="0.01"
          smoothThreshold="2"
          emitevents="true"
          id="nft-marker"
        >
          <a-video
            src="#vid"
            position="0 0 0"
            rotation="-90 0 0"
            width="1"
            height="1.78"
            opacity="0.95"
            material="shader: flat; transparent: true; alphaTest: 0.1;"
            geometry="primitive: plane;"
          />
        </a-nft>

        <a-entity camera look-controls-enabled="false" />
      </a-scene>

      {/* UI Overlay */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">🧪 Prueba de realidad aumentada</h1>
              <p className="text-sm opacity-80">Apunta a la imagen de pinball</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                isTracking ? 'bg-green-500' : trackingLost ? 'bg-red-500' : 'bg-yellow-500'
              }`} />
              <span className="text-xs opacity-70">
                {isTracking ? 'Detectado' : trackingLost ? 'Perdido' : 'Buscando...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col space-y-2">
        <Button
          onClick={toggleMute}
          className="bg-gray-800/80 hover:bg-gray-700/80 text-white rounded-full p-3 shadow-lg"
          size="icon"
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </Button>
        
        {trackingLost && (
          <Button
            onClick={resetTracking}
            className="bg-orange-600/80 hover:bg-orange-700/80 text-white rounded-full p-3 shadow-lg"
            size="icon"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white text-sm max-w-xs">
          {!isTracking && !trackingLost && (
            <p>📱 Apunta tu cámara a la imagen de pinball para ver la experiencia de realidad aumentada</p>
          )}
          {isTracking && (
            <p>✅ ¡Marcador detectado! Video reproduciéndose en realidad aumentada</p>
          )}
          {trackingLost && (
            <p>⚠️ Marcador perdido. Vuelve a enfocar la imagen</p>
          )}
          <div className="mt-2 text-xs opacity-70">
            <p>💡 Imagen de prueba: <a href="/images/pinball-marker.jpg" className="underline" target="_blank">pinball-marker.jpg</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}