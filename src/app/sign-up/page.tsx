import Image from 'next/image';
import Link from 'next/link';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

type SearchParams = Promise<{ redirect_url?: string; error?: string }>;

// Google OAuth creates the auth.users row on first sign-in, so sign-up
// and sign-in collapse into the same UX — different copy only.
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { redirect_url, error } = await searchParams;
  const next = typeof redirect_url === 'string' ? redirect_url : '/dashboard';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border/50 rounded-3xl shadow-xl p-8 md:p-10 space-y-6">
          <div className="flex flex-col items-center gap-3">
            <Image
              src="/regaliz-isotipo.svg"
              alt="Regaliz"
              width={48}
              height={48}
              priority
            />
            <h1 className="text-2xl font-bold text-foreground text-center">
              Crear cuenta en Regaliz
            </h1>
            <p className="text-sm text-muted-foreground text-center">
              Crea tu cuenta para empezar a hacer postales en realidad aumentada.
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl">
              {decodeURIComponent(error)}
            </div>
          )}

          <GoogleSignInButton next={next} label="Continuar con Google" />

          <p className="text-sm text-center text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link href="/sign-in" className="text-primary font-medium hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
