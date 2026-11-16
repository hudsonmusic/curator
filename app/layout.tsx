import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { TrackSheet } from "@/components/track-sheet";
import { PlayerBar } from "@/components/player";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "curator",
  description: "Find samples fast.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} min-h-dvh font-sans antialiased`}>
        <Providers>
          {children}
          <TrackSheet />
          <PlayerBar />
        </Providers>
      </body>
    </html>
  );
}
