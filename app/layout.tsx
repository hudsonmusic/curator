import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Nav } from "@/components/nav";
import { TrackSheet } from "@/components/track-sheet";
import { PlayerBar } from "@/components/player";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "curator",
  description: "Samples, dug for you.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} ${serif.variable} min-h-dvh font-sans antialiased`}>
        <Providers>
          <Nav />
          <main className="mx-auto max-w-7xl px-4 pb-40 sm:px-8">{children}</main>
          <TrackSheet />
          <PlayerBar />
        </Providers>
      </body>
    </html>
  );
}
