import Anthropic from "@anthropic-ai/sdk";
import STYLES from "./discogs-styles.json";
import { norm } from "./scenes";
import { summarize, type MagicPlan } from "./magic";

/**
 * Optional: with ANTHROPIC_API_KEY set, Claude reads the description and fills in
 * the search plan, which copes with looser wording than the built-in parser
 * ("something a crate digger would sample for a rainy-day beat"). Without a key,
 * curator uses the free parser in lib/magic.ts.
 */
export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

const STYLE_NAMES = (STYLES as string[]).map((s) => s.split("---")[1]);
const STYLE_BY_NORM = new Map(STYLE_NAMES.map((s) => [norm(s), s]));

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type", "styles", "decades", "year_from", "year_to", "bpm_min", "bpm_max", "key", "moods", "artists", "terms", "vocal", "deep"],
  properties: {
    type: { type: "string", enum: ["song", "acapella", "any"] },
    styles: { type: "array", items: { type: "string" }, description: "Up to 5 Discogs style names from the list" },
    decades: { type: "array", items: { type: "integer" }, description: "Decades like 1970" },
    year_from: { type: ["integer", "null"] },
    year_to: { type: ["integer", "null"] },
    bpm_min: { type: ["integer", "null"] },
    bpm_max: { type: ["integer", "null"] },
    key: { type: ["string", "null"], description: 'A key like "Am" or "F#", or a Camelot code like "8A"' },
    moods: { type: "array", items: { type: "string" } },
    artists: { type: "array", items: { type: "string" }, description: "Real artists that fit, named or implied (up to 8)" },
    terms: { type: "array", items: { type: "string" }, description: "Short search words: instruments, themes (up to 4)" },
    vocal: { type: ["string", "null"], enum: ["female", "male", null] },
    deep: { type: "boolean", description: "Wants obscure records rather than well-known ones" },
  },
} as const;

const SYSTEM = `You turn a DJ/producer's description of the songs or acapellas they want to sample into a search plan for a record-digging app.
- "styles": choose up to 5 from this exact list of Discogs styles, the closest fits: ${STYLE_NAMES.join(", ")}.
- "artists": real artists whose records fit the description, including ones the description implies but doesn't name (e.g. "Dilla-style soul" → J Dilla, Slum Village). Prefer artists with recordings from the asked era. Up to 8.
- "type": "acapella" when they ask for acapellas/vocals only, "song" for instrumentals or full songs, otherwise "any".
- Tempo words map to a BPM range only when clear ("slow" ≈ 65–98, "uptempo" ≈ 120–140). Leave fields null when the description doesn't say.
- "terms": a few concrete words worth searching titles for (instruments, themes), not genre or mood words.`;

interface AiPlan {
  type: MagicPlan["type"];
  styles: string[];
  decades: number[];
  year_from: number | null;
  year_to: number | null;
  bpm_min: number | null;
  bpm_max: number | null;
  key: string | null;
  moods: string[];
  artists: string[];
  terms: string[];
  vocal: "female" | "male" | null;
  deep: boolean;
}

let client: Anthropic | null = null;

export async function aiPlan(description: string): Promise<MagicPlan | null> {
  if (!aiEnabled()) return null;
  client ??= new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      // A short structured answer: low effort keeps it quick.
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      // If a request is declined, the API retries it on a fallback model by itself.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      cache_control: { type: "ephemeral" },
      system: SYSTEM,
      messages: [{ role: "user", content: description.slice(0, 600) }],
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    const a = JSON.parse(text.text) as AiPlan;
    const styles = a.styles.map((s) => STYLE_BY_NORM.get(norm(s))).filter((s): s is string => !!s);
    const decades = a.decades.filter((d) => d >= 1940 && d <= 2020 && d % 10 === 0);
    const years: [number, number] | undefined =
      a.year_from && a.year_to && a.year_from <= a.year_to ? [a.year_from, a.year_to] : undefined;
    const bpm: [number, number] | undefined =
      a.bpm_min && a.bpm_max && a.bpm_min >= 50 && a.bpm_max <= 220 && a.bpm_min < a.bpm_max ? [a.bpm_min, a.bpm_max] : undefined;
    const plan: MagicPlan = {
      type: a.type,
      styles: styles.slice(0, 5),
      decades,
      years,
      bpm,
      key: a.key ?? undefined,
      moods: a.moods.slice(0, 4),
      artists: a.artists.slice(0, 8),
      terms: a.terms.slice(0, 4),
      vocal: a.vocal ?? undefined,
      deep: a.deep,
      summary: "",
      via: "ai",
    };
    plan.summary = summarize(plan);
    return plan;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) console.warn("[magic] ANTHROPIC_API_KEY was rejected; using the built-in parser");
    else if (e instanceof Anthropic.RateLimitError) console.warn("[magic] Claude rate limited; using the built-in parser");
    else if (e instanceof Anthropic.APIError) console.warn(`[magic] Claude error ${e.status}; using the built-in parser`);
    else console.warn("[magic] couldn't read Claude's plan; using the built-in parser");
    return null;
  }
}
