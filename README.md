# curator

Samples, dug for you. A sample-finding app for DJs and producers: a personal daily crate of records worth chopping, acapellas and loops, with BPM, key (with Camelot) and the best loopable bars marked.

## What it does

- **Crate**: a daily set of picks from the scenes you choose (90s boom bap, early house, disco, Brazilian…). "Dig deeper" pulls a fresh one.
- **Learns your taste**: saves, chop points, plays, and "not for me" adjust scene and artist weights that shape the next crate.
- **Analysis in the browser**: BPM, key, waveform, and *loop-friendly sections* (melodic, drum-light stretches cut to whole bars) from the audio preview.
- **Sync**: varispeed any preview to your project BPM (turntable style, or key lock).
- **Chop points**: press `M` while the preview or the YouTube video plays.
- **Dig**: search an artist or explore a scene; searching a known artist also shows their scene.

## Sources

| Source | Used for | Key needed |
|---|---|---|
| Apple Music / iTunes Search | Classic songs, 30s previews, year, genre | no |
| ccMixter | Acapellas (open on ccMixter to listen and download) | no |
| YouTube Data API | Full-track player in the detail panel | `YOUTUBE_API_KEY` |
| Freesound | Loops and vocal phrases | `FREESOUND_API_KEY` |

The taste profile, saved tracks and chop points are stored in your browser for now.

## Run it

```bash
npm install
cp .env.example .env.local   # optional keys
npm run dev
```

## Deploy

Import the repo in Vercel and add the optional keys as environment variables.
