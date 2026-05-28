'use client';

import { LazyMotion, domAnimation } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { ScrollPhoneHero } from '@/components/hero/ScrollPhoneHero';
import { HeroCTAs } from '@/components/hero/HeroCTAs';
import { HowItWorksSection } from '@/components/sections/HowItWorksSection';

// LazyMotion + domAnimation ships the smaller animation feature set (~15KB
// gzipped vs ~40KB for full motion). Children use `m.*` instead of `motion.*`.
export default function Home() {
  return (
    <LazyMotion features={domAnimation} strict>
      <MainLayout>
        <div className="min-h-screen">
          <ScrollPhoneHero />
          <HeroCTAs />
          <HowItWorksSection />
        </div>
      </MainLayout>
    </LazyMotion>
  );
}
