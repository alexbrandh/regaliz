'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { IoHomeOutline, IoAddCircleOutline, IoGridOutline, IoHelpCircleOutline, IoPersonOutline, IoSunnyOutline, IoMoonOutline } from 'react-icons/io5';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';

const menuItems = [
  { title: 'Inicio', icon: <IoHomeOutline />, href: '/', gradientFrom: '#F47B6B', gradientTo: '#F5B5B5' },
  { title: 'Panel', icon: <IoGridOutline />, href: '/dashboard', gradientFrom: '#6B9B9B', gradientTo: '#5A7A7A', requiresAuth: true },
  { title: 'Crear', icon: <IoAddCircleOutline />, href: '/dashboard/new', gradientFrom: '#F47B6B', gradientTo: '#6B5B8B', requiresAuth: true },
  { title: 'Ayuda', icon: <IoHelpCircleOutline />, href: '/help', gradientFrom: '#6B5B8B', gradientTo: '#4B4B7B' },
];

interface GradientMenuProps {
  className?: string;
}

export default function GradientMenu({ className }: GradientMenuProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-50 safe-area-bottom pointer-events-none ${className}`}>
      <div className="flex justify-center items-center py-10 sm:py-4 px-4 pointer-events-auto">
        <ul className="flex gap-2 sm:gap-3">
          {menuItems.map(({ title, icon, href, gradientFrom, gradientTo, requiresAuth }, idx) => {
            const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href));
            
            const MenuItem = (
              <li
                key={idx}
                style={{ '--gradient-from': gradientFrom, '--gradient-to': gradientTo } as React.CSSProperties}
                className={`relative w-[38px] h-[38px] sm:w-[44px] sm:h-[44px] bg-card/80 backdrop-blur-sm shadow-sm rounded-full flex items-center justify-center transition-all duration-500 hover:w-[90px] sm:hover:w-[102px] hover:shadow-none group cursor-pointer ${isActive ? 'w-[90px] sm:w-[102px] shadow-none' : ''}`}
              >
                {/* Gradient background on hover/active */}
                <span className={`absolute inset-0 rounded-full bg-[linear-gradient(45deg,var(--gradient-from),var(--gradient-to))] transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></span>
                {/* Blur glow */}
                <span className={`absolute top-[8px] inset-x-0 h-full rounded-full bg-[linear-gradient(45deg,var(--gradient-from),var(--gradient-to))] blur-md -z-10 transition-all duration-500 ${isActive ? 'opacity-40' : 'opacity-0 group-hover:opacity-40'}`}></span>

                {/* Icon */}
                <span className={`relative z-10 transition-all duration-500 ${isActive ? 'scale-0' : 'group-hover:scale-0'} delay-0`}>
                  <span className="text-sm sm:text-base text-muted-foreground">{icon}</span>
                </span>

                {/* Title */}
                <span className={`absolute text-white uppercase tracking-wide text-[8px] sm:text-[9px] font-medium transition-all duration-500 ${isActive ? 'scale-100' : 'scale-0 group-hover:scale-100'} delay-150`}>
                  {title}
                </span>
              </li>
            );

            if (requiresAuth) {
              return (
                <SignedIn key={idx}>
                  <Link href={href}>
                    {MenuItem}
                  </Link>
                </SignedIn>
              );
            }

            return (
              <Link href={href} key={idx}>
                {MenuItem}
              </Link>
            );
          })}
          
          {/* User/Login button */}
          <SignedOut>
            <SignInButton mode="modal">
              <li
                style={{ '--gradient-from': '#F47B6B', '--gradient-to': '#F5B5B5' } as React.CSSProperties}
                className="relative w-[38px] h-[38px] sm:w-[44px] sm:h-[44px] bg-card/80 backdrop-blur-sm shadow-sm rounded-full flex items-center justify-center transition-all duration-500 hover:w-[90px] sm:hover:w-[102px] hover:shadow-none group cursor-pointer"
              >
                <span className="absolute inset-0 rounded-full bg-[linear-gradient(45deg,var(--gradient-from),var(--gradient-to))] opacity-0 transition-all duration-500 group-hover:opacity-100"></span>
                <span className="absolute top-[8px] inset-x-0 h-full rounded-full bg-[linear-gradient(45deg,var(--gradient-from),var(--gradient-to))] blur-md opacity-0 -z-10 transition-all duration-500 group-hover:opacity-40"></span>
                <span className="relative z-10 transition-all duration-500 group-hover:scale-0 delay-0">
                  <IoPersonOutline className="text-sm sm:text-base text-muted-foreground" />
                </span>
                <span className="absolute text-white uppercase tracking-wide text-[8px] sm:text-[9px] font-medium transition-all duration-500 scale-0 group-hover:scale-100 delay-150">
                  Entrar
                </span>
              </li>
            </SignInButton>
          </SignedOut>
          
          <SignedIn>
            <li className="relative w-[38px] h-[38px] sm:w-[44px] sm:h-[44px] bg-card/80 backdrop-blur-sm shadow-sm rounded-full flex items-center justify-center">
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "h-6 w-6 sm:h-7 sm:w-7"
                  }
                }}
              />
            </li>
          </SignedIn>

          {/* Theme Toggle */}
          <li
            onClick={toggleTheme}
            style={{ '--gradient-from': '#6B5B8B', '--gradient-to': '#4B4B7B' } as React.CSSProperties}
            className="relative w-[38px] h-[38px] sm:w-[44px] sm:h-[44px] bg-card/80 backdrop-blur-sm shadow-sm rounded-full flex items-center justify-center transition-all duration-500 hover:w-[78px] sm:hover:w-[84px] hover:shadow-none group cursor-pointer"
          >
            <span className="absolute inset-0 rounded-full bg-[linear-gradient(45deg,var(--gradient-from),var(--gradient-to))] opacity-0 transition-all duration-500 group-hover:opacity-100"></span>
            <span className="absolute top-[8px] inset-x-0 h-full rounded-full bg-[linear-gradient(45deg,var(--gradient-from),var(--gradient-to))] blur-md opacity-0 -z-10 transition-all duration-500 group-hover:opacity-40"></span>
            <span className="relative z-10 transition-all duration-500 group-hover:scale-0 delay-0">
              {mounted ? (
                theme === 'dark' ? (
                  <IoMoonOutline className="text-sm sm:text-base text-muted-foreground" />
                ) : (
                  <IoSunnyOutline className="text-sm sm:text-base text-muted-foreground" />
                )
              ) : (
                <IoSunnyOutline className="text-sm sm:text-base text-muted-foreground" />
              )}
            </span>
            <span className="absolute text-white uppercase tracking-wide text-[8px] sm:text-[9px] font-medium transition-all duration-500 scale-0 group-hover:scale-100 delay-150">
              {mounted ? (theme === 'dark' ? 'Claro' : 'Oscuro') : 'Tema'}
            </span>
          </li>
        </ul>
      </div>
    </nav>
  );
}
