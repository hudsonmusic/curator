# Curator Helper

The Mac app behind curator's **Save for Ableton**. It's a small HTTP server on `127.0.0.1:47533` that downloads a song with yt-dlp, converts and tags it with FFmpeg, and saves it in a folder (default `~/Music/curator`). curator talks to it straight from the browser. See the main [README](../README.md#save-for-ableton-curator-helper) for what it does for users.

## Layout

```
src/main.ts      HTTP server: status, pairing, downloads, settings
src/jobs.ts      Download queue: yt-dlp → FFmpeg (convert, tags, cover)
src/tags.ts      File names and tags
src/mac.ts       Finder and open at login (LaunchAgent)
src/pages.ts     The helper's own pages: status (/) and allowing a site (/allow)
src/paths.ts     Where the bundled tools and settings live
src/config.ts    Settings (~/Library/Application Support/Curator Helper/config.json)
app/             Info.plist and icon for the .app
deps.json        Pinned yt-dlp, FFmpeg, Deno and Bun (URLs + SHA-256)
scripts/build.sh Builds dist/Curator-Helper-<version>-mac-{arm64,x64}.zip
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

The app bundles: the helper compiled with Bun into one executable (`Contents/MacOS/curator-helper`; the Intel build uses Bun's baseline target so it runs without AVX), plus `Contents/Resources/bin/yt-dlp`, `ffmpeg` and `deno`. yt-dlp uses Deno as its JavaScript runtime for YouTube. If Deno were missing, the helper falls back to its own executable with `BUN_BE_BUN=1` (a Bun-compiled program then behaves as `bun`), though yt-dlp has deprecated Bun. On first run yt-dlp is copied to `~/Library/Application Support/Curator Helper/bin` so it can update itself (`yt-dlp -U`, daily).

The app is signed ad hoc (`codesign -s -`), not notarized, so people open it with right-click → Open the first time.

## Releasing an update

1. Bump `version` in `package.json`.
2. To update a bundled tool, change its URL/version in `deps.json` and clear its `sha256`; the build prints the new checksum to pin.
3. `bash scripts/build.sh`.
4. Create a GitHub release and attach both zips.
5. Set `HELPER_LATEST` in the site's `lib/helper.ts` to the new version, so Settings tells people an update is out.

## API

All JSON. Everything except `GET /status` needs the calling site to be allowed: curator opens `/allow?origin=…`, the helper's own page, where you press Allow (a one-time token stops other sites submitting it). `localhost` sites are always allowed. The helper uses no AppleScript (macOS would show that as Script Editor).

| Route | |
|---|---|
| `GET /status` | `{ app, version, paired, folder?, format?, openAtLogin?, ytDlp? }` |
| `GET /` | Status page |
| `GET /allow?origin=…` | Page to allow a site |
| `POST /disconnect` | Forget the calling site |
| `POST /download` | `{ url, meta: { title, artist, year, label, genre, bpm, key, camelot, artwork, source } }` → `{ job }` |
| `GET /jobs/:id`, `GET /jobs` | Progress: `state` (queued, downloading, converting, done, error), `progress` 0–1, `file`, `error` |
| `POST /reveal` | `{ id }` → show the saved file in Finder |
| `POST /open-folder` | Open the folder in Finder |
| `POST /folder` | `{ folder: "~/Music/curator" }` (inside your home folder) or `{ preset: "userLibrary" }` |
| `POST /settings` | `{ format?: "aiff" \| "wav" \| "mp3", openAtLogin?: boolean }` |
| `POST /update-ytdlp` | Run `yt-dlp -U` |
| `POST /quit` | Quit |
