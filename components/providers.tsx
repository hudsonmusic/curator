"use client";

import type { ReactNode } from "react";
import { ProfileProvider } from "@/lib/profile";
import { SheetProvider } from "./sheet";
import { PlayerProvider } from "./player";
import { RadioProvider } from "./radio";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <SheetProvider>
        <PlayerProvider>
          <RadioProvider>{children}</RadioProvider>
        </PlayerProvider>
      </SheetProvider>
    </ProfileProvider>
  );
}
