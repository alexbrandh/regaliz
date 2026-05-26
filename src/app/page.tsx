'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { ScrollPhoneHero } from '@/components/hero/ScrollPhoneHero';
import { HeroCTAs } from '@/components/hero/HeroCTAs';
import { HowItWorksSection } from '@/components/sections/HowItWorksSection';

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
