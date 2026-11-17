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

### Listening
- **Autoplay**: clicking a song plays it, the arrow keys move and play, and playback continues down the list.
- **Full songs** (with a YouTube key or SoundCloud connected): songs play in full through YouTube's official player, shown in a small floating window. Turn **Full** off in the player to hear the 30-second previews instead.
- **SoundCloud**: browse your likes and playlists, stream full tracks, and turn any playlist into a crate.
- **Player**: waveform with loop-friendly sections highlighted (on previews), loop a section, **Sync** a song to your project BPM (with **Key lock**), and mute.
- **Open in**: every song links to YouTube, Spotify, Apple Music, SoundCloud, Beatport, Discogs and WhoSampled, or a web search.

### Analysis (runs in your browser)
- **BPM and key** (with Camelot) are estimated from each preview.
- **Styles**: a neural network trained on Discogs (Essentia's Discogs-EffNet) listens to each preview and recognises 400 styles, like Deep House, Boom Bap, Bossa Nova or Disco. The strongest one is shown as the genre, and a song's details list the top five under **Sounds like**. It also produces a "sound fingerprint" used to rank similar songs.

### Your stuff
- **Save** songs (heart or `S`), keep notes on them, and drop **chop points** (`M`) while a song plays.
- **Guest mode** by default: everything is kept in your browser until you clear its cookies and site data.
- **Accounts** (optional): sign in to keep crates, saves and chop points across devices. Signing in merges in whatever you made as a guest.
- **Settings** (gear, top right): account, accent colour, playback, Downie, connections, crates, export/import and reset.

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
| `D` | Send to Downie (when switched on) |
| `R` | New random pick |
| `P` | Play / pause the random pick |
| `Esc` | Close details or menus |

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

The free quota allows about **100 new song lookups a day**. Playback itself isn't limited, and each song is looked up once per visit. On a shared deployment, everyone uses the same quota.

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
2. Open the new Supabase project (Vercel links to it), go to **SQL Editor**, paste in [`supabase/schema.sql`](supabase/schema.sql) and run it.
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

Every push to `main` redeploys automatically.

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
- **Downie doesn't open**: make sure it's installed, allow your browser to open it, and check a YouTube key is set.

---

## Project layout

```
app/
  page.tsx                 Dashboard: crates, search, related, SoundCloud views
  settings/page.tsx        Settings
  api/                     Server routes: crate, search, related, random, more,
                           youtube, config, soundcloud/*
components/                Track table, player, details sheet, menus, settings bits
lib/
  sources/                 iTunes, MusicBrainz, ccMixter, Freesound, SoundCloud
  crate.ts, related.ts     Recommendations and related-song search
  scenes.ts, genres.ts     Built-in scenes, genre and style mapping
  dsp.ts, analysis-*.ts    BPM / key / sections analysis (Web Worker)
  mel.ts, styles.worker.ts,
  style-store.ts           Discogs-EffNet style model (Web Worker)
  profile.tsx, account.ts  Your data: guest storage and account sync
public/models/             The style model
scripts/copy-ort.mjs       Copies ONNX Runtime's wasm into public/ort on install
supabase/schema.sql        Database setup for accounts
```

Scripts: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`.

---

## Credits and licences

- **Discogs-EffNet** by the Music Technology Group, Universitat Pompeu Fabra ([Essentia models](https://essentia.upf.edu/models.html)), licensed [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/): non-commercial use, unmodified. Alonso-Jiménez, Serra and Bogdanov, *Music Representation Learning Based on Editorial Metadata from Discogs*, ISMIR 2022.
- **MusicBrainz** data: core data CC0, tags [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/).
- **ONNX Runtime Web** (MIT), **Next.js** (MIT), **framer-motion** (MIT), **hls.js** (Apache 2.0), **supabase-js** (MIT).
- Apple, YouTube, SoundCloud, ccMixter and Freesound content belongs to its owners and is used through their public APIs and players, under their terms. ccMixter and Freesound sounds carry their own Creative Commons licences; check each before using it.
- Downie is made by Charlie Monroe Software and isn't affiliated with curator.
