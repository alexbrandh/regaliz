'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import Link from 'next/link';

interface PostcardSummary {
  id: string;
  is_activated: boolean;
  user_id?: string;
  title?: string;
}

export default function ARViewerPage() {
  const params = useParams();
  const postcardId = params.postcardId as string;
  const { user, isLoaded } = useUser();
  const [data, setData] = useState<PostcardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postcardId) return;
    fetch(`/api/postcards/${postcardId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) setData(res.data);
      })
      .finally(() => setLoading(false));
  }, [postcardId]);

  useEffect(() => {
    if (data?.is_activated) {
      window.location.href = `/ar-viewer.html?id=${postcardId}`;
    }
  }, [data, postcardId]);

  if (loading || !isLoaded) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', color: '#FAF8F5' }}>
        <p>Cargando...</p>
      </div>
    );
  }

  if (data && !data.is_activated) {
    const isOwner = !!user && user.id === data.user_id;
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d1f1f 50%, #1a1a1a 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#FAF8F5', padding: '24px', textAlign: 'center'
      }}>
        <img src="/regaliz-isotipo.svg" alt="Regaliz" style={{ width: '80px', height: '80px', marginBottom: '24px' }} />
        {isOwner ? (
          <>
            <h1 style={{ fontSize: '24px', marginBottom: '12px' }}>Activa tu postal</h1>
            <p style={{ color: '#bbb', marginBottom: '24px', maxWidth: '420px' }}>
              Tu postal está lista pero aún no está activada. Actívala para que tú y otros puedan vivir la experiencia AR.
            </p>
            <Link href={`/dashboard/postcard/${postcardId}`} style={{
              background: '#F47B6B', color: '#fff', padding: '12px 24px', borderRadius: '8px', fontWeight: 600, textDecoration: 'none'
            }}>
              Ir a activar
            </Link>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '24px', marginBottom: '12px' }}>Tu regalo está siendo preparado ✨</h1>
            <p style={{ color: '#bbb', maxWidth: '420px' }}>
              Esta postal aún no está disponible. Inténtalo de nuevo más tarde.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a1a', color: '#F47B6B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Iniciando experiencia AR...</p>
    </div>
  );
}
