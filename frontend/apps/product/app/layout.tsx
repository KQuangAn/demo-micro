import { ModalProvider } from "../modules/providers/modal-provider";
import { ToastProvider } from "../modules/providers/toast-provider";
import { Inter } from "next/font/google";
import React from "react";
import "./globals.css";
import Header from "../modules/components/native/nav/parent";
import Footer from "../modules/components/native/Footer";
import ThemeProvider from "../modules/providers/theme-provider";
import ApolloProviders from "../modules/providers/theme-provider copy";
import { AuthProvider, getAuth, signIn, signOut } from "@repo/auth";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Store",
  description: "E-Commerce Store",
  keywords: ["E-Commerce", "Store", "Shop"],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuth();
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider session={session}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <ToastProvider />
            <ModalProvider />
            <Header />
            <div className="px-[1.4rem] md:px-[4rem] lg:px-[6rem] xl:px-[8rem] 2xl:px-[12rem]">
              <ApolloProviders>{children}</ApolloProviders>
            </div>
            <Footer />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
