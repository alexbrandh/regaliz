import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SharePostcardView } from '@/components/SharePostcardView';
import { Postcard } from '@/types/database';

interface SharePageProps {
  params: Promise<{
    postcardId: string;
  }>;
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const supabase = await createClient();
  const resolvedParams = await params;

  try {
    const { data: postcard } = await supabase
      .from('postcards')
      .select('title, image_url, is_activated')
      .eq('id', resolvedParams.postcardId)
      .single();

    if (!postcard) {
      return {
        title: 'Postcard no encontrada - Regaliz',
        description: 'La postcard que buscas no existe o ha sido eliminada.'
      };
    }

    if (!postcard.is_activated) {
      return {
        title: 'Regaliz — Tu regalo te espera',
        description: 'Tu postal personalizada está siendo preparada.',
      };
    }

    return {
      title: `${postcard.title} - Regaliz`,
      description: `Mira esta increíble postcard en realidad aumentada: ${postcard.title}`,
      openGraph: {
        title: `${postcard.title} - Regaliz`,
        description: `Experimenta esta postcard en realidad aumentada`,
        images: postcard.image_url ? [postcard.image_url] : [],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${postcard.title} - Regaliz`,
        description: `Experimenta esta postcard en realidad aumentada`,
        images: postcard.image_url ? [postcard.image_url] : [],
      },
    };
  } catch (error) {
    console.error('Error generando metadata:', error);
    return {
      title: 'Postcard - Regaliz',
      description: 'Experimenta postcards en realidad aumentada'
    };
  }
}

type ShareResult =
  | { kind: 'missing' }
  | { kind: 'pending' }
  | { kind: 'ready'; postcard: Postcard };

/**
 * Loads the postcard behind a share link.
 *
 * Kept free of JSX on purpose: the try/catch here only guards the data
 * fetch. Rendering happens after this returns, so wrapping JSX in a
 * try/catch would not catch render errors anyway — that is what an error
 * boundary is for.
 */
async function loadSharedPostcard(postcardId: string): Promise<ShareResult> {
  try {
    const supabase = await createClient();

    // First pass: query only non-sensitive status fields so we can decide whether
    // to expose asset URLs. Asset fields (image_url, video_url, nft_descriptors)
    // are only queried for activated postcards in the second pass below.
    const { data: status, error: statusError } = await supabase
      .from('postcards')
      .select('id, title, is_activated, processing_status, user_id')
      .eq('id', postcardId)
      .eq('processing_status', 'ready')
      .single();

    if (statusError || !status) {
      console.error('Error obteniendo postcard:', statusError);
      return { kind: 'missing' };
    }

    if (!status.is_activated) {
      return { kind: 'pending' };
    }

    // Second pass: now that we've confirmed the postcard is activated, fetch
    // the full record including asset URLs.
    const { data: postcard, error } = await supabase
      .from('postcards')
      .select(`
        id,
        title,
        image_url,
        video_url,
        nft_descriptors,
        processing_status,
        created_at,
        updated_at,
        is_activated,
        user_id
      `)
      .eq('id', postcardId)
      .eq('processing_status', 'ready')
      .eq('is_activated', true)
      .single();

    if (error || !postcard) {
      console.error('Error obteniendo postcard:', error);
      return { kind: 'missing' };
    }

    return { kind: 'ready', postcard: postcard as Postcard };
  } catch (error) {
    console.error('Error en página de compartir:', error);
    return { kind: 'missing' };
  }
}

function PendingGift() {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2d1f1f 50%, #1a1a1a 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: '#FAF8F5', padding: '24px', textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '28px', marginBottom: '12px' }}>Tu regalo está siendo preparado ✨</h1>
      <p style={{ color: '#bbb', maxWidth: '460px' }}>
        Esta postal aún no está disponible para compartir. Vuelve pronto.
      </p>
    </main>
  );
}

export default async function SharePage({ params }: SharePageProps) {
  const resolvedParams = await params;
  const result = await loadSharedPostcard(resolvedParams.postcardId);

  // notFound() throws to unwind the render; calling it outside the fetch's
  // try/catch keeps that control-flow exception from being swallowed and
  // logged as a failure.
  if (result.kind === 'missing') {
    notFound();
  }

  if (result.kind === 'pending') {
    return <PendingGift />;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
      <SharePostcardView postcard={result.postcard} />
    </div>
  );
}
