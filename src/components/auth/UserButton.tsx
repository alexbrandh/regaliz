'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LogOut, User as UserIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import { useUser } from '@/hooks/useUser';
import { signOut } from '@/app/auth/actions';
import { cn } from '@/lib/utils';

type Props = {
  size?: 'sm' | 'md';
  className?: string;
};

// Custom user button — avatar trigger that opens a dropdown with the user's
// email and a sign-out action. The dropdown content is a tiny Radix island,
// not a full modal like Clerk's UserButton.
export function UserButton({ size = 'sm', className }: Props) {
  const { user, isLoaded } = useUser();

  if (!isLoaded || !user) return null;

  const avatarUrl = (user.user_metadata?.avatar_url
    || user.user_metadata?.picture
    || null) as string | null;
  const fallbackLetter = (user.email?.[0] || 'U').toUpperCase();
  const avatarSize = size === 'sm' ? 24 : 32;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Cuenta"
          className={cn(
            'flex items-center justify-center rounded-full overflow-hidden bg-muted',
            size === 'sm' ? 'h-6 w-6 sm:h-7 sm:w-7' : 'h-8 w-8',
            className,
          )}
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={avatarSize}
              height={avatarSize}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <span className="text-xs font-semibold text-foreground">
              {fallbackLetter}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="z-50 min-w-[220px] rounded-2xl border border-border bg-popover p-1 shadow-xl"
      >
        <DropdownMenuLabel className="px-3 py-2 text-xs text-muted-foreground truncate">
          {user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 h-px bg-border" />
        <DropdownMenuItem asChild>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-muted cursor-pointer outline-none"
          >
            <UserIcon className="h-4 w-4" />
            Mi panel
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-muted cursor-pointer outline-none text-left"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
