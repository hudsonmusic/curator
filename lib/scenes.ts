export interface Scene {
  id: string;
  name: string;
  blurb: string;
  years: [number, number];
  artists: string[];
  /** ccMixter tags to pair with "acappella". */
  ccTags: string[];
  /** Freesound queries for melodic loops in this style. */
  loopQueries: string[];
  /** Freesound queries for vocal phrases in this style. */
  vocalQueries: string[];
}

export const SCENES: Scene[] = [
  {
    id: "boombap",
    name: "90s Boom Bap",
    blurb: "Dusty loops, jazz chops, crate-dug soul",
    years: [1988, 1999],
    artists: [
      "A Tribe Called Quest", "Pete Rock & C.L. Smooth", "Gang Starr", "De La Soul",
      "The Pharcyde", "Digable Planets", "Black Sheep", "Nas", "Mobb Deep",
      "Jeru the Damaja", "Main Source", "Souls of Mischief", "Lord Finesse",
      "Brand Nubian", "Large Professor", "Common",
    ],
    ccTags: ["hip_hop", "rap"],
    loopQueries: ["jazz rhodes loop", "dusty soul loop", "vinyl piano loop"],
    vocalQueries: ["rap acapella", "hip hop vocal phrase"],
  },
  {
    id: "soul",
    name: "70s Soul & Jazz-Funk",
    blurb: "The records boom bap was built from",
    years: [1968, 1981],
    artists: [
      "Roy Ayers", "Bob James", "Lonnie Liston Smith", "The Meters", "Donald Byrd",
      "Ramsey Lewis", "Grover Washington, Jr.", "Minnie Riperton", "Isaac Hayes",
      "Curtis Mayfield", "Bill Withers", "Ahmad Jamal", "Herbie Hancock", "Weldon Irvine",
    ],
    ccTags: ["soul", "funk", "jazz"],
    loopQueries: ["rhodes loop", "jazz funk loop", "soul strings loop"],
    vocalQueries: ["soul vocal", "gospel vocal"],
  },
  {
    id: "disco",
    name: "70s Disco",
    blurb: "Strings, Rhodes and four-on-the-floor",
    years: [1974, 1983],
    artists: [
      "Chic", "Donna Summer", "Cerrone", "Sylvester", "Loleatta Holloway",
      "Giorgio Moroder", "Patrick Adams", "Gino Soccio", "Evelyn \"Champagne\" King",
      "Change", "Sister Sledge", "Diana Ross", "Candi Staton", "First Choice", "Instant Funk",
    ],
    ccTags: ["disco", "funk"],
    loopQueries: ["disco strings loop", "disco bass loop", "disco guitar loop"],
    vocalQueries: ["disco vocal", "diva vocal"],
  },
  {
    id: "chicago",
    name: "Chicago & Early House",
    blurb: "Jackin' chords and gospel divas",
    years: [1985, 1999],
    artists: [
      "Frankie Knuckles", "Mr. Fingers", "Larry Heard", "Marshall Jefferson", "Ten City",
      "Crystal Waters", "Robin S", "CeCe Peniston", "Masters at Work", "Kerri Chandler",
      "Inner City", "Joe Smooth", "Armand Van Helden", "Daft Punk",
    ],
    ccTags: ["house", "dance"],
    loopQueries: ["house organ loop", "deep house chord loop", "piano house loop"],
    vocalQueries: ["house vocal", "diva house vocal"],
  },
  {
    id: "techno",
    name: "Detroit & Early Techno",
    blurb: "Strings, stabs and machine soul",
    years: [1987, 2003],
    artists: [
      "Derrick May", "Juan Atkins", "Model 500", "Carl Craig", "Jeff Mills", "Robert Hood",
      "Underground Resistance", "Plastikman", "Kevin Saunderson", "Octave One",
      "Drexciya", "Galaxy 2 Galaxy", "Aphex Twin", "Orbital",
    ],
    ccTags: ["techno", "electronic"],
    loopQueries: ["detroit techno pad loop", "acid 303 loop", "techno synth stab loop"],
    vocalQueries: ["techno vocal", "spoken word vocal"],
  },
  {
    id: "2000s",
    name: "2000s House & Minimal",
    blurb: "Filter house to Berlin minimal",
    years: [1998, 2010],
    artists: [
      "Basement Jaxx", "Stardust", "Modjo", "Spiller", "Moodymann", "Theo Parrish",
      "Isolée", "Booka Shade", "Ricardo Villalobos", "Mylo", "Junior Jack",
      "Röyksopp", "Superpitcher", "Tiga",
    ],
    ccTags: ["house", "electronic", "minimal"],
    loopQueries: ["filter house loop", "minimal synth loop", "french house chord loop"],
    vocalQueries: ["house vocal chop", "female vocal phrase"],
  },
  {
    id: "brazil",
    name: "Brazilian Grooves",
    blurb: "MPB, samba-funk, bossa",
    years: [1963, 1986],
    artists: [
      "Marcos Valle", "Jorge Ben", "Azymuth", "Tim Maia", "Gal Costa", "Banda Black Rio",
      "Joyce", "Arthur Verocai", "Sérgio Mendes", "Cassiano", "Hyldon", "Os Mutantes",
      "Elis Regina", "João Donato", "Antônio Carlos Jobim",
    ],
    ccTags: ["latin", "bossa_nova", "brazilian"],
    loopQueries: ["bossa nova guitar loop", "samba loop", "brazilian rhodes loop"],
    vocalQueries: ["portuguese vocal", "bossa nova vocal"],
  },
  {
    id: "latin",
    name: "Latin & Salsa",
    blurb: "Fania horns and boogaloo",
    years: [1965, 1985],
    artists: [
      "Héctor Lavoe", "Willie Colón", "Ray Barretto", "Joe Bataan", "Fania All Stars",
      "Celia Cruz", "Eddie Palmieri", "Mongo Santamaría", "Joe Cuba", "Pete Rodríguez",
      "Tito Puente", "Johnny Pacheco",
    ],
    ccTags: ["latin", "salsa"],
    loopQueries: ["salsa piano loop", "latin horn loop", "montuno loop"],
    vocalQueries: ["spanish vocal", "latin vocal"],
  },
  {
    id: "reggaerock",
    name: "Reggae Rock & Ska",
    blurb: "Sublime-era Long Beach and beyond",
    years: [1990, 2010],
    artists: [
      "Sublime", "Long Beach Dub Allstars", "Slightly Stoopid", "311", "Sugar Ray",
      "Pepper", "Dirty Heads", "Rebelution", "Incubus", "No Doubt", "Sublime with Rome",
    ],
    ccTags: ["reggae", "ska", "dub"],
    loopQueries: ["reggae guitar skank loop", "dub organ loop", "ska horn loop"],
    vocalQueries: ["reggae vocal", "dub vocal"],
  },
];

export const SCENE_BY_ID = Object.fromEntries(SCENES.map((s) => [s.id, s]));

export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function sceneForArtist(artist: string): Scene | undefined {
  const a = norm(artist);
  return SCENES.find((s) => s.artists.some((x) => norm(x) === a || a.includes(norm(x))));
}
