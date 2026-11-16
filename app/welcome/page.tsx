"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import type { Track } from "@/lib/types";
import { useProfile } from "@/lib/profile";
import { usePlayer } from "@/components/player";
import { Artwork } from "@/components/artwork";
import { Equalizer } from "@/components/equalizer";
import { References, SceneChooser, TypeAndTempo } from "@/components/taste";
import { Eyebrow, Headline } from "@/components/ui";

const STEPS = ["intro", "scenes", "types", "refs", "swipe", "build"] as const;

export default function Welcome() {
  const [step, setStep] = useState(0);
  const { profile, update, ready } = useProfile();
  const router = useRouter();
  const player = usePlayer();
  const name = STEPS[step];
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  useEffect(() => {
    if (name !== "build") return;
    player.pause();
    const id = setTimeout(() => {
      update({ onboarded: true });
      router.push("/");
    }, 2200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  if (!ready) return null;
  const canNext = name !== "scenes" || profile.scenes.length > 0;

  return (
    <div className="flex min-h-dvh flex-col pt-8">
      <div className="flex items-center justify-between">
        <span className="font-display text-[1.75rem] italic leading-none">
          curator<span className="text-acid">.</span>
        </span>
        {step > 0 && name !== "build" && (
          <div className="flex gap-1.5">
            {STEPS.slice(1, -1).map((s, i) => (
              <motion.span
                key={s}
                animate={{ width: i + 1 === step ? 28 : 8, backgroundColor: i + 1 <= step ? "#d7ff45" : "#262622" }}
                className="h-2 rounded-full"
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-center py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={name}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16, transition: { duration: 0.2 } }}
            transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {name === "intro" && (
              <div className="max-w-3xl">
                <Eyebrow>For DJs who sample</Eyebrow>
                <Headline className="mt-4 text-7xl sm:text-9xl">Samples, dug for you.</Headline>
                <p className="mt-8 max-w-md text-lg text-mute">
                  Tell curator what you play. It finds records worth chopping, acapellas and loops, with BPM, key and the best bars
                  to loop already marked.
                </p>
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={next}
                  className="mt-10 rounded-full bg-acid px-7 py-3.5 font-medium text-ink"
                >
                  Start digging →
                </motion.button>
              </div>
            )}

            {name === "scenes" && (
              <Step title="Where do you dig?" sub="Pick every scene you pull samples from. You can change this later.">
                <SceneChooser />
              </Step>
            )}

            {name === "types" && (
              <Step title="What are you after?" sub="And the tempos you live in.">
                <TypeAndTempo />
              </Step>
            )}

            {name === "refs" && (
              <Step title="Play me something of yours." sub="Optional. Drop a few of your tracks so curator knows your keys and tempos.">
                <References />
              </Step>
            )}

            {name === "swipe" && (
              <Step title="Quick ear test." sub="Swipe right on what you'd sample, left on what you'd skip. Arrow keys work too.">
                <SwipeDeck onDone={next} />
              </Step>
            )}

            {name === "build" && (
              <div className="grid place-items-center text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
                  className="relative size-28 rounded-full bg-[repeating-radial-gradient(circle,#151513_0_2px,#1d1d1a_2px_4px)] ring-1 ring-line"
                >
                  <span className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-acid" />
                  <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" />
                </motion.div>
                <Headline className="mt-10 text-5xl sm:text-6xl">Pulling your first crate</Headline>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {step > 0 && name !== "build" && (
        <div className="sticky bottom-0 flex items-center justify-between border-t border-line bg-ink/80 py-5 backdrop-blur">
          <button onClick={back} className="text-sm text-mute hover:text-paper">
            ← Back
          </button>
          <button
            onClick={next}
            disabled={!canNext}
            className="rounded-full bg-paper px-6 py-2.5 text-sm font-medium text-ink transition-opacity disabled:opacity-30"
          >
            {name === "refs" && !profile.references.length ? "Skip" : name === "swipe" ? "Finish" : "Continue"}
          </button>
        </div>
      )}
    </div>
  );
}

function Step({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <Headline className="text-5xl sm:text-7xl">{title}</Headline>
      <p className="mt-4 max-w-lg text-mute">{sub}</p>
      <div className="mt-10">{children}</div>
    </div>
  );
}

function SwipeDeck({ onDone }: { onDone: () => void }) {
  const { profile, signal } = useProfile();
  const player = usePlayer();
  const [cards, setCards] = useState<Track[] | null>(null);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const current = cards?.[i];

  useEffect(() => {
    fetch("/api/crate", {
      method: "POST",
      body: JSON.stringify({ scenes: profile.scenes, types: ["song"], seed: `onboard:${Date.now()}`, size: 12 }),
    })
      .then((r) => r.json())
      .then(({ tracks }: { tracks: Track[] }) => setCards(tracks.filter((t) => t.audioUrl)))
      .catch(() => setCards([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (current) player.play(current, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const decide = (like: boolean) => {
    if (!current) return;
    signal(like ? "like" : "pass", current);
    setDir(like ? 1 : -1);
    if (i + 1 >= (cards?.length ?? 0)) {
      player.pause();
      setI(i + 1);
      setTimeout(onDone, 350);
    } else setI(i + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") decide(true);
      if (e.key === "ArrowLeft") decide(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!cards) {
    return <div className="mx-auto aspect-[4/5] w-full max-w-sm animate-pulse rounded-3xl bg-panel ring-1 ring-line" />;
  }
  if (!cards.length) return <p className="text-mute">Couldn&apos;t load records right now. Hit Finish to continue.</p>;

  return (
    <div className="flex flex-col items-center">
      <div className="relative aspect-[4/5] w-full max-w-[min(24rem,42dvh)]">
        <AnimatePresence custom={dir}>
          {cards.slice(i, i + 3).map((t, k) =>
            k === 0 ? (
              <TopCard key={t.id} track={t} onDecide={decide} playing={player.isPlaying(t.id)} />
            ) : (
              <motion.div
                key={t.id}
                initial={false}
                animate={{ scale: 1 - k * 0.05, y: k * 18, opacity: 1 - k * 0.25 }}
                className="absolute inset-0 overflow-hidden rounded-3xl ring-1 ring-line"
                style={{ zIndex: 10 - k }}
              >
                <Artwork track={t} big />
              </motion.div>
            ),
          )}
        </AnimatePresence>
      </div>
      <div className="mt-8 flex items-center gap-6">
        <button onClick={() => decide(false)} className="grid size-14 place-items-center rounded-full border border-line text-xl text-mute transition-colors hover:border-paper hover:text-paper" aria-label="Skip">
          ✕
        </button>
        <span className="font-mono text-xs text-mute">
          {Math.min(i + 1, cards.length)} / {cards.length}
        </span>
        <button onClick={() => decide(true)} className="grid size-14 place-items-center rounded-full bg-acid text-xl text-ink transition-transform hover:scale-105" aria-label="Would sample">
          ♥
        </button>
      </div>
    </div>
  );
}

function TopCard({ track, onDecide, playing }: { track: Track; onDecide: (like: boolean) => void; playing: boolean }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-14, 14]);
  const yes = useTransform(x, [30, 130], [0, 1]);
  const no = useTransform(x, [-130, -30], [1, 0]);

  return (
    <motion.div
      className="absolute inset-0 z-20 cursor-grab overflow-hidden rounded-3xl shadow-2xl shadow-black/60 ring-1 ring-line active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragSnapToOrigin
      dragElastic={0.9}
      onDragEnd={(_, info: PanInfo) => {
        if (info.offset.x > 110 || info.velocity.x > 600) onDecide(true);
        else if (info.offset.x < -110 || info.velocity.x < -600) onDecide(false);
      }}
      initial={{ scale: 0.95, y: 18 }}
      animate={{ scale: 1, y: 0 }}
      variants={{ gone: (d: number) => ({ x: d * 520, rotate: d * 24, opacity: 0, transition: { duration: 0.35 } }) }}
      exit="gone"
    >
      <div className="pointer-events-none size-full">
        <Artwork track={track} big />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
      <motion.div style={{ opacity: yes }} className="pointer-events-none absolute left-5 top-5 -rotate-12 rounded-lg border-2 border-acid px-3 py-1 font-mono text-lg font-bold uppercase text-acid">
        sample
      </motion.div>
      <motion.div style={{ opacity: no }} className="pointer-events-none absolute right-5 top-5 rotate-12 rounded-lg border-2 border-paper px-3 py-1 font-mono text-lg font-bold uppercase">
        skip
      </motion.div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-6">
        {playing && <Equalizer className="mb-3" />}
        <div className="font-display text-3xl leading-tight">{track.title}</div>
        <div className="mt-1 text-paper/70">{track.artist}</div>
        <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-paper/50">
          {track.year} · {track.genre}
        </div>
      </div>
    </motion.div>
  );
}
