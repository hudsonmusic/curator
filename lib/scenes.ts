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
    artists: ["Pete Rock & C.L. Smooth", "Black Sheep", "Main Source", "Souls of Mischief", "Organized Konfusion", "Showbiz & A.G.", "Diamond D", "O.C.", "Black Moon", "Smif-N-Wessun", "Artifacts", "Da Bush Babees", "Lord Finesse", "Large Professor", "Jeru the Damaja", "Lords of the Underground", "Ultramagnetic MC's", "Godfather Don", "The Beatnuts", "Natural Elements", "Mood", "J-Live", "Sadat X", "Kool Keith", "Shabaam Sahdeeq", "Mr. Voodoo"],
    loopQueries: ["jazz rhodes loop", "dusty soul loop", "vinyl piano loop"],
    vocalQueries: ["rap acapella", "hip hop vocal phrase"],
  },
  {
    id: "soul",
    name: "70s Soul & Jazz-Funk",
    blurb: "The records boom bap was built from",
    years: [1968, 1981],
    artists: ["Lonnie Liston Smith", "Donald Byrd", "Weldon Irvine", "The Meters", "Ramsey Lewis", "Gary Bartz", "Doug Carn", "Ronnie Foster", "Johnny Hammond", "Idris Muhammad", "Charles Earland", "Lou Donaldson", "Rotary Connection", "Syl Johnson", "Ann Peebles", "The Blackbyrds", "Leon Ware", "Shuggie Otis", "Gene Harris", "Bobbi Humphrey", "Funk Inc.", "Rusty Bryant", "Reuben Wilson", "Boogaloo Joe Jones", "Eddie Russ", "Harvey Mason"],
    loopQueries: ["rhodes loop", "jazz funk loop", "soul strings loop"],
    vocalQueries: ["soul vocal", "gospel vocal"],
  },
  {
    id: "spiritual",
    name: "Spiritual & Modal Jazz",
    blurb: "Harps, chants and long modal vamps",
    years: [1965, 1981],
    artists: ["Pharoah Sanders", "Gary Bartz", "Doug Carn", "Charles Tolliver", "Billy Harper", "Azar Lawrence", "Archie Shepp", "Leon Thomas", "Norman Connors", "Dorothy Ashby", "Yusef Lateef", "Phil Ranelin", "The Pyramids", "Oneness of Juju", "Marion Brown", "Byron Morris", "Carlos Garnett", "Wendell Harrison", "Michael White"],
    loopQueries: ["modal jazz piano loop", "harp loop", "jazz bass loop"],
    vocalQueries: ["jazz vocal chant", "spiritual vocal"],
  },
  {
    id: "library",
    name: "Library & Soundtracks",
    blurb: "Italian score, KPM and De Wolfe library cuts",
    years: [1965, 1982],
    artists: ["Piero Umiliani", "Alessandro Alessandroni", "Piero Piccioni", "Armando Trovajoli", "Bruno Nicolai", "Stefano Torossi", "Alan Hawkshaw", "Keith Mansfield", "Brian Bennett", "Johnny Pearson", "Janko Nilović", "Jean-Jacques Perrey", "Roy Budd", "Nino Nardini", "Giuliano Sorgini", "Sven Libaek", "Daniele Patucchi", "Egisto Macchi", "Puccio Roelens", "Gerhard Trede"],
    loopQueries: ["library music loop", "70s soundtrack loop", "harpsichord loop"],
    vocalQueries: ["female choir vocal", "wordless vocal"],
  },
  {
    id: "disco",
    name: "70s Disco",
    blurb: "Strings, Rhodes and four-on-the-floor",
    years: [1974, 1983],
    artists: ["Cerrone", "Patrick Adams", "Loleatta Holloway", "Gino Soccio", "Instant Funk", "Change", "First Choice", "Double Exposure", "The Salsoul Orchestra", "Skyy", "Dinosaur L", "Inner Life", "Logg", "Unlimited Touch", "Taana Gardner", "Peech Boys", "Lime", "Raw Silk", "Theo Vaness", "Voyage", "Machine", "Kebekelektrik", "Sharon Redd"],
    loopQueries: ["disco strings loop", "disco bass loop", "disco guitar loop"],
    vocalQueries: ["disco vocal", "diva vocal"],
  },
  {
    id: "boogie",
    name: "80s Boogie & Modern Soul",
    blurb: "Synth bass, claps and slick harmonies",
    years: [1979, 1988],
    artists: ["D Train", "Kashif", "Leroy Burgess", "Mtume", "Yarbrough & Peoples", "The System", "Rene & Angela", "Lillo Thomas", "Dayton", "Jean Carn", "Patrice Rushen", "Colonel Abrams", "Central Line", "Atmosfear", "Light of the World", "Starpoint", "Sinnamon", "Gary's Gang", "Prince Charles and the City Beat Band", "Glenn Jones"],
    loopQueries: ["boogie synth bass loop", "80s funk loop", "talkbox loop"],
    vocalQueries: ["80s soul vocal", "boogie vocal"],
  },
  {
    id: "italo",
    name: "Italo & Cosmic Disco",
    blurb: "Arpeggios, vocoders and Euro synths",
    years: [1979, 1988],
    artists: ["Klein + M.B.O.", "Kano", "Fun Fun", "Valerie Dore", "Doctor's Cat", "Alexander Robotnick", "Hipnosis", "Koto", "Casco", "Gary Low", "Easy Going", "Mike Mareen", "Sandy Marton", "Pino D'Angiò", "Peter Richard", "Radiorama", "Mr. Flagio", "Trans-X"],
    loopQueries: ["italo disco arpeggio loop", "synth bass arp loop", "vocoder loop"],
    vocalQueries: ["italo vocal", "vocoder vocal"],
  },
  {
    id: "chicago",
    name: "Chicago & Early House",
    blurb: "Jackin' chords, acid lines and gospel divas",
    years: [1985, 1999],
    artists: ["Mr. Fingers", "Larry Heard", "Ten City", "Joe Smooth", "Adonis", "Phuture", "Fingers Inc.", "Lil Louis", "Ron Trent", "Chez Damier", "Glenn Underground", "Paul Johnson", "DJ Sneak", "Cajmere", "Robert Owens", "Jamie Principle", "Virgo", "K-Alexi", "Armando", "Tyree Cooper", "Steve Poindexter", "Farley Jackmaster Funk"],
    loopQueries: ["house organ loop", "deep house chord loop", "piano house loop"],
    vocalQueries: ["house vocal", "diva house vocal"],
  },
  {
    id: "techno",
    name: "Detroit & Early Techno",
    blurb: "Strings, stabs and machine soul",
    years: [1981, 2003],
    artists: ["Juan Atkins", "Model 500", "Cybotron", "Robert Hood", "Underground Resistance", "Drexciya", "Octave One", "Galaxy 2 Galaxy", "Stacey Pullen", "Kenny Larkin", "Claude Young", "Aux 88", "Dopplereffekt", "Blake Baxter", "Eddie Fowlkes", "Los Hermanos", "Anthony Shakir", "Suburban Knight", "Scan 7", "Terrence Dixon", "DJ Bone", "Alton Miller", "Rhythim Is Rhythim"],
    loopQueries: ["detroit techno pad loop", "acid 303 loop", "techno synth stab loop"],
    vocalQueries: ["techno vocal", "spoken word vocal"],
  },
  {
    id: "ukg",
    name: "UK Garage & 2-Step",
    blurb: "Shuffled beats, chopped vocals, sub bass",
    years: [1996, 2004],
    artists: ["MJ Cole", "Todd Edwards", "Wookie", "Zed Bias", "El-B", "Sweet Female Attitude", "DJ Luck & MC Neat", "Dem 2", "Groove Chronicles", "Tuff Jam", "Architechs", "Grant Nelson", "Dreem Teem", "Scott Garcia", "Steve Gurley", "Club Asylum"],
    loopQueries: ["2 step garage loop", "uk garage bass loop", "garage organ loop"],
    vocalQueries: ["uk garage vocal", "r&b vocal chop"],
  },
  {
    id: "2000s",
    name: "2000s House & Minimal",
    blurb: "Detroit soul, filter house, Berlin minimal",
    years: [1998, 2010],
    artists: ["Moodymann", "Theo Parrish", "Isolée", "Ricardo Villalobos", "Superpitcher", "Akufen", "Luomo", "Herbert", "Âme", "Henrik Schwarz", "Matthew Dear", "Lawrence", "Robag Wruhme", "Pépé Bradock", "DJ Koze", "Recloose", "Move D", "Losoul", "Jan Jelinek", "Ripperton", "Melchior Productions"],
    loopQueries: ["filter house loop", "minimal synth loop", "french house chord loop"],
    vocalQueries: ["house vocal chop", "female vocal phrase"],
  },
  {
    id: "rnb",
    name: "90s R&B",
    blurb: "Harmonies and acapellas that flip well",
    years: [1990, 2002],
    artists: ["SWV", "Jodeci", "Total", "702", "Tony! Toni! Toné!", "Shai", "Changing Faces", "Groove Theory", "Zhané", "Soul II Soul", "Jon B.", "Dru Hill", "Xscape", "Brownstone", "Mint Condition", "Kut Klose", "Intro", "H-Town", "Allure", "Az Yet", "Ruff Endz"],
    loopQueries: ["90s r&b loop", "new jack swing loop", "r&b keys loop"],
    vocalQueries: ["r&b acapella", "90s r&b vocal"],
  },
  {
    id: "brazil",
    name: "Brazilian Grooves",
    blurb: "MPB, samba-funk, bossa and soul",
    years: [1963, 1986],
    artists: ["Marcos Valle", "Azymuth", "Banda Black Rio", "Joyce", "Arthur Verocai", "Cassiano", "Hyldon", "João Donato", "Edu Lobo", "Ivan Lins", "Lô Borges", "Erasmo Carlos", "Di Melo", "Gerson King Combo", "Toninho Horta", "Novos Baianos", "Wilson Simonal", "Antonio Adolfo", "Quarteto em Cy", "Marku Ribas", "Walter Franco", "Taiguara", "Ana Mazzotti", "Tânia Maria"],
    loopQueries: ["bossa nova guitar loop", "samba loop", "brazilian rhodes loop"],
    vocalQueries: ["portuguese vocal", "bossa nova vocal"],
  },
  {
    id: "latin",
    name: "Latin & Salsa",
    blurb: "Fania horns, boogaloo and descarga",
    years: [1965, 1985],
    artists: ["Joe Bataan", "Ray Barretto", "Eddie Palmieri", "Willie Colón", "Pete Rodríguez", "Joe Cuba", "Ricardo Ray", "Johnny Colón", "Harvey Averne", "Mongo Santamaría", "Cal Tjader", "Larry Harlow", "Típica 73", "Bobby Valentín", "Jimmy Sabater", "Lebron Brothers", "Joey Pastrana", "Bobby Matos", "The Latinaires", "Ray Terrace"],
    loopQueries: ["salsa piano loop", "latin horn loop", "montuno loop"],
    vocalQueries: ["spanish vocal", "latin vocal"],
  },
  {
    id: "afro",
    name: "Afrobeat & African Funk",
    blurb: "Lagos, Accra and Addis in the 70s",
    years: [1968, 1985],
    artists: ["Tony Allen", "Ebo Taylor", "Orlando Julius", "William Onyeabor", "Pat Thomas", "Gyedu-Blay Ambolley", "Orchestra Baobab", "Francis Bebey", "Lijadu Sisters", "Geraldo Pino", "Celestine Ukwu", "K. Frimpong", "Blo", "Monomono", "The Funkees", "Joni Haastrup", "Tunde Williams", "Peter King"],
    loopQueries: ["afrobeat guitar loop", "highlife guitar loop", "afro funk horn loop"],
    vocalQueries: ["african vocal", "afrobeat vocal chant"],
  },
  {
    id: "citypop",
    name: "Japanese City Pop & Fusion",
    blurb: "Glossy 80s Tokyo: AOR, fusion, synth pop",
    years: [1975, 1990],
    artists: ["Taeko Ohnuki", "Hiroshi Sato", "Haruomi Hosono", "Masayoshi Takanaka", "Minako Yoshida", "Tomoko Aran", "Junko Yagami", "Miki Matsubara", "Kingo Hamada", "Toshiki Kadomatsu", "Yurie Kokubu", "Hitomi Tohyama", "Akiko Yano", "Makoto Matsushita", "Ginji Ito"],
    loopQueries: ["city pop loop", "jazz fusion loop", "80s japanese synth loop"],
    vocalQueries: ["japanese vocal", "city pop vocal"],
  },
  {
    id: "dub",
    name: "Roots Reggae & Dub",
    blurb: "Studio One to Black Ark",
    years: [1968, 1985],
    artists: ["King Tubby", "Augustus Pablo", "Scientist", "Prince Jammy", "The Congos", "The Abyssinians", "Culture", "Horace Andy", "Johnny Clarke", "The Heptones", "Keith Hudson", "Yabby You", "Linval Thompson", "Junior Byles", "Prince Far I", "Creation Rebel", "The Revolutionaries", "Glen Brown", "Vivian Jackson", "Tappa Zukie"],
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
  {
    id: "ethio",
    name: "Ethio-Jazz & Éthiopiques",
    blurb: "Addis Ababa's golden age: horns, organ, minor modes",
    years: [1965, 1978],
    artists: ["Mulatu Astatke", "Mahmoud Ahmed", "Hailu Mergia", "Alemayehu Eshete", "Tlahoun Gèssèssè", "Getatchew Mekurya", "Muluken Melesse", "Ali Birra", "Walias Band", "Girma Bèyènè", "Bizunesh Bekele", "Hirut Bekele"],
    loopQueries: ["ethiopian organ loop", "pentatonic sax loop", "ethio jazz loop"],
    vocalQueries: ["amharic vocal", "ethiopian vocal"],
  },
  {
    id: "anatolian",
    name: "Anatolian Psych",
    blurb: "Fuzz bağlama and Istanbul organ grooves",
    years: [1968, 1980],
    artists: ["Erkin Koray", "Barış Manço", "Selda Bağcan", "Cem Karaca", "Mustafa Özkent", "Moğollar", "Fikret Kızılok", "Ersen", "Edip Akbayram", "Bunalımlar", "3 Hürel", "Kardaşlar"],
    loopQueries: ["turkish psych guitar loop", "saz loop", "fuzz guitar loop"],
    vocalQueries: ["turkish vocal", "anatolian vocal"],
  },
  {
    id: "kosmische",
    name: "Kosmische & Krautrock",
    blurb: "Motorik drums and sequencer drift",
    years: [1970, 1982],
    artists: ["Cluster", "Harmonia", "Neu!", "Michael Rother", "Popol Vuh", "Ash Ra Tempel", "Manuel Göttsching", "Klaus Schulze", "Moebius & Plank", "Roedelius", "Deuter", "Between", "Embryo", "Agitation Free", "La Düsseldorf"],
    loopQueries: ["krautrock drum loop", "analog sequencer loop", "motorik loop"],
    vocalQueries: ["german spoken vocal", "ethereal vocal"],
  },
  {
    id: "balearic",
    name: "Balearic & Kankyō",
    blurb: "Ibiza sunsets and Japanese environmental music",
    years: [1980, 1995],
    artists: ["Gigi Masin", "Woo", "Pep Llopis", "Suso Saiz", "Finis Africae", "Penguin Cafe Orchestra", "The Durutti Column", "Jon Hassell", "Hiroshi Yoshimura", "Midori Takada", "Satoshi Ashikawa", "Yoshio Ojima", "Inoyama Land", "Laraaji", "Sueño Latino"],
    loopQueries: ["ambient pad loop", "balearic guitar loop", "marimba loop"],
    vocalQueries: ["breathy vocal", "ambient vocal"],
  },
  {
    id: "minimalwave",
    name: "Minimal Wave & Synth DIY",
    blurb: "Bedroom synths, drum machines, cold vocals",
    years: [1979, 1987],
    artists: ["Martin Dupont", "Oppenheimer Analysis", "Linear Movement", "Das Ding", "Kas Product", "Mathématiques Modernes", "Esplendor Geométrico", "Solid Space", "Deux", "Twilight Ritual", "Max Berlin", "Wolfgang Riechmann", "Absolute Body Control", "Ruth"],
    loopQueries: ["analog synth loop", "drum machine loop", "cold wave loop"],
    vocalQueries: ["french spoken vocal", "cold wave vocal"],
  },
  {
    id: "northern",
    name: "Northern Soul & Crossover",
    blurb: "Stompers and rarities from the all-nighters",
    years: [1963, 1976],
    artists: ["Frank Wilson", "Gloria Jones", "Dobie Gray", "Darrell Banks", "Tony Clarke", "Rose Battiste", "The Velvelettes", "Chuck Wood", "Eddie Holman", "The Precisions", "Major Lance", "Jimmy Radcliffe", "Linda Jones", "Dean Parrish", "The Flirtations", "Doris Troy"],
    loopQueries: ["northern soul drum loop", "60s soul loop", "motown bass loop"],
    vocalQueries: ["60s soul vocal", "gospel vocal"],
  },
  {
    id: "memphis",
    name: "Memphis Rap Tapes",
    blurb: "Lo-fi tape hiss, cowbells and horror samples",
    years: [1991, 1999],
    artists: ["DJ Spanish Fly", "Tommy Wright III", "Kingpin Skinny Pimp", "Playa Fly", "Gangsta Pat", "Al Kapone", "Lord Infamous", "Koopsta Knicca", "Indo G", "Gangsta Boo", "La Chat", "DJ Squeeky", "T-Rock"],
    loopQueries: ["memphis rap loop", "cowbell 808 loop", "dark piano loop"],
    vocalQueries: ["memphis rap vocal", "dark chant vocal"],
  },
  {
    id: "jungle",
    name: "Early Jungle & Hardcore",
    blurb: "Chopped amens, rave stabs and rolling subs",
    years: [1991, 1997],
    artists: ["Omni Trio", "4hero", "Rufige Kru", "Origin Unknown", "Foul Play", "Source Direct", "Doc Scott", "Peshay", "Blame", "Seba", "DJ Crystl", "Krust", "Nookie", "Hyper-On Experience", "Acen", "Bay B Kane", "Photek"],
    loopQueries: ["amen break loop", "jungle break loop", "rave stab loop"],
    vocalQueries: ["jungle vocal", "ragga vocal"],
  },
  {
    id: "electro",
    name: "Electro & Miami Bass",
    blurb: "808s, vocoders and breakdance funk",
    years: [1982, 1992],
    artists: ["Hashim", "Mantronix", "Egyptian Lover", "The Jonzun Crew", "Newcleus", "Man Parrish", "World Class Wreckin' Cru", "Arabian Prince", "Strafe", "Freestyle", "Maggotron", "Dynamix II", "Planet Patrol", "Twilight 22", "Knights of the Turntables"],
    loopQueries: ["808 electro loop", "vocoder loop", "miami bass loop"],
    vocalQueries: ["vocoder vocal", "electro rap vocal"],
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
