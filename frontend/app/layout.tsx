import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { GameProvider } from "@/lib/game-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const boldPixels = localFont({
  src: "../public/fonts/BoldPixels.ttf",
  variable: "--font-bold-pixels",
  weight: "400",
  style: "normal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Survive the Feissari",
  description: "A survival game adventure",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="apple-mobile-web-app-title" content="Feissari" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${boldPixels.variable} antialiased`}
      >
        <GameProvider>
          {children}
        </GameProvider>
      </body>
    </html>
  );
}
