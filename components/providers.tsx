"use client";

import type { ReactNode } from "react";
import { ProfileProvider } from "@/lib/profile";
import { SheetProvider } from "./sheet";
import { PlayerProvider } from "./player";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <SheetProvider>
        <PlayerProvider>{children}</PlayerProvider>
      </SheetProvider>
    </ProfileProvider>
  );
}
