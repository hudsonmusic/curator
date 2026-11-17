#!/usr/bin/env bash
# Builds "Curator Helper.app" for Apple silicon (arm64) and Intel (x64), with
# yt-dlp, FFmpeg, Deno and the Bun runtime packaged inside, and zips each one.
#   bash scripts/build.sh            # both
#   bash scripts/build.sh arm64      # just one
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
CACHE="$ROOT/.cache"
DIST="$ROOT/dist"
VERSION=$(node -p 'require("./package.json").version')
if [ $# -eq 0 ]; then ARCHES=(arm64 x64); else ARCHES=("$@"); fi
mkdir -p "$CACHE" "$DIST"

dep() { node -e 'const d=require("./deps.json");const [n,a,k]=process.argv.slice(1);console.log(d[n][a][k]||"")' "$@"; }

# fetch <name> <arch> <out>: download once, verify the pinned checksum (or print it to pin).
fetch() {
  local name=$1 arch=$2 out=$3
  local url sha
  url=$(dep "$name" "$arch" url); sha=$(dep "$name" "$arch" sha256)
  if [ ! -f "$out" ]; then
    echo "↓ $name ($arch)"
    curl -fsSL --retry 3 -o "$out.part" "$url"
    mv "$out.part" "$out"
  fi
  local got; got=$(shasum -a 256 "$out" | cut -d' ' -f1)
  if [ -z "$sha" ]; then
    echo "  ! no pinned checksum for $name/$arch; pin this in deps.json: $got"
  elif [ "$sha" != "$got" ]; then
    echo "  ✗ checksum mismatch for $name/$arch (expected $sha, got $got)"; rm -f "$out"; exit 1
  fi
}

fetch yt-dlp universal "$CACHE/yt-dlp_macos"

for ARCH in "${ARCHES[@]}"; do
  echo "== $ARCH"
  BUNARCH=$([ "$ARCH" = arm64 ] && echo aarch64 || echo x64)
  fetch bun "$ARCH" "$CACHE/bun-$ARCH.zip"
  fetch ffmpeg "$ARCH" "$CACHE/ffmpeg-$ARCH.gz"
  fetch deno "$ARCH" "$CACHE/deno-$ARCH.zip"

  # The build machine's own Bun compiles; the target's Bun is what gets embedded.
  HOSTARCH=$([ "$(uname -m)" = arm64 ] && echo arm64 || echo x64)
  fetch bun "$HOSTARCH" "$CACHE/bun-$HOSTARCH.zip"
  [ -x "$CACHE/bun-$HOSTARCH/bun" ] || { rm -rf "$CACHE/bun-$HOSTARCH"; mkdir -p "$CACHE/bun-$HOSTARCH"; unzip -qo "$CACHE/bun-$HOSTARCH.zip" -d "$CACHE/bun-$HOSTARCH.x"; mv "$CACHE/bun-$HOSTARCH.x"/*/bun "$CACHE/bun-$HOSTARCH/bun"; rm -rf "$CACHE/bun-$HOSTARCH.x"; }
  BUN="$CACHE/bun-$HOSTARCH/bun"

  APP="$DIST/$ARCH/Curator Helper.app"
  rm -rf "$DIST/$ARCH"; mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/bin"

  # Intel: the "baseline" build runs on older CPUs (and Rosetta) without AVX.
  TARGET=$([ "$ARCH" = x64 ] && echo bun-darwin-x64-baseline || echo bun-darwin-arm64)
  "$BUN" build src/main.ts --compile --minify --target="$TARGET" --outfile "$APP/Contents/MacOS/curator-helper-server"
  # The app itself: a tiny native app that runs the server and shows a menu bar icon.
  SWIFTARCH=$([ "$ARCH" = arm64 ] && echo arm64 || echo x86_64)
  xcrun swiftc -O -target "$SWIFTARCH-apple-macos12" -o "$APP/Contents/MacOS/curator-helper" app/Launcher.swift
  gunzip -c "$CACHE/ffmpeg-$ARCH.gz" > "$APP/Contents/Resources/bin/ffmpeg"
  cp "$CACHE/yt-dlp_macos" "$APP/Contents/Resources/bin/yt-dlp"
  # Deno: the JavaScript runtime yt-dlp prefers for YouTube (Bun, the helper itself, is the fallback).
  unzip -qo "$CACHE/deno-$ARCH.zip" deno -d "$APP/Contents/Resources/bin"
  chmod +x "$APP/Contents/Resources/bin/"*

  sed "s/__VERSION__/$VERSION/g" app/Info.plist > "$APP/Contents/Info.plist"
  [ -f app/AppIcon.icns ] && cp app/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"
  cat > "$APP/Contents/Resources/LICENSES.txt" <<TXT
Curator Helper bundles:
- yt-dlp $(node -p 'require("./deps.json")["yt-dlp"].version') (Unlicense) https://github.com/yt-dlp/yt-dlp
- FFmpeg $(node -p 'require("./deps.json").ffmpeg.version') (GPL; static build from https://github.com/eugeneware/ffmpeg-static, source at https://ffmpeg.org)
- Bun $(node -p 'require("./deps.json").bun.version') (MIT) https://bun.sh
- Deno $(node -p 'require("./deps.json").deno.version') (MIT) https://deno.com
TXT

  # Ad-hoc signature so macOS will run it (not notarized: first open with right-click → Open).
  find "$APP" -exec xattr -c {} + 2>/dev/null || true
  xattr -cr "$APP"
  codesign --force --deep --sign - "$APP" >/dev/null
  (cd "$DIST/$ARCH" && ditto -c -k --keepParent "Curator Helper.app" "$DIST/Curator-Helper-$VERSION-mac-$ARCH.zip")
  echo "✓ $DIST/Curator-Helper-$VERSION-mac-$ARCH.zip ($(du -sh "$APP" | cut -f1))"
done
