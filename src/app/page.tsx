import dynamic from 'next/dynamic';
import { MainLayout } from '@/components/layout/MainLayout';
import { ScrollPhoneHero } from '@/components/hero/ScrollPhoneHero';
import { HeroCTAs } from '@/components/hero/HeroCTAs';

// HowItWorksSection lives below the fold and pulls framer-motion + Image
// for the phone mockup. Splitting it into its own chunk keeps it off the
// initial render path so the hero can hydrate first.
const HowItWorksSection = dynamic(
  () => import('@/components/sections/HowItWorksSection').then((m) => m.HowItWorksSection),
);

export default function Home() {
  return (
    <MainLayout>
      <div className="min-h-screen">
        <ScrollPhoneHero />
        <HeroCTAs />
        <HowItWorksSection />
      </div>
    </MainLayout>
  );
}
