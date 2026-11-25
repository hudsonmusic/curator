export interface Scene {
  id: string;
  name: string;
  blurb: string;
  years: [number, number];
  artists: string[];
  /** Freesound queries for melodic loops in this style. */
  loopQueries: string[];
  /** Freesound queries for vocal phrases in this style. */
  vocalQueries: string[];
}

export const SCENES: Scene[] = [
  {
    id: "boombap",
    name: "90s Boom Bap",
    blurb: "Jazz chops and dusty drums, past the obvious",
    years: [1988, 1999],
    artists: ["Pete Rock & C.L. Smooth", "Gang Starr", "A Tribe Called Quest", "The Pharcyde", "Digable Planets", "Black Sheep", "Main Source", "Souls of Mischief", "Organized Konfusion", "Showbiz & A.G.", "Diamond D", "O.C.", "Black Moon", "Smif-N-Wessun", "Artifacts", "Da Bush Babees", "Lord Finesse", "Large Professor", "Jeru the Damaja", "Mobb Deep", "Brand Nubian", "Lords of the Underground", "Nice & Smooth", "Chubb Rock"],
    loopQueries: ["jazz rhodes loop", "dusty soul loop", "vinyl piano loop"],
    vocalQueries: ["rap acapella", "hip hop vocal phrase"],
  },
  {
    id: "soul",
    name: "70s Soul & Jazz-Funk",
    blurb: "The records boom bap was built from",
    years: [1968, 1981],
    artists: ["Roy Ayers", "Lonnie Liston Smith", "Donald Byrd", "Weldon Irvine", "Bob James", "The Meters", "Ramsey Lewis", "Gary Bartz", "Doug Carn", "Ronnie Foster", "Johnny Hammond", "Idris Muhammad", "Grant Green", "Charles Earland", "Lou Donaldson", "Rotary Connection", "Minnie Riperton", "Bill Withers", "Curtis Mayfield", "Syl Johnson", "Ann Peebles", "The Blackbyrds", "Leon Ware", "Shuggie Otis"],
    loopQueries: ["rhodes loop", "jazz funk loop", "soul strings loop"],
    vocalQueries: ["soul vocal", "gospel vocal"],
  },
  {
    id: "spiritual",
    name: "Spiritual & Modal Jazz",
    blurb: "Harps, chants and long modal vamps",
    years: [1965, 1981],
    artists: ["Pharoah Sanders", "Alice Coltrane", "Gary Bartz", "Doug Carn", "Charles Tolliver", "Sun Ra", "McCoy Tyner", "Billy Harper", "Azar Lawrence", "Archie Shepp", "Leon Thomas", "Norman Connors", "Dorothy Ashby", "Yusef Lateef", "Phil Ranelin", "The Pyramids", "Joe Henderson", "Bobby Hutcherson"],
    loopQueries: ["modal jazz piano loop", "harp loop", "jazz bass loop"],
    vocalQueries: ["jazz vocal chant", "spiritual vocal"],
  },
  {
    id: "library",
    name: "Library & Soundtracks",
    blurb: "Italian score, KPM and De Wolfe library cuts",
    years: [1965, 1982],
    artists: ["Piero Umiliani", "Alessandro Alessandroni", "Piero Piccioni", "Armando Trovajoli", "Bruno Nicolai", "Stefano Torossi", "Ennio Morricone", "Goblin", "Alan Hawkshaw", "Keith Mansfield", "Brian Bennett", "Johnny Pearson", "Janko Nilović", "Jean-Jacques Perrey", "Lalo Schifrin", "David Axelrod", "Roy Budd", "Nino Nardini"],
    loopQueries: ["library music loop", "70s soundtrack loop", "harpsichord loop"],
    vocalQueries: ["female choir vocal", "wordless vocal"],
  },
  {
    id: "disco",
    name: "70s Disco",
    blurb: "Strings, Rhodes and four-on-the-floor",
    years: [1974, 1983],
    artists: ["Chic", "Cerrone", "Patrick Adams", "Loleatta Holloway", "Gino Soccio", "Instant Funk", "Change", "First Choice", "Candi Staton", "Sylvester", "Double Exposure", "The Salsoul Orchestra", "Skyy", "Dinosaur L", "Inner Life", "Logg", "Unlimited Touch", "Taana Gardner", "Peech Boys", "Lime", "Raw Silk", "Donna Summer"],
    loopQueries: ["disco strings loop", "disco bass loop", "disco guitar loop"],
    vocalQueries: ["disco vocal", "diva vocal"],
  },
  {
    id: "boogie",
    name: "80s Boogie & Modern Soul",
    blurb: "Synth bass, claps and slick harmonies",
    years: [1979, 1988],
    artists: ["D Train", "Kashif", "Leroy Burgess", "Mtume", "Yarbrough & Peoples", "The System", "Shalamar", "Rene & Angela", "Lillo Thomas", "Dayton", "Midnight Star", "Zapp", "Jean Carn", "Patrice Rushen", "Colonel Abrams", "Imagination", "Central Line", "Atmosfear", "Light of the World", "Nu Shooz"],
    loopQueries: ["boogie synth bass loop", "80s funk loop", "talkbox loop"],
    vocalQueries: ["80s soul vocal", "boogie vocal"],
  },
  {
    id: "italo",
    name: "Italo & Cosmic Disco",
    blurb: "Arpeggios, vocoders and Euro synths",
    years: [1979, 1988],
    artists: ["Klein + M.B.O.", "Kano", "Gazebo", "Ryan Paris", "Den Harrow", "Fun Fun", "Valerie Dore", "Doctor's Cat", "Alexander Robotnick", "Hipnosis", "Koto", "Casco", "Gary Low", "Easy Going", "Mike Mareen", "Sandy Marton", "Pino D'Angiò"],
    loopQueries: ["italo disco arpeggio loop", "synth bass arp loop", "vocoder loop"],
    vocalQueries: ["italo vocal", "vocoder vocal"],
  },
  {
    id: "chicago",
    name: "Chicago & Early House",
    blurb: "Jackin' chords, acid lines and gospel divas",
    years: [1985, 1999],
    artists: ["Frankie Knuckles", "Mr. Fingers", "Larry Heard", "Marshall Jefferson", "Ten City", "Joe Smooth", "Adonis", "Phuture", "Fingers Inc.", "Lil Louis", "Ron Trent", "Chez Damier", "Glenn Underground", "Paul Johnson", "DJ Sneak", "Cajmere", "Robert Owens", "Jamie Principle", "Kerri Chandler", "Masters at Work"],
    loopQueries: ["house organ loop", "deep house chord loop", "piano house loop"],
    vocalQueries: ["house vocal", "diva house vocal"],
  },
  {
    id: "techno",
    name: "Detroit & Early Techno",
    blurb: "Strings, stabs and machine soul",
    years: [1981, 2003],
    artists: ["Derrick May", "Juan Atkins", "Model 500", "Cybotron", "Carl Craig", "Kevin Saunderson", "Jeff Mills", "Robert Hood", "Underground Resistance", "Drexciya", "Octave One", "Galaxy 2 Galaxy", "Stacey Pullen", "Kenny Larkin", "Claude Young", "Aux 88", "Dopplereffekt", "Blake Baxter", "Eddie Fowlkes", "Los Hermanos", "Anthony Shakir"],
    loopQueries: ["detroit techno pad loop", "acid 303 loop", "techno synth stab loop"],
    vocalQueries: ["techno vocal", "spoken word vocal"],
  },
  {
    id: "ukg",
    name: "UK Garage & 2-Step",
    blurb: "Shuffled beats, chopped vocals, sub bass",
    years: [1996, 2004],
    artists: ["MJ Cole", "Artful Dodger", "Todd Edwards", "Wookie", "Zed Bias", "El-B", "Sweet Female Attitude", "Shanks & Bigfoot", "DJ Luck & MC Neat", "Craig David", "Ms. Dynamite", "Dem 2", "Groove Chronicles", "Tuff Jam", "Architechs", "Oxide & Neutrino", "So Solid Crew", "Daniel Bedingfield"],
    loopQueries: ["2 step garage loop", "uk garage bass loop", "garage organ loop"],
    vocalQueries: ["uk garage vocal", "r&b vocal chop"],
  },
  {
    id: "2000s",
    name: "2000s House & Minimal",
    blurb: "Detroit soul, filter house, Berlin minimal",
    years: [1998, 2010],
    artists: ["Moodymann", "Theo Parrish", "Isolée", "Ricardo Villalobos", "Superpitcher", "Basement Jaxx", "Stardust", "Spiller", "Modjo", "Mylo", "Booka Shade", "Akufen", "Luomo", "Herbert", "Âme", "Henrik Schwarz", "Matthew Dear", "Lawrence", "Robag Wruhme", "Pépé Bradock", "DJ Koze", "Recloose"],
    loopQueries: ["filter house loop", "minimal synth loop", "french house chord loop"],
    vocalQueries: ["house vocal chop", "female vocal phrase"],
  },
  {
    id: "rnb",
    name: "90s R&B",
    blurb: "Harmonies and acapellas that flip well",
    years: [1990, 2002],
    artists: ["SWV", "Jodeci", "Aaliyah", "Brandy", "Monica", "Total", "702", "Mary J. Blige", "Faith Evans", "Tony! Toni! Toné!", "Shai", "Changing Faces", "Groove Theory", "Zhané", "Soul II Soul", "Jon B.", "Ginuwine", "Dru Hill", "Xscape", "Brownstone", "Mint Condition"],
    loopQueries: ["90s r&b loop", "new jack swing loop", "r&b keys loop"],
    vocalQueries: ["r&b acapella", "90s r&b vocal"],
  },
  {
    id: "brazil",
    name: "Brazilian Grooves",
    blurb: "MPB, samba-funk, bossa and soul",
    years: [1963, 1986],
    artists: ["Marcos Valle", "Jorge Ben", "Azymuth", "Tim Maia", "Banda Black Rio", "Joyce", "Arthur Verocai", "Cassiano", "Hyldon", "Gal Costa", "Elis Regina", "João Donato", "Edu Lobo", "Ivan Lins", "Lô Borges", "Milton Nascimento", "Erasmo Carlos", "Di Melo", "Gerson King Combo", "Toninho Horta", "Novos Baianos", "Wilson Simonal", "Antonio Adolfo", "Quarteto em Cy"],
    loopQueries: ["bossa nova guitar loop", "samba loop", "brazilian rhodes loop"],
    vocalQueries: ["portuguese vocal", "bossa nova vocal"],
  },
  {
    id: "latin",
    name: "Latin & Salsa",
    blurb: "Fania horns, boogaloo and descarga",
    years: [1965, 1985],
    artists: ["Joe Bataan", "Ray Barretto", "Eddie Palmieri", "Willie Colón", "Héctor Lavoe", "Pete Rodríguez", "Joe Cuba", "Ricardo Ray", "Johnny Colón", "Harvey Averne", "Mongo Santamaría", "Cal Tjader", "Larry Harlow", "Típica 73", "Fania All Stars", "Celia Cruz", "Bobby Valentín", "Jimmy Sabater", "Lebron Brothers", "Johnny Pacheco"],
    loopQueries: ["salsa piano loop", "latin horn loop", "montuno loop"],
    vocalQueries: ["spanish vocal", "latin vocal"],
  },
  {
    id: "afro",
    name: "Afrobeat & African Funk",
    blurb: "Lagos, Accra and Addis in the 70s",
    years: [1968, 1985],
    artists: ["Fela Kuti", "Tony Allen", "Ebo Taylor", "Orlando Julius", "Mulatu Astatke", "Mahmoud Ahmed", "Hailu Mergia", "William Onyeabor", "Manu Dibango", "Pat Thomas", "Gyedu-Blay Ambolley", "Orchestra Baobab", "Francis Bebey", "Lijadu Sisters", "Geraldo Pino", "Celestine Ukwu", "K. Frimpong"],
    loopQueries: ["afrobeat guitar loop", "highlife guitar loop", "afro funk horn loop"],
    vocalQueries: ["african vocal", "afrobeat vocal chant"],
  },
  {
    id: "citypop",
    name: "Japanese City Pop & Fusion",
    blurb: "Glossy 80s Tokyo: AOR, fusion, synth pop",
    years: [1975, 1990],
    artists: ["Tatsuro Yamashita", "Mariya Takeuchi", "Taeko Ohnuki", "Anri", "Hiroshi Sato", "Haruomi Hosono", "Yellow Magic Orchestra", "Casiopea", "Masayoshi Takanaka", "Minako Yoshida", "Tomoko Aran", "Junko Yagami", "Miki Matsubara", "Ryuichi Sakamoto", "Kingo Hamada", "Toshiki Kadomatsu"],
    loopQueries: ["city pop loop", "jazz fusion loop", "80s japanese synth loop"],
    vocalQueries: ["japanese vocal", "city pop vocal"],
  },
  {
    id: "dub",
    name: "Roots Reggae & Dub",
    blurb: "Studio One to Black Ark",
    years: [1968, 1985],
    artists: ["King Tubby", "Lee \"Scratch\" Perry", "Augustus Pablo", "Scientist", "Prince Jammy", "The Congos", "The Abyssinians", "Burning Spear", "Culture", "Horace Andy", "Gregory Isaacs", "Dennis Brown", "Johnny Clarke", "The Heptones", "Keith Hudson", "Yabby You", "Sly & Robbie", "Black Uhuru", "Linval Thompson", "Junior Byles"],
    loopQueries: ["dub bass loop", "reggae organ loop", "melodica loop"],
    vocalQueries: ["reggae vocal", "dub vocal"],
  },
  {
    id: "reggaerock",
    name: "Reggae Rock & Ska",
    blurb: "Sublime-era Long Beach and beyond",
    years: [1990, 2012],
    artists: ["Sublime", "Long Beach Dub Allstars", "Slightly Stoopid", "311", "Sugar Ray", "Pepper", "Dirty Heads", "Rebelution", "Incubus", "No Doubt", "Sublime with Rome", "Tribal Seeds", "Iration", "The Expendables", "Stick Figure"],
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
