import { ModalProvider } from "../modules/providers/modal-provider";
import { ToastProvider } from "../modules/providers/toast-provider";
import { Inter } from "next/font/google";

import "./globals.css";
import Header from "../modules/components/native/nav/parent";
import Footer from "../modules/components/native/Footer";
import ThemeProvider from "../modules/providers/theme-provider";

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
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ToastProvider />
          <ModalProvider />
          <Header />
          <div className="px-[1.4rem] md:px-[4rem] lg:px-[6rem] xl:px-[8rem] 2xl:px-[12rem]">
            {children}
          </div>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
