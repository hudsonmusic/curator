# Curator Helper

The Mac app behind curator's **Save for Ableton**. It's a small HTTP server on `127.0.0.1:47533` that downloads a song with yt-dlp, converts and tags it with FFmpeg, and saves it in a folder (default `~/Downloads`). curator talks to it straight from the browser. You can also paste any YouTube or SoundCloud link into it from the menu bar icon (**Save a Link…**, ⌘L); with no song details sent, it reads the artist, title and cover from the page itself. See the main [README](../README.md#save-for-ableton-curator-helper) for what it does for users.

## Layout

```
src/main.ts      HTTP server: status, pairing, downloads, settings
src/jobs.ts      Download queue: yt-dlp → FFmpeg (convert, tags, cover)
src/tags.ts      File names and tags
src/mac.ts       Finder and open at login (LaunchAgent)
src/pages.ts     The helper's own pages: status (/) and allowing a site (/allow)
app/main.swift   The app itself: runs the server, shows the menu bar icon (save a link, folder, format, status, quit),
                 opens curator-helper:// links (Safari) and posts notifications
app/Updater.swift   Updates the app from GitHub releases
app/Progress.swift  Menu bar progress: a ring icon while saving, a progress bar per song
src/paths.ts     Where the bundled tools and settings live
src/config.ts    Settings (~/Library/Application Support/Curator Helper/config.json)
app/             Info.plist and icon for the .app
deps.json        Pinned yt-dlp, FFmpeg, Deno and Bun (URLs + SHA-256)
scripts/build.sh Builds dist/Curator-Helper-mac-{arm64,x64}.dmg
```

## Run from source

```
node src/main.ts
```

Needs `yt-dlp`, `ffmpeg` and a JavaScript runtime (`deno`, `bun` or `node`) on your PATH, or the tools in `vendor/`. For a throwaway test setup: `CURATOR_HELPER_HOME=/tmp/ch CURATOR_HELPER_FOLDER=/tmp/ch/out node src/main.ts`.

## Build

```
bash scripts/build.sh          # arm64 and x64
bash scripts/build.sh arm64    # one
```

The app's own executable (`Contents/MacOS/curator-helper`) is a tiny native Swift app (`app/main.swift`, `app/Updater.swift`): macOS needs a real app, or it reports a background program as "not responding". It shows the menu bar icon and runs the server, `Contents/MacOS/curator-helper-server`, which is the helper compiled with Bun into one executable ( the Intel build uses Bun's baseline target so it runs without AVX), plus `Contents/Resources/bin/yt-dlp`, `ffmpeg` and `deno`. yt-dlp uses Deno as its JavaScript runtime for YouTube. If Deno were missing, the helper falls back to its own executable with `BUN_BE_BUN=1` (a Bun-compiled program then behaves as `bun`), though yt-dlp has deprecated Bun. On first run yt-dlp is copied to `~/Library/Application Support/Curator Helper/bin` so it can update itself (`yt-dlp -U`, daily).

Each build ends as a disk image (`dist/Curator-Helper-mac-<arch>.dmg`) holding the app and an Applications shortcut. The names never change, so `https://github.com/hudsonmusic/curator/releases/latest/download/Curator-Helper-mac-<arch>.dmg` always points at the newest release; curator's Settings links there, picking Apple silicon or Intel from the browser.

The app is signed ad hoc (`codesign -s -`), not notarized, so the first time people open it macOS blocks it: System Settings → Privacy & Security → Open Anyway (macOS 15+), or right-click → Open (macOS 14 and earlier).

## Releasing an update

1. Bump `version` in `package.json`.
2. To update a bundled tool, change its URL/version in `deps.json` and clear its `sha256`; the build prints the new checksum to pin.
3. `bash scripts/build.sh`.
4. Publish it (the newest release must be the helper's, since the download links use `releases/latest`):
   `gh release create helper-v<version> --title "Curator Helper <version>" --latest dist/Curator-Helper-mac-arm64.dmg dist/Curator-Helper-mac-x64.dmg`
5. Set `HELPER_LATEST` in the site's `lib/helper.ts` to the new version, so Settings tells people an update is out.

Installed copies (1.2+) pick the release up by themselves within a few hours.

## Auto-update

`app/Updater.swift`, 20 seconds after launch and then every 6 hours:

1. Lists `https://api.github.com/repos/hudsonmusic/curator/releases` and takes the newest non-draft, non-prerelease `helper-v*` release that has `Curator-Helper-mac-<arm64|x64>.dmg` for this build's architecture.
2. If it's newer than the running version (and **Install Updates Automatically** is on, the default), waits until no download is in progress, downloads the image and checks it against the asset's GitHub `digest` (SHA-256).
3. Mounts it and checks the app inside: same bundle id, a newer version, and a valid signature (`codesign --verify`).
4. Copies it next to the installed app, quits, and a small script swaps the two (rolling back if the move fails) and opens the new one, which says "Curator Helper updated".

If the app's folder isn't writable (e.g. not an admin), it opens the release page instead. To test without publishing: `defaults write app.curator.helper updateFeed file:///path/to/feed.json`, where the file is a releases list in GitHub's format whose `browser_download_url` points at a local `.dmg`; `defaults delete app.curator.helper updateFeed` to go back.

## API

All JSON. Everything except `GET /status` needs the calling site to be allowed: curator opens `/allow?origin=…`, the helper's own page, where you press Allow (a one-time token stops other sites submitting it). `localhost` sites are always allowed. The helper uses no AppleScript (macOS would show that as Script Editor).

| Route | |
|---|---|
| `GET /status` | `{ app, version, paired, folder?, format?, openAtLogin?, ytDlp? }` |
| `GET /` | Status page |
| `GET /allow?origin=…` | Page to allow a site |
| `POST /disconnect` | Forget the calling site |
| `POST /download` | `{ url, meta: { title, artist, year, label, genre, bpm, key, camelot, artwork, source } }` → `{ job }`. Instead of `url`, `resolve` can point at curator's `/api/youtube?artist=…&title=…` (only that path; only a video id is read back) |
| `GET /jobs/:id`, `GET /jobs` | Progress: `state` (queued, downloading, converting, done, error), `progress` 0–1, `file`, `error` |
| `POST /reveal` | `{ id }` → show the saved file in Finder |
| `POST /open-folder` | Open the folder in Finder |
| `POST /folder` | `{ folder: "~/Downloads" }` (inside your home folder) or `{ preset: "userLibrary" }` |
| `POST /settings` | `{ format?: "aiff" \| "wav" \| "mp3", openAtLogin?: boolean }` |
| `POST /update-ytdlp` | Run `yt-dlp -U` |
| `POST /quit` | Quit |

## Safari: curator-helper:// links

Safari blocks a secure (https) site from calling the helper's local http address, so in Safari curator opens `curator-helper://save?d=<base64url JSON>` instead, with `{ url?, resolve?, meta }` (the same as `POST /download`). The app (registered for the scheme in `Info.plist`) starts if needed, waits for the server, posts the download, follows it, and shows a notification when it's saved (clicking it shows the file in Finder). The link has to open straight from the click, so when curator doesn't know the song's video yet it sends `resolve` and the helper asks curator which video it is.
