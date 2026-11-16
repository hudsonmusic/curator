"use client";

import { useEffect, useState } from "react";

export interface Config {
  youtube: boolean;
  freesound: boolean;
}

let cached: Promise<Config> | null = null;

export function useConfig(): Config | null {
  const [c, setC] = useState<Config | null>(null);
  useEffect(() => {
    cached ??= fetch("/api/config")
      .then((r) => r.json() as Promise<Config>)
      .catch(() => ({ youtube: false, freesound: false }));
    void cached.then(setC);
  }, []);
  return c;
}
