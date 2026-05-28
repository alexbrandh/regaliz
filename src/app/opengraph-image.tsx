import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Regaliz - Postales en Realidad Aumentada';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FAF8F5 0%, #FFE4DE 50%, #F47B6B 100%)',
          fontFamily: 'sans-serif',
          padding: '64px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 84,
            fontWeight: 800,
            letterSpacing: '-2px',
            color: '#1a1a1a',
            lineHeight: 1.05,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <span>Crea postales de realidad aumentada</span>
          <span style={{ color: '#F47B6B', marginTop: 8 }}>que cobran vida</span>
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 32,
            color: '#4a4a4a',
            maxWidth: 880,
            lineHeight: 1.3,
          }}
        >
          Combina una foto y un video. Comparte el enlace o el QR. Magia.
        </div>
        <div
          style={{
            marginTop: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '14px 28px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.85)',
            border: '2px solid rgba(244,123,107,0.4)',
            fontSize: 28,
            fontWeight: 700,
            color: '#F47B6B',
          }}
        >
          regaliz.com.co
        </div>
      </div>
    ),
    { ...size }
  );
}
