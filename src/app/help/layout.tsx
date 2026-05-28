import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Centro de Ayuda',
  description: 'Aprende a crear tu primera postal de realidad aumentada con Regaliz: requisitos, pasos y consejos para conseguir la mejor experiencia.',
  alternates: { canonical: '/help' },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
