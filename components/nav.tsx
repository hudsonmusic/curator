"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const LINKS = [
  { href: "/", label: "Crate" },
  { href: "/dig", label: "Dig" },
  { href: "/saved", label: "Saved" },
  { href: "/profile", label: "Taste" },
];

export function Nav() {
  const path = usePathname();
  if (path.startsWith("/welcome")) return null;
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-ink/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <Link href="/" className="font-display text-[1.75rem] italic leading-none tracking-tight">
          curator<span className="text-acid">.</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={`relative rounded-full px-3.5 py-1.5 transition-colors ${active ? "text-ink" : "text-mute hover:text-paper"}`}>
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-paper"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{l.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
