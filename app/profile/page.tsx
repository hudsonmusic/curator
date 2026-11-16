"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useProfile } from "@/lib/profile";
import { SCENES } from "@/lib/scenes";
import { useConfig } from "@/lib/config";
import { References, SceneChooser, TypeAndTempo } from "@/components/taste";
import { Eyebrow, Headline } from "@/components/ui";

export default function TastePage() {
  const { ready, profile, reset } = useProfile();
  const config = useConfig();
  const router = useRouter();
  if (!ready) return null;

  const topArtists = Object.entries(profile.artistWeights)
    .filter(([, v]) => v.w > 0)
    .sort((a, b) => b[1].w - a[1].w)
    .slice(0, 12);
  const sceneW = SCENES.map((s) => ({ s, w: profile.sceneWeights[s.id] ?? 0 })).filter((x) => profile.scenes.includes(x.s.id) || x.w !== 0);
  const maxW = Math.max(1, ...sceneW.map((x) => Math.abs(x.w)));

  return (
    <div className="pt-12 sm:pt-16">
      <Eyebrow>What curator knows about you</Eyebrow>
      <Headline className="mt-3 text-6xl sm:text-8xl">Taste</Headline>

      <section className="mt-14 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl italic">Learned so far</h2>
          <p className="mt-1 text-sm text-mute">Saves, chop points, plays and passes all move these.</p>
          <div className="mt-6 space-y-3">
            {sceneW.map(({ s, w }, i) => (
              <div key={s.id} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-sm">
                <span className="truncate">{s.name}</span>
                <div className="relative h-1.5 overflow-hidden rounded-full bg-line">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(Math.max(0, w) / maxW) * 100}%` }}
                    transition={{ delay: i * 0.05, type: "spring", stiffness: 120, damping: 20 }}
                    className="absolute inset-y-0 left-0 rounded-full bg-acid"
                  />
                </div>
                <span className={`text-right font-mono text-xs ${w < 0 ? "text-mute" : ""}`}>{w.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-display text-3xl italic">Artists you keep coming back to</h2>
          {topArtists.length ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {topArtists.map(([a, v]) => (
                <span key={a} className="rounded-full border border-line px-3 py-1.5 text-sm">
                  {a} <span className="font-mono text-xs text-acid">{v.w.toFixed(1)}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-mute">Save a few records and they&apos;ll show up here.</p>
          )}
        </div>
      </section>

      <section className="mt-20">
        <h2 className="font-display text-3xl italic">Scenes</h2>
        <div className="mt-6">
          <SceneChooser />
        </div>
      </section>

      <section className="mt-20">
        <h2 className="font-display text-3xl italic">What you&apos;re digging for</h2>
        <div className="mt-6">
          <TypeAndTempo />
        </div>
      </section>

      <section className="mt-20">
        <h2 className="font-display text-3xl italic">Reference tracks</h2>
        <p className="mt-1 text-sm text-mute">Finds in a compatible key get highlighted.</p>
        <div className="mt-6">
          <References />
        </div>
      </section>

      <section className="mt-20 grid gap-6 border-t border-line pt-10 sm:grid-cols-2">
        <div>
          <Eyebrow>Connections</Eyebrow>
          <ul className="mt-3 space-y-1.5 font-mono text-xs">
            <li>Apple Music catalog · <span className="text-acid">on</span></li>
            <li>ccMixter acapellas · <span className="text-acid">on</span></li>
            <li>YouTube full tracks · {config?.youtube ? <span className="text-acid">on</span> : <span className="text-mute">add YOUTUBE_API_KEY</span>}</li>
            <li>Freesound loops & vocals · {config?.freesound ? <span className="text-acid">on</span> : <span className="text-mute">add FREESOUND_API_KEY</span>}</li>
          </ul>
        </div>
        <div className="sm:text-right">
          <button
            onClick={() => {
              if (confirm("Reset your taste profile, saved tracks and chop points?")) {
                reset();
                router.push("/welcome");
              }
            }}
            className="rounded-full border border-line px-4 py-2 text-sm text-mute transition-colors hover:border-red-400 hover:text-red-300"
          >
            Start over
          </button>
        </div>
      </section>
    </div>
  );
}
