# curator

**Samples, dug for you.** curator is a sample finder for DJs and producers. It digs up records worth chopping (known classics and forgotten deep cuts), acapellas and loops, and shows each one's BPM, key, label and the styles it actually sounds like, so you can audition fast and get back to making music.

It's built around the music I sample most (90s boom bap, 70s soul, jazz-funk and disco, Chicago and Detroit house and techno, 2000s house and minimal, Brazilian, Latin, reggae rock), but your crates decide what it digs for.

> curator is a personal digging tool. It links to and plays music from public services; it doesn't host any. If you release something built on a sample, clear the sample first.

---

## Contents

- [Features](#features)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Quick start](#quick-start)
- [Configuration](#configuration)
  - [YouTube (full songs)](#youtube-full-songs)
  - [SoundCloud](#soundcloud)
  - [Accounts with Supabase](#accounts-with-supabase)
  - [Freesound (loops)](#freesound-loops)
- [Deploy to Vercel](#deploy-to-vercel)
- [Save for Ableton (Curator Helper)](#save-for-ableton-curator-helper)
- [Downie](#downie)
- [How it works](#how-it-works)
- [Your data and privacy](#your-data-and-privacy)
- [Limits and troubleshooting](#limits-and-troubleshooting)
- [Project layout](#project-layout)
- [Credits and licences](#credits-and-licences)

---

## Features

### Digging
- **Crates**: named lists of artists (with optional year ranges) that recommendations come from. Start from a built-in scene in one click, or make your own. Switched-on crates feed **For you** and the random pick.
- **For you**: a fresh mix from your crates (songs, acapellas and, with Freesound, loops), plus a **Deep cuts** section of obscure records from the same scene.
- **Random pick**: one record from your crates at the top of the page; it auto-plays. Press `R` for another.
- **Search** artists, songs and acapellas. Searching an artist curator knows also shows others from the same scene.
- **Find related** (the branching button on each song, or in its details):
  - **Similar songs**: similar BPM (±6%), style and era.
  - **Similar + same key**: the same, keeping only keys that mix harmonically.
  - Results come in two groups, **Known records** and **Deep cuts**, ranked by how alike they *sound* (with a **% match**).
- **Pivot on anything**: click a song's label, genre, year, BPM or key (in the list or its details) to find more songs that share it. A back arrow returns you to where you were.
- **Labels** are shown under each artist.
- **Dig radio** (the radio icon, top right, or **Radio** in a song's details): keeps playing songs related to what's on, known records and deep cuts, one artist at a time. Each top-up digs from the song playing now, so it wanders the way digging does. Play something else and the radio follows it.
- **History**: every song you've played for a few seconds, grouped by day, in the sidebar.

### Listening
- **Autoplay**: clicking a song plays it, the arrow keys move and play, and playback continues down the list.
- **Full songs** (with a YouTube key or SoundCloud connected): songs play in full through YouTube's official player, shown in a small floating window. Turn **Full** off in the player to hear the 30-second previews instead.
- **SoundCloud**: browse your likes and playlists, stream full tracks, and turn any playlist into a crate.
- **Player**: previous / next, a spinning record, waveform with loop-friendly sections highlighted (on previews), loop a section, **Sync** a song to your project BPM (with **Key lock**), and mute.
- **Now playing** (the expand button in the player, or tap the player on a phone): the record full-screen with the controls and a **Playing next** queue. With the radio on you can skip songs in the queue or jump to one.
- **Better YouTube matches**: curator looks at the top 10 results and picks the one that's really the record: title and artist must match, official uploads win, covers/live/remixes/karaoke lose, and the length closest to the record counts most. If nothing is convincing it falls back to SoundCloud or the preview rather than play the wrong song.
- **Works on phones**: the list, player and now playing view adapt to small screens.
- **Open in**: every song links to YouTube, Spotify, Apple Music, SoundCloud, Beatport, Discogs and WhoSampled, or a web search.

### Analysis (runs in your browser)
- **BPM and key** (with Camelot) are estimated from each preview.
- **Fix the BPM** when detection gets it wrong (often half or double): in a song's details (**BPM wrong? Fix it**) or by clicking the BPM in Now playing, halve it, double it, type it or tap along. Your fix is used everywhere, Sync included, and saved with your stuff.
- **Styles**: a neural network trained on Discogs (Essentia's Discogs-EffNet) listens to each preview and recognises 400 styles, like Deep House, Boom Bap, Bossa Nova or Disco. The strongest one is shown as the genre, and a song's details list the top five under **Sounds like**. It also produces a "sound fingerprint" used to rank similar songs.

### Your stuff
- **Save** songs (heart or `S`), keep notes on them, and drop **chop points** (`M`) while a song plays.
- **Guest mode** by default: everything is kept in your browser until you clear its cookies and site data.
- **Accounts** (optional): sign in to keep crates, saves and chop points across devices. Signing in merges in whatever you made as a guest.
- **Save for Ableton** (Mac): with the small [Curator Helper](#save-for-ableton-curator-helper) app running, save the full song as a tagged MP3 (or AIFF/WAV) (BPM, key, label, year, genre and cover art) in a folder you add to Ableton's Places.
- **Share crates**: open a crate's edit panel (✎) and press **Share crate** to copy a link (needs an account). Friends can open it without signing in, play its songs and add it to their own crates. Your edits update the link; **Stop sharing** turns it off.
- **Simple or Advanced view** (Settings → Appearance): Simple shows just title, year and BPM, without filters, Sync or chop points. Advanced is everything.
- **Cover art colours** (Settings → Appearance): tint curator with the colours of the song that's playing.
- **Settings** (gear, top right): account, view, colours, playback, Downie, connections, crates, play history, export/import and reset.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `/` | Search |
| `↑` `↓` (or `J` `K`) | Move through the list (and play) |
| `Space` | Play / pause |
| `Enter` | Open the song's details |
| `S` | Save / unsave |
| `M` | Drop a chop point (in a song's details) |
| `A` | Save for Ableton (with Curator Helper) |
| `D` | Send to Downie (when switched on) |
| `R` | New random pick |
| `P` | Play / pause the random pick |
| `Esc` | Close details, menus or Now playing |
| `←` `→` | Previous / next song (in Now playing) |

---

## Quick start

Needs [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/hudsonmusic/curator.git
cd curator
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. curator works with no keys at all: Apple previews, acapellas, deep cuts, BPM/key/style analysis and guest mode need none. Each key below switches on something extra.

`npm install` also copies ONNX Runtime's WebAssembly files into `public/ort/` (used by the style model).

---

## Configuration

All keys are optional and go in `.env.local` (locally) or your host's environment variables (in production). Everything here is free.

| Variable | What it switches on |
|---|---|
| `YOUTUBE_API_KEY` | Full-length songs through YouTube, and finding videos for Downie |
| `SOUNDCLOUD_CLIENT_ID`, `SOUNDCLOUD_CLIENT_SECRET` | Connecting SoundCloud |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Accounts |
| `FREESOUND_API_KEY` | Loops and vocal phrases from Freesound |

### YouTube (full songs)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project.
2. Search for **YouTube Data API v3** and click **Enable**.
3. Go to **Credentials** → **Create credentials** → **API key**.
4. Optional but recommended: **Edit API key** → **API restrictions** → restrict it to YouTube Data API v3.
5. Set `YOUTUBE_API_KEY` to the key.

Each new song lookup uses 101 units (a search plus a check of the results' lengths), so the free quota allows about **99 new song lookups a day**. Playback itself isn't limited, and each song is looked up once per visit. On a shared deployment, everyone uses the same quota.

### SoundCloud

1. Register an app at [soundcloud.com/you/apps](https://soundcloud.com/you/apps).
2. Add a redirect URI for each place curator runs:
   - `http://localhost:3000/api/soundcloud/callback`
   - `https://<your-site>/api/soundcloud/callback`
3. Set `SOUNDCLOUD_CLIENT_ID` and `SOUNDCLOUD_CLIENT_SECRET`.
4. In curator, click **Connect SoundCloud** in the sidebar (or in Settings).

Once connected, you can:
- browse your **Likes** and **playlists** with the same filters as everything else;
- click **+ Make crate** on any of them to make a crate from its artists (label and premiere-channel uploads are credited to the real artist);
- stream **full tracks**. Some tracks only allow SoundCloud's 30-second preview.

### Accounts with Supabase

Accounts use [Supabase](https://supabase.com) for sign-in and storage (the free plan is plenty for a few people). Without it, curator runs in guest mode.

**On Vercel (easiest):**
1. In your Vercel project, open **Storage** → **Create** → **Supabase** and follow the prompts. Vercel adds the keys to your project for you.
2. Open the new Supabase project (Vercel links to it), go to **SQL Editor**, paste in [`supabase/schema.sql`](supabase/schema.sql) and run it. It sets up accounts and shared crates, and it's safe to run again after you update curator.
3. In Supabase → **Authentication** → **URL Configuration**, set **Site URL** to your site's address, so confirmation emails link back to it.
4. Redeploy.

**Anywhere else:**
1. Create a project at [supabase.com](https://supabase.com).
2. Run [`supabase/schema.sql`](supabase/schema.sql) in its SQL Editor.
3. From **Project Settings** → **API**, set `NEXT_PUBLIC_SUPABASE_URL` to the Project URL and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the anon (or publishable) key.
4. Set the Site URL as above.

curator also accepts `SUPABASE_URL` and `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` (with or without `NEXT_PUBLIC_`). These keys are meant to be public: the schema's row-level security lets each person read and write only their own data.

Then sign up from **Settings → Account**. New accounts confirm by email (you can turn that off in Supabase → Authentication → Providers → Email).

### Freesound (loops)

Create an API key at [freesound.org/apiv2/apply](https://freesound.org/apiv2/apply) and set `FREESOUND_API_KEY`. Loops then appear in crates and searches, and the **Loops** filter switches on.

---

## Deploy to Vercel

1. Push the repo to GitHub.
2. On [vercel.com](https://vercel.com), choose **Add New → Project** and import it. The defaults (Next.js, `npm install`, `next build`) are right.
3. Under **Environment Variables**, add the keys you're using (see [Configuration](#configuration)).
4. Deploy.
5. Add `https://<your-site>/api/soundcloud/callback` to your SoundCloud app's redirect URIs.
6. Optional: add accounts through Vercel's Storage tab ([above](#accounts-with-supabase)).

Once the project is connected to the GitHub repo (**Project Settings → Git**), every push to `main` redeploys the live site, and pushes to other branches get their own preview link.

---

## Save for Ableton (Curator Helper)

This is optional and off by default. Browsers can't save a YouTube or SoundCloud song as a file, so curator has a small Mac app for it: **Curator Helper**. It sits in your menu bar (no Dock icon or windows) and only listens on your own Mac (`127.0.0.1:47533`). Everything it needs is packaged inside it: [yt-dlp](https://github.com/yt-dlp/yt-dlp) to download, [FFmpeg](https://ffmpeg.org) to convert and tag, [Deno](https://deno.com) (the JavaScript runtime yt-dlp needs for YouTube) and the [Bun](https://bun.sh) runtime the helper itself runs on. Nothing else to install.

**Set up**
1. In curator, **Settings → Save for Ableton (optional)**: switch it on and press **Download Curator Helper**. curator picks the right version for your Mac (Apple silicon or Intel) from the [latest release](https://github.com/hudsonmusic/curator/releases/latest).
2. Open the downloaded `.dmg` and drag **Curator Helper** onto **Applications**.
3. Open it from Applications. It isn't from an identified Apple developer, so the first time macOS blocks it: on macOS 15 and later go to **System Settings → Privacy & Security** and click **Open Anyway**; on macOS 14 and earlier right-click it → **Open**.
4. A ⤓ icon appears in your menu bar: open your songs folder, change where songs are saved, see its status, or quit. The first time, it also opens a page in your browser saying it's running.
5. Back in **Settings**, press **Connect**, then **Allow** on the Curator Helper page that opens. (Sites on `localhost` are allowed without asking.)
6. Optional: pick a dedicated folder (Settings or the menu bar icon) and drag it into **Places** in Ableton's browser sidebar, so saved songs show up right in Ableton.

**Use it**: press **Save for Ableton** in a song's details or in Now playing, use its ↗ menu, or press `A`. curator waits for the BPM and key, finds the full song (YouTube, else SoundCloud; acapellas from ccMixter), and the helper saves it:

- **Name**: `Artist - Title [98 BPM 8A].mp3`
- **Tags**: title, artist, year, genre (the style the model heard), label (publisher), BPM (`TBPM`), key (`TKEY`), and a comment with all of that plus the source link.
- **Cover**: the album art at 1000×1000.
- **Format** (Settings): **MP3** by default (best-quality VBR, every tag and the cover). Or **AIFF** (lossless, 44.1 kHz 16-bit, every tag and the cover) or **WAV** (lossless; WAV can't hold BPM, key or a cover, so those are in the name and comment). The source is YouTube or SoundCloud audio either way, so MP3 loses nothing you'd hear.

When it's done the button becomes **Show in Finder**. Songs go to your **Downloads** folder by default. **Settings** (or **Change Save Folder…** in the menu bar icon) lets you change that (Music, Desktop, Ableton's User Library, or any folder in your home folder), open it, start the helper at login, update yt-dlp, disconnect the site, and quit the helper.

**Updates**: yt-dlp updates itself once a day (YouTube changes often; if downloads start failing, press **Update yt-dlp** in Settings). When a new helper version is out, Settings shows a download button for it: quit the helper and install the new one over it.

**Privacy and safety**: the helper only accepts requests from sites you allowed, only saves inside your home folder, only downloads from YouTube, SoundCloud and ccMixter links, only fetches cover art from known artwork hosts, and only answers to `127.0.0.1`/`localhost` (no DNS rebinding). Its settings and log are in `~/Library/Application Support/Curator Helper`.

**Browsers**: Chrome, Edge, Arc and Brave may ask once to let the site "access other apps and services on this device"; allow it. Safari may block a secure site from talking to the helper; use a Chromium browser if Save for Ableton stays unavailable.

**Build it yourself** (in [`helper/`](helper); needs Xcode or the Command Line Tools for Swift): `cd helper && bash scripts/build.sh` downloads the pinned yt-dlp, FFmpeg and Bun (versions and checksums in [`helper/deps.json`](helper/deps.json)), compiles the helper and produces `dist/Curator-Helper-mac-arm64.dmg` and `-x64.dmg`. To run it from source while working on it: `node helper/src/main.ts` (uses yt-dlp, ffmpeg and node from your PATH). See [`helper/README.md`](helper/README.md).

---

## Downie

[Downie](https://software.charliemonroe.net/downie/) is a Mac app for downloading video and audio. curator can hand songs to it:

1. **Settings → Downie**: switch on **Send to Downie** (and **Audio only** if you just want the audio).
2. Use **Send to Downie** in a song's open-in menu or details, or press `D`.

curator finds the song's YouTube video and opens `downie://XUOpenLink?url=…` (plus `&postprocessing=audio` for audio only). SoundCloud tracks go as their SoundCloud page. Your browser asks before opening Downie the first time. This needs Downie installed on the same Mac, and a YouTube key to find videos.

---

## How it works

curator is a [Next.js](https://nextjs.org) app. The server side only gathers candidates; analysis and playback happen in your browser.

**Where songs come from**

| Source | Used for | Key |
|---|---|---|
| [Apple iTunes Search](https://performance-partners.apple.com/search-api) | Known songs, 30-second previews, year, genre, and record labels (from album details) | none |
| [MusicBrainz](https://musicbrainz.org) | Deep cuts: obscure 12"s, small labels, label catalogs, by style tag and year | none |
| [ccMixter](https://ccmixter.org) | Acapellas (listened to and downloaded on ccMixter) | none |
| [YouTube](https://developers.google.com/youtube) | Full-length playback through the official embedded player | `YOUTUBE_API_KEY` |
| [SoundCloud](https://developers.soundcloud.com) | Your likes and playlists, full-track streaming | SoundCloud app |
| [Freesound](https://freesound.org) | Loops and vocal phrases | `FREESOUND_API_KEY` |

**Recommendations.** Each crate is a list of artists. For you samples songs across your switched-on crates (weighted by what you like, save and play) and adds deep cuts from MusicBrainz releases tagged with the crate's styles and years. Deep cuts are matched to Apple previews where possible; the rest play in full through YouTube.

**Find related.** The server gathers known records (the seed artist plus artists from the same scene, near the same era) and deep cuts (MusicBrainz releases tagged with the styles the model heard in the seed). In the browser, a BPM range (and optionally a key) narrows them, and the style model's fingerprints rank them by sound.

**Analysis.** Previews are decoded with the Web Audio API and analysed in Web Workers:
- *BPM*: onset-strength autocorrelation, folded into 78–160.
- *Key*: chroma profile matched against major/minor key profiles, also shown in Camelot.
- *Loop-friendly sections*: bars with steady tonal content and little drum energy.
- *Styles*: Essentia's [Discogs-EffNet](https://essentia.upf.edu/models.html#discogs-effnet) model (`public/models/discogs-effnet-bsdynamic-1.onnx`, 18 MB) runs with [ONNX Runtime Web](https://onnxruntime.ai). Audio is turned into 96-band mel spectrograms at 16 kHz in 2-second patches; the model returns scores for 400 Discogs styles and a 1,280-number embedding. Similarity is the cosine of two songs' embeddings.

Results are cached in your browser, and the model downloads once.

---

## Your data and privacy

- **Guest mode**: crates, saves, notes, chop points, analysis results and settings live in your browser's local storage, under keys starting with `curator:`. Clearing the site's cookies and data removes them.
- **Accounts**: the same data is stored as one row per person in your Supabase project, readable only by its owner (row-level security).
- **SoundCloud**: your sign-in token is kept in an http-only cookie on your own deployment and only sent to SoundCloud.
- **Audio analysis** runs entirely in your browser. No audio is uploaded anywhere.
- curator has no analytics or tracking.
- **Play history** is kept with the rest of your stuff (in your browser, or your account when signed in). Clear it from History or Settings.
- **Shared crates** are public to anyone with the link: the crate's name, artists and years, nothing else (not your email). Stop sharing removes it.
- **Cover art colours** read the cover in your browser; covers that don't allow that go through the site's own `/api/img` (only known artwork hosts).
- **Export / import** in Settings lets you back up or move your crates and saves as a file.

---

## Limits and troubleshooting

- **BPM and key are estimates** from 30-second previews; double-check before you commit to a sample.
- **Empty or short lists for a moment**: Apple's search allows about 20 requests a minute. Wait a few seconds and hit **Refresh**.
- **Deep cuts take a few seconds**: MusicBrainz allows one request a second. Older eras (pre-80s) have fewer style tags there, so expect fewer deep cuts.
- **Common label names** (for example "Big Beat Records") can mix in unrelated labels with the same name.
- **Full songs not playing**: check `YOUTUBE_API_KEY`, and that the daily quota isn't used up. Videos that don't allow embedding fall back to the preview.
- **Acapellas don't play in the page**: ccMixter doesn't allow it; use **Listen & download on ccMixter**.
- **SoundCloud says "preview"**: that track only allows a 30-second preview through SoundCloud's API.
- **Sign-in emails link to localhost**: set the Site URL in Supabase → Authentication → URL Configuration.
- **Wrong song on YouTube**: turn **Full** off to hear the preview, or open the song on YouTube from its details. Matching needs the title and artist to match, so very obscure records may fall back to the preview.
- **Sharing says "Sign in"**: shared links are stored in Supabase, so you need an account; whoever opens the link doesn't.
- **The radio repeats an artist or stops**: it skips what you've played recently; if a style runs dry, play another song and it digs from there.
- **Save for Ableton doesn't show up**: is Curator Helper running (Settings shows its status), and did you press Connect? In Chrome, allow access to apps on this device if asked.
- **Saving fails with a YouTube error**: press **Update yt-dlp** in Settings and try again.
- **Downie doesn't open**: make sure it's installed, allow your browser to open it, and check a YouTube key is set.

---

## Project layout

```
app/
  page.tsx                 Dashboard: crates, search, related, SoundCloud views
  settings/page.tsx        Settings
  c/[id]/page.tsx          A shared crate
  api/                     Server routes: crate, search, related, random, more,
                           youtube, img, config, soundcloud/*
components/                Track table, player, now playing, radio, details sheet,
                           vinyl, BPM fixer, menus, settings bits
lib/
  sources/                 iTunes, MusicBrainz, ccMixter, Freesound, SoundCloud
  crate.ts, related.ts     Recommendations and related-song search
  scenes.ts, genres.ts     Built-in scenes, genre and style mapping
  dsp.ts, analysis-*.ts    BPM / key / sections analysis (Web Worker)
  mel.ts, styles.worker.ts,
  style-store.ts           Discogs-EffNet style model (Web Worker)
  profile.tsx, account.ts  Your data: guest storage, history and account sync
  share.ts                 Shared crates
  helper.ts                Talking to Curator Helper
  yt-match.ts              Picking the right YouTube video
  cover-color.ts           Cover art colours
public/models/             The style model
scripts/copy-ort.mjs       Copies ONNX Runtime's wasm into public/ort on install
supabase/schema.sql        Database setup for accounts and shared crates
helper/                    Curator Helper, the Mac app behind Save for Ableton
  src/                     Local server, downloads (yt-dlp), tagging (FFmpeg), macOS bits
  scripts/build.sh         Packages the app with yt-dlp, FFmpeg, Deno and Bun inside
  deps.json                Pinned versions and checksums of the bundled tools
```

Scripts: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`.

---

## Credits and licences

- **Discogs-EffNet** by the Music Technology Group, Universitat Pompeu Fabra ([Essentia models](https://essentia.upf.edu/models.html)), licensed [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/): non-commercial use, unmodified. Alonso-Jiménez, Serra and Bogdanov, *Music Representation Learning Based on Editorial Metadata from Discogs*, ISMIR 2022.
- **MusicBrainz** data: core data CC0, tags [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/).
- **Curator Helper** bundles **yt-dlp** (Unlicense), **FFmpeg** (GPL, static build from ffmpeg-static), **Deno** (MIT) and **Bun** (MIT); see `LICENSES.txt` inside the app.
- **ONNX Runtime Web** (MIT), **Next.js** (MIT), **framer-motion** (MIT), **hls.js** (Apache 2.0), **supabase-js** (MIT).
- Apple, YouTube, SoundCloud, ccMixter and Freesound content belongs to its owners and is used through their public APIs and players, under their terms. ccMixter and Freesound sounds carry their own Creative Commons licences; check each before using it.
- Downie is made by Charlie Monroe Software and isn't affiliated with curator.
