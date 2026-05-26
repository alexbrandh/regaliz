'use client';

import { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import GradientMenu from '@/components/ui/gradient-menu';

interface MainLayoutProps {
  children: ReactNode;
  showFooter?: boolean;
  showBottomMenu?: boolean;
}

export function MainLayout({ children, showFooter = true, showBottomMenu = true }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className={`flex-1 pt-16 ${showBottomMenu ? 'pb-24' : ''}`}>
        {children}
      </main>
      {showFooter && <Footer />}
      <OfflineIndicator />
      {showBottomMenu && <GradientMenu />}
    </div>
  );
}