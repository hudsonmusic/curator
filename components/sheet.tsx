"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Track } from "@/lib/types";

interface SheetCtx {
  track: Track | null;
  open: (t: Track) => void;
  close: () => void;
}

const Ctx = createContext<SheetCtx | null>(null);

export function SheetProvider({ children }: { children: ReactNode }) {
  const [track, setTrack] = useState<Track | null>(null);
  const open = useCallback((t: Track) => setTrack(t), []);
  const close = useCallback(() => setTrack(null), []);
  const value = useMemo(() => ({ track, open, close }), [track, open, close]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSheet() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSheet outside provider");
  return c;
}
