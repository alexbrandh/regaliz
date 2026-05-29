import { signInWithGoogle } from '@/app/auth/actions';
import { Button } from '@/components/ui/button';

type Props = {
  next?: string;
  label?: string;
};

// Google "G" logo as an inline SVG — no external image roundtrip, no
// Lucide import, no Image optimization cost.
function GoogleLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.45.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.95l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.5c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.46 2.1 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.43 9.14 5.5 12 5.5Z"
      />
    </svg>
  );
}

export function GoogleSignInButton({ next, label = 'Continuar con Google' }: Props) {
  return (
    <form action={signInWithGoogle}>
      {next && <input type="hidden" name="next" value={next} />}
      <Button
        type="submit"
        variant="outline"
        size="lg"
        className="w-full gap-3"
      >
        <GoogleLogo />
        {label}
      </Button>
    </form>
  );
}
