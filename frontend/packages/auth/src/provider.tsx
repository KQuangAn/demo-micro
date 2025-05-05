"use client";

import { SessionProvider, SessionProviderProps } from "next-auth/react";
export const AuthProvider = (props: SessionProviderProps) => (
  <SessionProvider {...props}>{props?.children}</SessionProvider>
);
