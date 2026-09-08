'use client';

import { Link } from '@/lib/navigation/client';
import { Image } from '@/lib/navigation/image';
import { GlassEffect, GlassFilter } from '@/components/ui/liquid-glass';

export function Header() {
  return (
    <>
      <GlassFilter />
      <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-3 pointer-events-none">
        {/* iOS 26 Liquid Glass Header */}
        <div className="mx-auto w-fit pointer-events-auto">
          <GlassEffect className="rounded-[32px] px-5 py-3 hover:px-6 hover:py-4 items-center">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative w-7 h-7 flex items-center justify-center">
                <Image 
                  src="/regaliz-isotipo.svg" 
                  alt="Regaliz" 
                  width={28} 
                  height={28} 
                  className="transition-all duration-300 group-hover:scale-110"
                />
              </div>
              <Image 
                src="/regaliz-logo.svg" 
                alt="Regaliz" 
                width={80} 
                height={22} 
                className="dark:brightness-0 dark:invert transition-all"
              />
            </Link>
          </GlassEffect>
        </div>
      </header>
    </>
  );
}