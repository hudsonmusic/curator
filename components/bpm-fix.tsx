"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/types";
import { bpmFixOf, getEntry, useAnalysisVersion } from "@/lib/analysis-store";
import { useProfile } from "@/lib/profile";

/** Average tempo from taps; a pause of 2s starts a fresh count. */
function useTapTempo(onBpm: (bpm: number) => void) {
  const taps = useRef<number[]>([]);
  const [count, setCount] = useState(0);
  const tap = () => {
    const now = performance.now();
    const t = taps.current;
    if (t.length && now - t[t.length - 1] > 2000) t.length = 0;
    t.push(now);
    if (t.length > 9) t.shift();
    setCount(t.length);
    if (t.length >= 3) {
      const gaps = t.slice(1).map((x, i) => x - t[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      onBpm(Math.round((60000 / avg) * 10) / 10);
    }
  };
  return { tap, count };
}

/**
 * Fix a song's BPM when detection gets it wrong: halve, double, tap along or type it.
 * The fix is saved (and synced to your account) and used everywhere, Sync included.
 */
export function BpmFix({ track, onClose }: { track: Track; onClose?: () => void }) {
  useAnalysisVersion();
  const { fixBpm } = useProfile();
  const fixed = bpmFixOf(track.id);
  const detected = getEntry(track.id)?.data?.bpm ?? track.sourceBpm;
  const current = fixed ?? detected;
  const [text, setText] = useState(current ? String(Math.round(current * 10) / 10) : "");
  const [tapped, setTapped] = useState<number | null>(null);
  const { tap, count } = useTapTempo(setTapped);

  useEffect(() => {
    setText(current ? String(Math.round(current * 10) / 10) : "");
  }, [current]);

  const set = (bpm: number | undefined) => fixBpm(track.id, bpm && bpm >= 30 && bpm <= 300 ? bpm : undefined);

  return (
    <div className="space-y-3 rounded-xl border border-line bg-white/[0.04] p-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-mute">
          {fixed ? (
            <>
              Fixed to <span className="font-mono text-paper">{fixed}</span>
              {detected ? <> · detected {Math.round(detected)}</> : null}
            </>
          ) : detected ? (
            <>
              Detected <span className="font-mono text-paper">{Math.round(detected * 10) / 10}</span>
            </>
          ) : (
            "No BPM yet"
          )}
        </span>
        {onClose && (
          <button onClick={onClose} className="text-mute hover:text-paper">
            Done
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button className="btn" disabled={!current} onClick={() => current && set(current / 2)} title="Half time">
          ½
        </button>
        <button className="btn" disabled={!current} onClick={() => current && set(current * 2)} title="Double time">
          ×2
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            set(parseFloat(text));
          }}
          className="flex items-center gap-1"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
            onKeyDown={(e) => e.stopPropagation()}
            inputMode="decimal"
            aria-label="BPM"
            className="field h-7 w-16 text-center font-mono"
          />
          <button className="btn">Set</button>
        </form>
        {fixed !== undefined && (
          <button className="btn text-mute" onClick={() => set(undefined)} title="Go back to the detected BPM">
            Reset
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={tap}
          className="h-10 flex-1 rounded-lg bg-white/[0.08] text-[13px] font-medium transition-[background-color,transform] duration-75 active:scale-[0.98] active:bg-accent active:text-onaccent"
        >
          Tap along{count > 0 ? ` · ${count}` : ""}
        </button>
        <button className="btn h-10 px-3" disabled={!tapped} onClick={() => tapped && set(tapped)}>
          Use {tapped ? <span className="font-mono">{tapped}</span> : "—"}
        </button>
      </div>
    </div>
  );
}
