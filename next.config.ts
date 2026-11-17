import type { NextConfig } from "next";

const env = process.env;

const nextConfig: NextConfig = {
  // Supabase added through Vercel's Storage tab may name its keys differently;
  // accept any of them. Both values are public by design (row-level security
  // protects the data), so they're safe to expose to the browser.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      env.SUPABASE_ANON_KEY ??
      env.SUPABASE_PUBLISHABLE_KEY ??
      "",
  },
};

export default nextConfig;
