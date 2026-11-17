import type { Metadata } from "next";

export const metadata: Metadata = { title: "Shared crate · curator" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
