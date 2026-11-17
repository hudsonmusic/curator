import { NextResponse } from "next/server";
import { buildCrate } from "@/lib/crate";
import { deepCuts } from "@/lib/related";
import { SCENE_MB_TAGS } from "@/lib/genres";
import { SCENE_BY_ID } from "@/lib/scenes";
import { rngFrom, pick } from "@/lib/rng";
import { mbQuery } from "@/lib/sources/musicbrainz";
import { withLabels } from "@/lib/sources/itunes";
import type { CrateRequest } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json()) as CrateRequest;
  if (!body?.seed) return NextResponse.json({ error: "seed required" }, { status: 400 });
  // Alongside the crate: a few forgotten records from one of its scenes.
  const rng = rngFrom(body.seed + ":deep");
  const sceneIds = (body.crates?.map((c) => c.id) ?? body.scenes ?? []).filter((id) => SCENE_MB_TAGS[id]);
  const deepJob = sceneIds.length
    ? (() => {
        const scene = SCENE_BY_ID[pick(sceneIds, rng)];
        const crate = body.crates?.find((c) => c.id === scene.id);
        const [lo, hi] = crate?.years ?? scene.years;
        const q = [mbQuery.tags(SCENE_MB_TAGS[scene.id]), mbQuery.years(lo, hi)].join(" AND ");
        return deepCuts(q, 8, rng, { scene, previews: 3, exclude: new Set(body.exclude ?? []) });
      })()
    : Promise.resolve([]);
  const [tracks, deep] = await Promise.all([buildCrate(body).then(withLabels), deepJob.catch(() => [])]);
  return NextResponse.json({ tracks, deep });
}
