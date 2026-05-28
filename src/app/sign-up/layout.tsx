import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Crear cuenta',
  description: 'Crea tu cuenta gratis en Regaliz y empieza a hacer postales de realidad aumentada en minutos.',
  alternates: { canonical: '/sign-up' },
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
