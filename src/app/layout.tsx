import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ServiceWorkerCleanup } from "@/components/shared/service-worker-cleanup";
import { env } from "@/lib/env";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: env.NEXT_PUBLIC_APP_NAME,
  description: "Sistema administrativo para gestion de prestaciones odontologicas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <ServiceWorkerCleanup />
        {children}
      </body>
    </html>
  );
}
