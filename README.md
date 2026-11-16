# curator

Samples, dug for you. A sample-finding app for DJs and producers: a personal daily crate of records worth chopping, acapellas and loops, with BPM, key (with Camelot) and the best loopable bars marked.

## What it does

One dense dashboard built for digging fast:

- **Search** artists, songs and acapellas (`/` to focus).
- **Random pick** from your crates at the top (`R` for another, `P` to play).
- **Filters**: type, BPM range (with half/double time), Camelot key (exact or harmonically compatible), decade, genre.
- **Track table**: sortable by year, BPM and key. `↑↓` to move, `space` to play, `enter` for details, `S` to save.
- **Your crates**: named lists of artists (with optional year ranges) that you curate. Switched-on crates feed "For you" and the random pick. Add artists from the sidebar or from any track's detail panel.
- **Detail panel**: waveform, loop-friendly sections, sync to project BPM, chop points (`M`), YouTube full track, more like this.

BPM and key are estimated in the browser from the audio preview, so treat them as a strong guess.

## Sources

| Source | Used for | Key needed |
|---|---|---|
| Apple Music / iTunes Search | Classic songs, 30s previews, year, genre | no |
| ccMixter | Acapellas (open on ccMixter to listen and download) | no |
| YouTube Data API | Full-track player in the detail panel | `YOUTUBE_API_KEY` |
| Freesound | Loops and vocal phrases | `FREESOUND_API_KEY` |
| SoundCloud | Your likes and playlists, full-length playback, crates from playlists | `SOUNDCLOUD_CLIENT_ID` + `SOUNDCLOUD_CLIENT_SECRET` |

Crates, saved tracks and chop points are stored in your browser for now.

### SoundCloud

Register an app at soundcloud.com/you/apps, set its redirect URI to `<your site>/api/soundcloud/callback`, and add the client ID and secret. Then use **Connect SoundCloud** in the sidebar to:

- browse your **Likes** and **playlists** in the track table, with the same filters;
- turn any of them into a crate (**+ Make crate** takes its most frequent artists);
- hear **full tracks**: with **Full** on in the player, songs play the best-matching SoundCloud upload instead of the 30s preview (falls back to the preview when there's no match).

## Run it

```bash
npm install
cp .env.example .env.local   # optional keys
npm run dev
```

## Deploy

Import the repo in Vercel and add the optional keys as environment variables.
