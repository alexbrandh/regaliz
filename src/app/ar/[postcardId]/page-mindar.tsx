/**
 * NOT A ROUTE, AND NOT WIRED UP. Kept on purpose.
 *
 * Its three siblings (page-clean, page-simple, page-complex) were deleted as
 * dead AR.js prototypes. This one survived because it is the repo's only
 * example of driving MindAR imperatively through three.js
 * (mindar-image-three) rather than through A-Frame's declarative binding,
 * which is what public/ar-viewer.html uses.
 *
 * That imperative shape is exactly what the viewer will need when this app
 * moves off Next and the viewer has to own its own render loop. Use it as a
 * reference, then delete it once the ported viewer works.
 */
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from '@/lib/navigation/client';

interface PostcardData {
  id: string;
  title: string;
  description: string;
  image_url: string;
  video_url: string;
  nft_descriptors: {
    type?: string;
    targetUrl?: string;
  } | null;
  user_id?: string;
}

export default function ARViewerPageMindAR() {
  const params = useParams();
  const postcardId = params.postcardId as string;
  
  const [postcard, setPostcard] = useState<PostcardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [trackingStatus, setTrackingStatus] = useState<'searching' | 'found'>('searching');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const mindArRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Fetch postcard data
  useEffect(() => {
    if (!postcardId) return;
    
    const fetchPostcard = async () => {
      try {
        const response = await fetch(`/api/postcards/${postcardId}`);
        if (!response.ok) throw new Error(`Error ${response.status}`);
        const data = await response.json();
        setPostcard(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPostcard();
  }, [postcardId]);

  // Load MindAR scripts
  useEffect(() => {
    const loadScripts = async () => {
      try {
        // Load Three.js first (required by MindAR)
        if (!document.querySelector('script[src*="three.min.js"]')) {
          const three = document.createElement('script');
          three.src = 'https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.min.js';
          document.head.appendChild(three);
          await new Promise((resolve, reject) => { 
            three.onload = resolve; 
            three.onerror = reject; 
          });
        }

        // Load MindAR Image tracking
        if (!document.querySelector('script[src*="mindar-image-three"]')) {
          const mindar = document.createElement('script');
          mindar.src = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js';
          document.head.appendChild(mindar);
          await new Promise((resolve, reject) => { 
            mindar.onload = resolve; 
            mindar.onerror = reject; 
          });
        }

        setScriptsLoaded(true);
      } catch (err) {
        setError('Error cargando librerías AR');
      }
    };
    
    loadScripts();
  }, []);

  // Get target URL for MindAR
  const getTargetUrl = useCallback(() => {
    if (postcard?.nft_descriptors?.targetUrl) {
      return postcard.nft_descriptors.targetUrl;
    }
    if (postcard?.user_id && postcard?.id) {
      return `/api/ar/mind-target/${postcard.user_id}/${postcard.id}`;
    }
    return null;
  }, [postcard]);

  // Initialize MindAR scene
  useEffect(() => {
    if (!scriptsLoaded || !postcard || !containerRef.current) return;
    
    const videoUrl = postcard.video_url;
    const targetUrl = getTargetUrl();
    
    if (!videoUrl) {
      setError('La postal no tiene un video asociado');
      return;
    }
    
    if (!targetUrl) {
      setError('La postal no tiene un target AR configurado');
      return;
    }

    const initAR = async () => {
      try {
        const THREE = (window as any).THREE;
        const MindARThree = (window as any).MINDAR?.IMAGE?.MindARThree;

        if (!THREE || !MindARThree) {
          throw new Error('MindAR or THREE not loaded');
        }

        // Create MindAR instance
        const mindarThree = new MindARThree({
          container: containerRef.current,
          imageTargetSrc: targetUrl,
          uiScanning: false,
          uiLoading: false,
        });

        mindArRef.current = mindarThree;

        const { renderer, scene, camera } = mindarThree;

        // Create video element for AR content
        const video = document.createElement('video');
        video.src = videoUrl;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('crossorigin', 'anonymous');
        video.loop = true;
        video.muted = true;
        video.preload = 'auto';
        videoRef.current = video;

        // Create video texture
        const texture = new THREE.VideoTexture(video);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        // Create plane geometry for video
        const geometry = new THREE.PlaneGeometry(1, 0.5625); // 16:9 aspect ratio
        const material = new THREE.MeshBasicMaterial({ 
          map: texture, 
          side: THREE.DoubleSide 
        });
        const plane = new THREE.Mesh(geometry, material);

        // Get anchor for the image target (index 0)
        const anchor = mindarThree.addAnchor(0);
        anchor.group.add(plane);

        // Handle target found/lost events
        anchor.onTargetFound = () => {
          setTrackingStatus('found');
          video.play().catch(() => {});
        };

        anchor.onTargetLost = () => {
          setTrackingStatus('searching');
          video.pause();
        };

        // Start AR
        await mindarThree.start();
        setCameraReady(true);

        // Render loop
        const renderLoop = () => {
          renderer.render(scene, camera);
          requestAnimationFrame(renderLoop);
        };
        renderLoop();

      } catch (err) {
        console.error('Error initializing MindAR:', err);
        setError(`Error iniciando AR: ${err instanceof Error ? err.message : 'desconocido'}`);
      }
    };

    initAR();

    // Cleanup
    return () => {
      if (mindArRef.current) {
        try {
          mindArRef.current.stop();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
    };
  }, [scriptsLoaded, postcard, getTargetUrl]);

  // Loading state
  if (loading || !scriptsLoaded) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        `}</style>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '3px solid rgba(168,85,247,0.3)',
            borderTopColor: '#a855f7',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
            {loading ? 'Cargando postal...' : 'Iniciando MindAR...'}
          </p>
          <p style={{ fontSize: '13px', color: '#9ca3af', animation: 'pulse 2s infinite' }}>
            Por favor espera
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !postcard) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '400px',
          textAlign: 'center'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'rgba(239,68,68,0.2)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="#ef4444" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
            Error al cargar
          </h2>
          <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '20px' }}>
            {error || 'No se pudo cargar la postal'}
          </p>
          <button 
            onClick={() => window.location.href = '/dashboard'}
            style={{
              width: '100%',
              padding: '14px 24px',
              background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '600',
              color: '#fff',
              fontSize: '15px',
              cursor: 'pointer'
            }}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0,
      width: '100%',
      height: '100%',
      margin: 0,
      padding: 0,
      overflow: 'hidden',
      background: '#000'
    }}>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } }
        
        html, body { 
          margin: 0 !important; 
          padding: 0 !important; 
          overflow: hidden !important;
          width: 100vw !important;
          height: 100vh !important;
          background: #000 !important;
        }
      `}</style>

      {/* MindAR Container */}
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'absolute',
          top: 0,
          left: 0
        }} 
      />

      {/* Loading overlay while camera initializes */}
      {!cameraReady && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '3px solid rgba(168,85,247,0.3)',
              borderTopColor: '#a855f7',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }} />
            <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px', color: '#fff' }}>
              Iniciando cámara AR...
            </p>
            <p style={{ fontSize: '13px', color: '#9ca3af' }}>
              Permite el acceso a la cámara si se solicita
            </p>
          </div>
        </div>
      )}

      {/* Instructions overlay */}
      {showInstructions && cameraReady && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: '20px',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          zIndex: 50
        }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(30,30,50,0.95) 0%, rgba(20,20,35,0.98) 100%)',
            borderRadius: '24px',
            padding: '28px',
            maxWidth: '340px',
            width: '100%',
            border: '1px solid rgba(168,85,247,0.2)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)'
          }}>
            <h2 style={{ 
              fontSize: '22px', 
              fontWeight: '700', 
              marginBottom: '16px', 
              textAlign: 'center',
              background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              ¡Tu postal AR está lista!
            </h2>
            
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(99,102,241,0.2) 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <span style={{ fontSize: '18px' }}>📷</span>
                </div>
                <p style={{ fontSize: '14px', color: '#d1d5db', lineHeight: '1.5', margin: 0 }}>
                  Apunta tu cámara hacia la <strong style={{ color: '#fff' }}>imagen de la postal</strong>
                </p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(99,102,241,0.2) 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <span style={{ fontSize: '18px' }}>✨</span>
                </div>
                <p style={{ fontSize: '14px', color: '#d1d5db', lineHeight: '1.5', margin: 0 }}>
                  El <strong style={{ color: '#fff' }}>video sorpresa</strong> aparecerá mágicamente sobre ella
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowInstructions(false)}
              style={{
                width: '100%',
                padding: '16px 24px',
                background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 50%, #6366f1 100%)',
                border: 'none',
                borderRadius: '14px',
                fontWeight: '600',
                color: '#fff',
                fontSize: '16px',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(147,51,234,0.4)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
            >
              ¡Empezar! 🎬
            </button>
          </div>
        </div>
      )}

      {/* Back button */}
      <button 
        onClick={() => window.history.back()}
        style={{
          position: 'fixed',
          top: 'max(12px, env(safe-area-inset-top))',
          left: '12px',
          width: '44px',
          height: '44px',
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 40,
          cursor: 'pointer'
        }}
      >
        <svg style={{ width: '22px', height: '22px' }} fill="none" stroke="#fff" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Tracking status indicator */}
      {cameraReady && !showInstructions && (
        <div style={{
          position: 'fixed',
          bottom: 'max(20px, env(safe-area-inset-bottom))',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          background: trackingStatus === 'found' ? 'rgba(34,197,94,0.9)' : 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 40
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: trackingStatus === 'found' ? '#fff' : '#fbbf24',
            animation: trackingStatus === 'searching' ? 'pulse 1.5s infinite' : 'none'
          }} />
          <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>
            {trackingStatus === 'found' ? '¡Imagen detectada!' : 'Buscando imagen...'}
          </span>
        </div>
      )}
    </div>
  );
}
