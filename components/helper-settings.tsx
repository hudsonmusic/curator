"use client";

import { useState, type ReactNode } from "react";
import { useProfile } from "@/lib/profile";
import {
  HELPER_DOWNLOAD,
  HELPER_LATEST,
  chooseHelperFolder,
  olderThan,
  openHelperFolder,
  pairHelper,
  quitHelper,
  refreshHelper,
  setHelperSettings,
  updateYtDlp,
  type HelperFormat,
} from "@/lib/helper";
import { useAbleton } from "./ableton";
import { Segmented } from "./segmented";
import { toast } from "./toast";

const FORMAT_NOTE: Record<HelperFormat, string> = {
  aiff: "Lossless, with every tag and the cover (recommended)",
  wav: "Lossless; title, artist, year and genre only (WAV can't hold BPM, key or a cover)",
  mp3: "Smaller files, with every tag and the cover",
};

/** Settings for "Save for Ableton" and the Curator Helper Mac app. */
export function HelperSettings({
  Row,
  Toggle,
}: {
  Row: (p: { label: string; sub?: ReactNode; children: ReactNode }) => ReactNode;
  Toggle: (p: { on: boolean; set: (v: boolean) => void; label: string }) => ReactNode;
}) {
  const { profile, update } = useProfile();
  const { status } = useAbleton();
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : "The helper didn't answer.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Row label="Save for Ableton" sub="Download songs as tagged audio files (BPM, key, label, cover) with the Curator Helper Mac app">
        <Toggle on={profile.helper} set={(v) => update({ helper: v })} label="Save for Ableton" />
      </Row>
      {profile.helper && (
        <>
          {status === undefined ? (
            <p className="text-[12px] text-mute">Looking for the helper…</p>
          ) : status === null ? (
            <div className="rounded-xl bg-white/[0.04] p-3 text-[12px] text-mute">
              <p className="text-[13px] text-paper/90">Curator Helper isn&apos;t running on this Mac.</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>
                  <a href={HELPER_DOWNLOAD} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
                    Download Curator Helper
                  </a>{" "}
                  (Apple silicon or Intel) and unzip it into Applications.
                </li>
                <li>The first time, right-click it and choose Open (it isn&apos;t from the App Store).</li>
                <li>Come back here and press Connect.</li>
              </ol>
              <button onClick={() => void act("check", refreshHelper)} className="btn mt-3">
                {busy === "check" ? "Checking…" : "Check again"}
              </button>
            </div>
          ) : !status.paired ? (
            <Row label="Connect this site" sub="Curator Helper will ask you to allow it in a Mac dialog">
              <button
                onClick={() => void act("pair", async () => toast((await pairHelper()) ? "Connected to Curator Helper." : "Not connected."))}
                className="btn btn-on"
              >
                {busy === "pair" ? "Waiting for you…" : "Connect"}
              </button>
            </Row>
          ) : (
            <>
              <Row
                label="Curator Helper"
                sub={
                  <>
                    Connected · version {status.version}
                    {status.ytDlp ? ` · yt-dlp ${status.ytDlp}` : ""}
                    {olderThan(status.version, HELPER_LATEST) && (
                      <>
                        {" · "}
                        <a href={HELPER_DOWNLOAD} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                          version {HELPER_LATEST} is out
                        </a>
                      </>
                    )}
                  </>
                }
              >
                <button onClick={() => void act("quit", quitHelper)} className="btn text-mute">
                  Quit
                </button>
              </Row>
              <Row label="Folder" sub={<span className="break-all font-mono text-[11px]">{status.folder}</span>}>
                <div className="flex gap-1.5">
                  <button onClick={() => void act("open", openHelperFolder)} className="btn">
                    Open
                  </button>
                  <button onClick={() => void act("folder", chooseHelperFolder)} className="btn">
                    {busy === "folder" ? "Choosing…" : "Change…"}
                  </button>
                </div>
              </Row>
              <Row label="Format" sub={FORMAT_NOTE[status.format ?? "aiff"]}>
                <Segmented
                  value={status.format ?? "aiff"}
                  options={[
                    { id: "aiff", label: "AIFF" },
                    { id: "wav", label: "WAV" },
                    { id: "mp3", label: "MP3" },
                  ]}
                  onChange={(format) => void act("format", () => setHelperSettings({ format }))}
                />
              </Row>
              <Row label="Open at login" sub="Start Curator Helper when you log in to this Mac">
                <Toggle on={!!status.openAtLogin} set={(v) => void act("login", () => setHelperSettings({ openAtLogin: v }))} label="Open at login" />
              </Row>
              <Row label="Update yt-dlp" sub="The downloader updates itself daily; do it now if downloads start failing">
                <button
                  onClick={() => void act("yt", async () => toast((await updateYtDlp()).message || "Done."))}
                  className="btn"
                >
                  {busy === "yt" ? "Updating…" : "Update"}
                </button>
              </Row>
              <p className="text-[12px] text-mute">
                Tip: drag the folder into the <span className="text-paper/80">Places</span> list in Ableton&apos;s browser. Saved songs show up there,
                named with their BPM and key, ready to drop into your set. Use the ⤓ button on a song, its menu, or press A.
              </p>
            </>
          )}
        </>
      )}
    </>
  );
}
