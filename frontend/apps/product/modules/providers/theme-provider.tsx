"use client";

import { ThemeProvider, ThemeProviderProps } from "next-themes";
import { useState, useEffect } from "react";

export default function Providers({
  children,
  ...args
}: {
  children: React.ReactNode;
  args: ThemeProviderProps;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeProvider attribute="class" {...args}>
      {children}
    </ThemeProvider>
  );
}
