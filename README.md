# curator

Samples, dug for you. A sample-finding app for DJs and producers: a personal daily crate of records worth chopping, acapellas and loops, with BPM, key (with Camelot) and the best loopable bars marked.

## What it does

One dense dashboard built for digging fast:

- **Search** artists, songs and acapellas (`/` to focus).
- **Random pick** from your crates at the top (`R` for another, `P` to play).
- **Filters**: type, BPM range (with half/double time), Camelot key (exact or harmonically compatible), decade, genre.
- **Track table**: sortable by year, BPM and key. `↑↓` to move, `space` to play, `enter` for details, `S` to save.
- **Find related** (the ⋔ button on each song, or in its details): similar BPM, genre and era, optionally in a compatible key. Shows known records plus **deep cuts**: obscure 12"s and small-label releases from MusicBrainz.
- **Pivot on anything**: click a song's label, genre, year, BPM or key to find more songs sharing it.
- **Style model**: Essentia's Discogs-EffNet runs in your browser on every preview. It hears 400 Discogs styles (Deep House, Boom Bap, Bossa Nova…), shown as the genre and under "Sounds like" in a song's details. "Similar songs" are ranked by how alike they sound (% match). The model (`public/models`, 18 MB) is from MTG-UPF's Essentia models, licensed for non-commercial use.
- **Labels**: shown under the artist (from Apple's album details, SoundCloud and MusicBrainz).
- **Your crates**: named lists of artists (with optional year ranges) that you curate. Switched-on crates feed "For you" and the random pick. Add artists from the sidebar or from any track's detail panel.
- **Detail panel**: waveform, loop-friendly sections, sync to project BPM, chop points (`M`), YouTube full track, more like this.

BPM and key are estimated in the browser from the audio preview, so treat them as a strong guess.

## Sources

- **MusicBrainz** (no key): deep cuts and label catalogs. Limited to one request a second, so related searches take a few seconds.

| Source | Used for | Key needed |
|---|---|---|
| Apple Music / iTunes Search | Classic songs, 30s previews, year, genre | no |
| ccMixter | Acapellas (open on ccMixter to listen and download) | no |
| YouTube (official embedded player) | Full-length playback of songs, in a mini video window | `YOUTUBE_API_KEY` |
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
