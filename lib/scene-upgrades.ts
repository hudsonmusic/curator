import { SCENE_BY_ID } from "./scenes";
import { norm } from "./scenes";
import type { CrateDef } from "./types";

/** Each starter crate's artists before the November 2026 refresh, to spot crates nobody has edited. */
const BEFORE: Record<string, string[]> = {
  "boombap": [
    "A Tribe Called Quest",
    "Pete Rock & C.L. Smooth",
    "Gang Starr",
    "De La Soul",
    "The Pharcyde",
    "Digable Planets",
    "Black Sheep",
    "Nas",
    "Mobb Deep",
    "Jeru the Damaja",
    "Main Source",
    "Souls of Mischief",
    "Lord Finesse",
    "Brand Nubian",
    "Large Professor",
    "Common"
  ],
  "soul": [
    "Roy Ayers",
    "Bob James",
    "Lonnie Liston Smith",
    "The Meters",
    "Donald Byrd",
    "Ramsey Lewis",
    "Grover Washington, Jr.",
    "Minnie Riperton",
    "Isaac Hayes",
    "Curtis Mayfield",
    "Bill Withers",
    "Ahmad Jamal",
    "Herbie Hancock",
    "Weldon Irvine"
  ],
  "disco": [
    "Chic",
    "Donna Summer",
    "Cerrone",
    "Sylvester",
    "Loleatta Holloway",
    "Giorgio Moroder",
    "Patrick Adams",
    "Gino Soccio",
    "Evelyn \"Champagne\" King",
    "Change",
    "Sister Sledge",
    "Diana Ross",
    "Candi Staton",
    "First Choice",
    "Instant Funk"
  ],
  "chicago": [
    "Frankie Knuckles",
    "Mr. Fingers",
    "Larry Heard",
    "Marshall Jefferson",
    "Ten City",
    "Crystal Waters",
    "Robin S",
    "CeCe Peniston",
    "Masters at Work",
    "Kerri Chandler",
    "Inner City",
    "Joe Smooth",
    "Armand Van Helden",
    "Daft Punk"
  ],
  "techno": [
    "Derrick May",
    "Juan Atkins",
    "Model 500",
    "Carl Craig",
    "Jeff Mills",
    "Robert Hood",
    "Underground Resistance",
    "Plastikman",
    "Kevin Saunderson",
    "Octave One",
    "Drexciya",
    "Galaxy 2 Galaxy",
    "Aphex Twin",
    "Orbital"
  ],
  "2000s": [
    "Basement Jaxx",
    "Stardust",
    "Modjo",
    "Spiller",
    "Moodymann",
    "Theo Parrish",
    "Isolée",
    "Booka Shade",
    "Ricardo Villalobos",
    "Mylo",
    "Junior Jack",
    "Röyksopp",
    "Superpitcher",
    "Tiga"
  ],
  "brazil": [
    "Marcos Valle",
    "Jorge Ben",
    "Azymuth",
    "Tim Maia",
    "Gal Costa",
    "Banda Black Rio",
    "Joyce",
    "Arthur Verocai",
    "Sérgio Mendes",
    "Cassiano",
    "Hyldon",
    "Os Mutantes",
    "Elis Regina",
    "João Donato",
    "Antônio Carlos Jobim"
  ],
  "latin": [
    "Héctor Lavoe",
    "Willie Colón",
    "Ray Barretto",
    "Joe Bataan",
    "Fania All Stars",
    "Celia Cruz",
    "Eddie Palmieri",
    "Mongo Santamaría",
    "Joe Cuba",
    "Pete Rodríguez",
    "Tito Puente",
    "Johnny Pacheco"
  ],
  "reggaerock": [
    "Sublime",
    "Long Beach Dub Allstars",
    "Slightly Stoopid",
    "311",
    "Sugar Ray",
    "Pepper",
    "Dirty Heads",
    "Rebelution",
    "Incubus",
    "No Doubt",
    "Sublime with Rome"
  ]
};

/** Starter crates you haven't changed get the newer, deeper artist list (and era). */
export function upgradeCrates(crates: CrateDef[]): CrateDef[] {
  return crates.map((c) => {
    const was = BEFORE[c.id];
    const now = SCENE_BY_ID[c.id];
    if (!was || !now) return c;
    const same = was.length === c.artists.length && was.every((a) => c.artists.some((x) => norm(x) === norm(a)));
    return same ? { ...c, artists: [...now.artists], years: now.years } : c;
  });
}
