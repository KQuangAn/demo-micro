'use client';

import {
  ListOrderedIcon,
  LogInIcon,
  MoonIcon,
  ShoppingBasketIcon,
  SunIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { CommandMenu } from '../../composites/command';
import { Button } from '../../ui/button';
import { MainNav } from './desktop';
import { MobileNav } from './mobile';
import { UserNav } from './user';

export default function Header() {
  return (
    <header className="supports-backdrop-blur:bg-background/90 sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur mb-4 px-[1.4rem] md:px-[4rem] lg:px-[6rem] xl:px-[8rem] 2xl:px-[12rem]">
      <div className="flex h-14 items-center">
        <MainNav />
        <MobileNav />
        <div className="flex flex-1 items-center space-x-2 justify-end">
          <div className="flex-none">
            <CommandMenu />
          </div>
          <CartNav />
          <ViewOrders />
          <ThemeToggle />
          <UserNav />
          <LoginDialog />
        </div>
      </div>
    </header>
  );
}

export function CartNav() {
  return (
    <Link href="/cart">
      <Button size="icon" variant="outline" className="h-9">
        <ShoppingBasketIcon className="h-4" />
      </Button>
    </Link>
  );
}

export function ViewOrders() {
  return (
    <Link href="/orders">
      <Button size="icon" variant="outline" className="h-9">
        <ListOrderedIcon className="h-4" />
      </Button>
    </Link>
  );
}

function LoginDialog() {
  return (
    <Link href="/login">
      <Button className="font-medium flex gap-2">
        <LogInIcon className="h-4" />
        <p>Login</p>
      </Button>
    </Link>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      {resolvedTheme === 'dark' ? (
        <SunIcon className="h-4" />
      ) : (
        <MoonIcon className="h-4" />
      )}
    </Button>
  );
}
