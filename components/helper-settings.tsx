"use client";

import { useState, type ReactNode } from "react";
import { useProfile } from "@/lib/profile";
import {
  HELPER_DOWNLOAD,
  HELPER_LATEST,
  connectHelper,
  disconnectHelper,
  olderThan,
  openHelperFolder,
  setHelperFolder,
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
  mp3: "Every tag and the cover, small files (recommended)",
  aiff: "Lossless, with every tag and the cover; bigger files",
  wav: "Lossless; title, artist, year and genre only (WAV can't hold BPM, key or a cover)",
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
  const [editingFolder, setEditingFolder] = useState(false);
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
      <Row label="Save for Ableton" sub={profile.helper ? "On: songs get a Save for Ableton button" : "Off: no buttons, and curator never contacts the helper"}>
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
                <li>Open it (the first time: right-click → Open). A ⤓ icon appears in your menu bar.</li>
                <li>Come back here and press Connect, then Allow on the page that opens.</li>
              </ol>
              <button onClick={() => void act("check", refreshHelper)} className="btn mt-3">
                {busy === "check" ? "Checking…" : "Check again"}
              </button>
            </div>
          ) : !status.paired ? (
            <Row label="Connect this site" sub="Opens a Curator Helper page in a new tab where you press Allow">
              <button
                onClick={() => void act("pair", async () => toast((await connectHelper()) ? "Connected to Curator Helper." : "Not connected."))}
                className="btn btn-on"
              >
                {busy === "pair" ? "Waiting for Allow…" : "Connect"}
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
                <div className="flex gap-1.5">
                  <button onClick={() => void act("disconnect", disconnectHelper)} className="btn text-mute" title="Stop this site from sending songs">
                    Disconnect
                  </button>
                  <button onClick={() => void act("quit", quitHelper)} className="btn text-mute">
                    Quit
                  </button>
                </div>
              </Row>
              <Row label="Folder" sub={<span className="break-all font-mono text-[11px]">{status.folder}</span>}>
                <div className="flex gap-1.5">
                  <button onClick={() => void act("open", openHelperFolder)} className="btn">
                    Open
                  </button>
                  <button onClick={() => setEditingFolder((e) => !e)} className={`btn ${editingFolder ? "btn-on" : ""}`}>
                    Change
                  </button>
                </div>
              </Row>
              {editingFolder && (
                <FolderPicker
                  current={status.folder ?? ""}
                  userLibrary={!!status.userLibrary}
                  onPick={(f) =>
                    void act("folder", async () => {
                      const r = await setHelperFolder(f);
                      toast(`Saving to ${r.folder}`);
                      setEditingFolder(false);
                    })
                  }
                />
              )}
              <Row label="Format" sub={FORMAT_NOTE[status.format ?? "mp3"]}>
                <Segmented
                  value={status.format ?? "mp3"}
                  options={[
                    { id: "mp3", label: "MP3" },
                    { id: "aiff", label: "AIFF" },
                    { id: "wav", label: "WAV" },
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

/** Pick where songs go: a few common spots, or any folder in your home folder. */
function FolderPicker({ current, userLibrary, onPick }: { current: string; userLibrary: boolean; onPick: (f: string | { preset: "userLibrary" }) => void }) {
  const [text, setText] = useState(current.replace(/^\/Users\/[^/]+/, "~"));
  const presets: [string, string | { preset: "userLibrary" }][] = [
    ["Downloads", "~/Downloads"],
    ["Music/curator", "~/Music/curator"],
    ["Desktop", "~/Desktop"],
    ...(userLibrary ? ([["Ableton User Library", { preset: "userLibrary" }]] as [string, { preset: "userLibrary" }][]) : []),
  ];
  return (
    <div className="space-y-2 rounded-xl bg-white/[0.04] p-3">
      <div className="flex flex-wrap gap-1.5">
        {presets.map(([label, value]) => (
          <button key={label} onClick={() => onPick(value)} className="btn rounded-full px-3">
            {label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onPick(text.trim());
        }}
        className="flex gap-1.5"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="~/Music/samples/curator"
          spellCheck={false}
          className="field h-8 min-w-0 flex-1 px-2.5 font-mono text-[12px]"
        />
        <button className="btn btn-on">Use</button>
      </form>
      <p className="text-[11px] text-mute">You can also pick one with Change Save Folder… in the helper&apos;s menu bar icon. Any folder in your home folder. It&apos;s created if it doesn&apos;t exist. Ableton&apos;s User Library puts songs in Samples/curator.</p>
    </div>
  );
}
