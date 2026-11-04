// Lumora catalog. Every title, person and line of dialogue here is invented.
// Pure data and functions: no DOM access, safe to import anywhere.

export const GENRES = [
  'Action & Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Fantasy', 'Historical',
  'Horror', 'Kids & Family', 'Mystery', 'Reality', 'Romance', 'Sci-Fi', 'Thriller',
];

/* ---------- deterministic helpers ---------- */

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seedText) {
  let a = hash(seedText);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, seedText) {
  const rand = rng(seedText);
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Same output as slugify() in js/dom.js; duplicated so this module has no imports.
function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* ---------- people ---------- */

const ACTORS = [
  'Marisol Quennell', 'Dovid Arkwright', 'Senna Valcourt', 'Tobiah Renwick', 'Anneke Solberg', 'Kofi Brandvold',
  'Yuna Halloway', 'Rafe Castellane', 'Ines Marchbank', 'Priya Venkatesan-Lowe', 'Lucan Threlfall', 'Beatrix Amankwah',
  'Oren Fairweather', 'Calla Nyström-Reyes', 'Jovan Peverell', 'Thandiwe Corrigan', 'Mateus Ellingham', 'Sorrel Ibekwe',
  'Hiroki Dunmore', 'Lark Pemberly', 'Emeka Vosloo', 'Greta Santangelo', 'Ansel Tarkovian', 'Noor Hazeldine',
  'Bastien Oyarzun', 'Clementine Rask', 'Ivo Kettleby', 'Saoirse Montclave', 'Teodor Wyndham', 'Mirela Achterberg',
  'Paolo Greaves-Lin', 'Adaeze Thornbury', 'Soren Mbatha-Vale', 'Fenna Dragomir', 'Callum Iwasaki', 'Rosalind Tembo',
  'Zeke Aldercott', 'Nadia Ferreiro-Quinn', 'Linus Okafor-Dale', 'Odessa Marwick', 'Rohan Silverlake', 'Tova Lindqvist-Shaw',
  'Emrys Calloway-Ng', 'Pilar Ostrander', 'Jun Featherstone', 'Isolde Banerjee-Cross', 'Malachi Stroud', 'Vesna Hartigan',
  'Amadou Pellerin', 'Cosima Blackwood-Rao', 'Dmitri Larkspur', 'Hana Westerby', 'Gideon Tavares-Holt', 'Mei-Lin Ashgrove',
  'Quillan Abara', 'Tamsin Volkova-Reed', 'Nikolai Brightwater', 'Wrenna Castellano', 'Ezekiel Moon-Harris', 'Liesel Adomako',
  'Santiago Merriweather-Ko', 'Aurelie Dunstable', 'Tariq Hollingbourne', 'Bronwen Espinal', 'Kaito Rutherglen', 'Maeve Oduya',
  'Stellan Pradhan', 'Corisande Lwazi', 'Fitz Ozturk-Bell', 'Rhiannon Takeda',
];

const CREATORS = [
  'Halima Vostrikov', 'Jonas Ferncastle', 'Rukmini Dale', 'Edmund Sakurai-Ford', 'Paloma Withers', 'Anselm Oduro',
  'Greer Tolliver-Sato', 'Ikenna Marsh-Bellamy', 'Solveig Araujo', 'Tristan Kovalenko-Hart', 'Lucinda Mbeki-Rowe', 'Arvid Castellan',
  'Neha Winterbourne', 'Corwin Adeleke', 'Marguerite Sandoval-Pike', 'Yusuf Harrowby', 'Delphine Nakashima-Boyd', 'Raffaele Ostby',
  'Wilhelmina Teo', 'Bartholomew Achebe-Lund', 'Sunniva Ravenscroft', 'Mikael Dasgupta-Wren', 'Ottilie Fonseca', 'Gethin Yamamura',
];

/* ---------- subtitle pools, keyed by a title's primary genre ---------- */

const LINE_POOLS = {
  'Action & Adventure': ['Hold on to something. No, something bolted down.', 'We have ninety seconds and I have used thirty of them explaining this.', 'That was the good plan. You will not like the other one.', 'Tell the pilot we are coming in fast and possibly on fire.', 'Nobody said it would be easy. They said it would be Tuesday.', 'If that bridge goes, we go with it.', 'Stay low, stay quiet, and stop smiling.', 'I have never once finished a job on the first try.'],
  Animation: ['Did the sky just blink at us?', 'Every map I own says this place does not exist.', 'You are braver than you look, and you look terrified.', 'Quick, before the wind changes its mind.', 'I told you the river could hear us.', 'We could turn back. We will not, but we could.', 'Some doors only open when you stop pushing.', 'Hang on. I think the mountain is waking up.'],
  Comedy: ['In my defense, the sign was very poorly worded.', 'I am not panicking. This is my regular face now.', 'Who authorized the goat?', 'Let us all agree that this meeting never happened.', 'That is the worst idea I have heard today, and I had breakfast with you.', 'I would like to speak to whoever is in charge of me.', 'Technically, it is only illegal if it works.', 'Please stop helping. I am begging you to stop helping.'],
  Crime: ['Everybody owes somebody in this town.', 'The money always remembers where it came from.', 'You keep calling it a favor. I keep hearing a threat.', 'He was careful for twenty years and careless for one night.', 'Nobody saw anything. They never do.', 'Check the dates again. Someone was sloppy.', 'I can protect you until Friday. After that, you should learn to swim.', 'A clean record just means nobody looked.'],
  Documentary: ['For most of recorded history, nobody thought to look here.', 'What we found surprised even the people who had spent decades searching.', 'It takes eleven years to see the result of a single decision.', 'The first attempt failed. So did the next forty.', 'You learn to listen differently out here.', 'No instrument had ever recorded a sound like it.', 'Each generation inherits the work and adds a little.', 'This may be the last season anyone can do this.'],
  Drama: ['You never asked me what I gave up.', 'We can talk about it, or we can keep setting the table.', 'I came back for the funeral. I stayed for the argument.', 'Your father said the same thing, in that same chair.', 'Some things you only forgive after you stop trying.', 'I am not angry. I am just finally awake.', 'It is a small town. Grief gets around.', 'Tell me honestly, and then we will never speak of it again.'],
  Fantasy: ['The old roads do not forgive a broken promise.', 'Every crown is forged from somebody else\'s silence.', 'The forest has been expecting you for quite some time.', 'Magic is only a debt nobody has called in yet.', 'Do not say its name under an open sky.', 'I have read that prophecy. It has terrible grammar.', 'Swear it on iron, or do not swear at all.', 'When the bells ring backward, run.'],
  Historical: ['The telegraph says the war is over. The war has not heard yet.', 'There will be no statues of the people who did the work.', 'They have changed the map again, and we were not consulted.', 'I signed that treaty with a shaking hand.', 'Winter will decide this, not the generals.', 'Your family has owned this valley for two hundred years. So has mine.', 'History will be written by whoever can still afford ink.', 'Burn the letters. All but the last one.'],
  Horror: ['Do not answer it. That is not your mother\'s voice.', 'How long has that door been there?', 'We counted six of us when we came in.', 'It only moves when you stop looking.', 'The previous tenants left in rather a hurry.', 'Listen. The house has gone quiet again.', 'Whatever you heard in the walls, it heard you too.', 'Turn the light back on. Please turn it back on.'],
  'Kids & Family': ['Wow, that is the biggest puddle in the whole wide world!', 'Teamwork makes the whole thing wobble less.', 'I have an idea, and it is only a little bit silly.', 'It is okay to be scared. I am scared too. Let us go together.', 'Everybody ready? One, two, three, jump!', 'Sharing is easier when there are extra biscuits.', 'That was not a mistake. That was a surprise!', 'Goodnight, everyone. Tomorrow we try again.'],
  Mystery: ['The clock in the study was stopped on purpose.', 'Everyone in this house has lied to me today, including the butler\'s dog.', 'Why would anyone steal only the last page?', 'She knew about the key before anyone told her.', 'There are two sets of footprints and only one set of boots.', 'That photograph was taken after she disappeared.', 'Let us assume, for a moment, that the victim planned this.', 'The answer has been on that wall for thirty years.'],
  Reality: ['I did not come all this way to go home on a technicality.', 'Teams, you have one hour, and the clock starts now.', 'Honestly, that is the best thing I have tasted all season.', 'I am shaking. Is everyone else shaking?', 'One of you will be leaving us tonight.', 'We had a strategy until about four minutes ago.', 'That was bold. I am not sure it was wise, but it was bold.', 'For the first time this competition, I think we can win this.'],
  Romance: ['You remembered how I take my coffee, and that is the problem.', 'I have written you nine letters. This is the first I am brave enough to hand you.', 'Ask me to stay. Just once, ask me.', 'We were terrible at this the first time, too.', 'It is raining, and you have no umbrella, and I would like to walk you home.', 'You could have told me you were leaving.', 'I keep meaning to stop thinking about you.', 'Dance with me. Nobody here knows either of us.'],
  'Sci-Fi': ['The signal is repeating, but it is not repeating the same thing.', 'That reading is impossible. Run it again.', 'We lost contact with Earth eleven days ago, and nobody mentioned it.', 'The ship says we are home. The ship has been wrong before.', 'You are talking about a machine that remembers the future.', 'Whoever built this knew we would come.', 'Life support gives us nine hours. Eight, if you keep shouting.', 'Do you ever wonder who is reading our logs?'],
  Thriller: ['You were never supposed to see that file.', 'Do not look up. Walk to the elevator.', 'They already know. The question is how long they have known.', 'Trust me for exactly the next four minutes.', 'That number has been calling your phone since before you bought it.', 'Somebody in this room is reporting to them.', 'If I am not back by midnight, go to the second address.', 'He is not running from them. He is leading us to them.'],
};

/* ---------- episode word lists ---------- */

const EP_WORDS = {
  fiction: {
    nouns: ['Lighthouse', 'Witness', 'Inheritance', 'Ledger', 'Crossing', 'Bargain', 'Stranger', 'Reckoning', 'Tide', 'Promise', 'Vault', 'Confession', 'Fever', 'Harvest', 'Blackout', 'Visitor', 'Keepsake', 'Rumor', 'Foundry', 'Cartographer', 'Telegram', 'Overcoat', 'Understudy', 'Lantern', 'Ransom', 'Eclipse', 'Orchard', 'Debt', 'Echo', 'Margin'],
    adjs: ['Borrowed', 'Quiet', 'Second', 'Crooked', 'Burning', 'Hollow', 'Forgotten', 'Narrow', 'Velvet', 'Patient', 'Luckless', 'Sleeping', 'Silver', 'Thin', 'Long'],
    patterns: ['The {N}', 'The {A} {N}', '{N} at Dusk', 'After the {N}', 'What the {N} Kept', 'Nobody Mentions the {N}', 'The {N} Problem', 'One Last {N}', 'A {A} {N}', 'Under the {N}', 'Before the {N}', '{A} Hours'],
    openers: ['Day One', 'The First Night', 'Arrivals', 'Opening Moves', 'Where It Starts'],
    finales: ['Where It Ends', 'No Way Back', 'Home, Eventually', 'What Remains', 'Last Call', 'Daybreak'],
    synopses: [
      'An old debt comes due at the worst possible moment, and an uneasy alliance is the only way through.',
      'A secret kept for years slips out over dinner, and nobody at the table is quite who they seemed.',
      'A routine errand goes badly wrong, leaving two rivals stranded together overnight.',
      'A newcomer arrives with questions no one wants to answer, and the answers start arriving anyway.',
      'With time running short, a risky plan requires trusting the one person who has never been trustworthy.',
      'A discovery in the archives changes the shape of everything, and someone is already covering it up.',
      'Loyalties fracture after a decision made in private becomes very public.',
      'A long-buried argument resurfaces, and an apology arrives far too late to be useful.',
      'Things go quiet for one strange day, right up until a knock at the door changes the plan.',
      'A letter meant for someone else sets off a chain of small betrayals and one large one.',
      'An unexpected offer looks like salvation, but the fine print is written in somebody else\'s handwriting.',
      'A close call forces everyone to admit what they have been avoiding for months.',
      'The search for answers leads back home, to the one room nobody was allowed to enter.',
      'A trusted ally goes missing, and the clues they left behind point in an uncomfortable direction.',
      'An old friend returns with a favor to ask and a story that does not quite add up.',
      'Under pressure from all sides, a desperate gamble pays off in the most costly way imaginable.',
      'A celebration is cut short by news nobody saw coming, and the guests are asked not to leave.',
      'Someone finally tells the truth, and it turns out to be the most dangerous move of all.',
    ],
  },
  kids: {
    nouns: ['Kite', 'Pebble', 'Picnic', 'Puddle', 'Button', 'Parade', 'Lunchbox', 'Snowflake', 'Teapot', 'Balloon', 'Tree House', 'Bicycle', 'Rain Boot', 'Pancake', 'Sandcastle', 'Wagon', 'Paper Boat', 'Blanket Fort', 'Birthday Hat', 'Muddy Sock'],
    adjs: ['Wobbly', 'Giant', 'Sleepy', 'Runaway', 'Sparkly', 'Bouncy', 'Very Small', 'Noisy', 'Backwards', 'Rainy-Day'],
    patterns: ['The {A} {N}', 'The Great {N} Hunt', 'Who Took the {N}?', 'The Case of the {A} {N}', 'A {N} for Everyone', 'The {N} Song', 'Hooray for the {N}', 'The Day of the {A} {N}'],
    openers: ['Hello, Everyone!', 'The Very First Day', 'New Friends'],
    finales: ['The Big Goodnight', 'One More Adventure', 'All Together Now'],
    synopses: [
      'Something small goes missing, and the whole gang learns to look in unexpected places.',
      'A big plan goes a little wrong, so the friends find a sillier way to make it work.',
      'A new neighbor is shy at first, until a game gives everyone a reason to say hello.',
      'A rainy day seems ruined until imagination turns the living room into a grand adventure.',
      'A misunderstanding hurts some feelings, and a heartfelt sorry helps put things right.',
      'Being the smallest turns out to be exactly what the team needs today.',
      'Everyone wants to go first, but taking turns turns out to be far more fun.',
      'A tricky problem takes patience, teamwork and one very surprising snack.',
      'Trying something new feels scary, until a friend offers to try it together.',
      'A noisy mystery keeps the village awake, and the answer is sweeter than anyone guessed.',
    ],
  },
  doc: {
    nouns: ['Long Winter', 'Night Sky', 'Hidden Current', 'Oldest Maps', 'Last Keepers', 'Listening Stations', 'Slow Giants', 'Migration', 'Deep Archive', 'Salt Roads', 'Thaw', 'Quiet Ones'],
    adjs: ['Unseen', 'Fragile', 'Ancient', 'Restless', 'Vanishing'],
    patterns: ['The {N}', 'The {A} Frontier', 'Following the {N}', 'Inside the {N}', 'Chasing the {N}', 'The {A} Record', 'Keepers of the {N}'],
    openers: ['The First Question', 'Point of Departure', 'Where It Began'],
    finales: ['What Comes Next', 'The Long View', 'Inheritance'],
    synopses: [
      'A small field team spends a full season recording what has never been filmed before.',
      'Decades of painstaking records reveal a pattern no single observer could have seen.',
      'Local experts and visiting scientists compare notes, and neither side leaves unchanged.',
      'New technology finally makes it possible to revisit an old and stubborn question.',
      'A way of life passed down through generations faces its most uncertain decade.',
      'The people closest to the work explain what it costs and why they keep going.',
      'A remote expedition is nearly undone by the weather, and rewarded by a rare discovery.',
      'Rare archival footage is set beside the present day to show how much has shifted.',
    ],
  },
  reality: {
    nouns: ['Gauntlet', 'Mystery Box', 'Long Night', 'Relay', 'Final Push', 'Head to Head', 'Switch-Up', 'Blind Round', 'Team Challenge', 'Halfway Point'],
    adjs: ['Double', 'Sudden', 'Secret', 'Impossible', 'Midnight'],
    patterns: ['The {N}', '{A} Trouble', 'The {A} Round', 'Back to the {N}', 'Surviving the {N}'],
    openers: ['Welcome to the Start Line', 'First Impressions', 'Meet the Teams'],
    finales: ['The Grand Finale', 'Winner Takes All', 'Last Ones Standing'],
    synopses: [
      'The teams are shuffled without warning, and old alliances are quickly put to the test.',
      'A brutal time limit separates the planners from the improvisers, and one favorite stumbles.',
      'The judges raise the bar, and a quiet competitor finally steps into the spotlight.',
      'Exhaustion sets in as a two-part challenge forces hard choices about who to trust.',
      'A surprise twist hands the underdogs an advantage, if they are brave enough to use it.',
      'Tempers run high during the longest day yet, and someone is sent home in tears.',
      'With only a few contestants left, everyone is playing for the final and it shows.',
      'A guest expert brings a challenge nobody has trained for, with startling results.',
    ],
  },
};

function epKind(genres) {
  if (genres[0] === 'Kids & Family') return 'kids';
  if (genres[0] === 'Reality') return 'reality';
  if (genres[0] === 'Documentary') return 'doc';
  return 'fiction';
}

function generateEpisodes(titleName, seasonNo, count, kind, runtimeMin, usedTitles) {
  const words = EP_WORDS[kind];
  const key = `${titleName}|${seasonNo}`;
  const rand = rng(key);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const synopses = shuffled(words.synopses, `${key}|syn`);
  const spread = kind === 'kids' ? 2 : 6;
  const episodes = [];
  for (let number = 1; number <= count; number++) {
    let title;
    let pool = null;
    if (number === 1 && seasonNo === 1) pool = words.openers;
    if (number === count) pool = words.finales;
    for (let tries = 0; tries < 60; tries++) {
      title = pool && tries < 6
        ? pick(pool)
        : pick(words.patterns).replace('{N}', pick(words.nouns)).replace('{A}', pick(words.adjs));
      if (!usedTitles.has(title)) break;
    }
    usedTitles.add(title);
    episodes.push({
      number,
      title,
      synopsis: synopses[(number - 1) % synopses.length],
      runtimeMin: Math.max(7, runtimeMin + Math.round(rand() * spread * 2) - spread),
    });
  }
  return episodes;
}

function buildSeasons(raw) {
  const kind = epKind(raw.genres);
  const usedTitles = new Set((raw.eps || []).map(([t]) => t));
  const seasons = [];
  const total = raw.seasonCount;
  const rand = rng(`${raw.name}|count`);
  for (let number = 1; number <= total; number++) {
    let episodes;
    if (number === 1 && raw.eps) {
      episodes = raw.eps.map(([title, synopsis], i) => ({
        number: i + 1,
        title,
        synopsis,
        runtimeMin: Math.max(7, raw.runtimeMin + ((hash(title) % 7) - 3)),
      }));
    } else {
      const min = kind === 'kids' ? 8 : 6;
      const count = min + Math.floor(rand() * 5);
      episodes = generateEpisodes(raw.name, number, count, kind, raw.runtimeMin, usedTitles);
    }
    seasons.push({ number, episodes });
  }
  return seasons;
}

function buildCaptions(raw) {
  const pool = shuffled(LINE_POOLS[raw.genres[0]], `${raw.name}|lines`).slice(0, 6);
  const out = [];
  const own = raw.lines.slice();
  pool.forEach((line, i) => {
    if (i % 2 === 0 && own.length) out.push(own.shift());
    out.push(line);
  });
  return out.concat(own);
}

function pickPeople(list, count, seedText) {
  return shuffled(list, seedText).slice(0, count);
}

function build(raw, type) {
  const id = slug(raw.name);
  const genres = raw.genres;
  const title = {
    id,
    name: raw.name,
    tagline: raw.tagline,
    synopsis: raw.synopsis,
    type,
    year: raw.year,
    maturity: raw.maturity,
    match: raw.match,
    runtimeMin: raw.runtimeMin,
    seasons: type === 'series' ? buildSeasons(raw) : [],
    genres,
    moods: raw.moods,
    cast: pickPeople(ACTORS, genres[0] === 'Documentary' || genres[0] === 'Reality' ? 2 : 4 + (hash(id) % 2), `${id}|cast`),
    creators: pickPeople(CREATORS, 1 + (hash(id) % 2), `${id}|creators`),
    palette: raw.palette,
    motif: raw.motif,
    popularity: raw.popularity,
    isNew: !raw.soon && raw.year >= 2026,
    isOriginal: !!raw.original,
    comingSoon: raw.soon || null,
    subtitleLines: buildCaptions(raw),
  };
  return title;
}

const S = (raw) => build(raw, 'series');
const F = (raw) => build(raw, 'movie');

/* ---------- series ---------- */

const SERIES = [
  S({
    name: 'The Quiet Meridian', tagline: 'At the edge of everything, someone is still listening.',
    synopsis: 'Six technicians staff the last relay station before interstellar dark, passing messages between Earth and a colony fleet. When the station starts receiving replies to transmissions it has not yet sent, the crew must decide who to tell. Nobody back home seems to be answering anymore.',
    year: 2025, maturity: 'TV-14', match: 97, runtimeMin: 52, genres: ['Sci-Fi', 'Drama', 'Mystery'], moods: ['Cerebral', 'Suspenseful', 'Bittersweet'],
    palette: ['#07101f', '#27507a', '#ffb45e'], motif: 'orbit', popularity: 98, original: true, seasonCount: 3,
    lines: ['That transmission is dated next Thursday.', 'Log it, and then tell me why you are whispering.', 'There are six of us on this station. So who signed the ledger?'],
    eps: [
      ['Handover', 'Ana Revell arrives to replace a technician who left without saying goodbye, and inherits his unfinished log.'],
      ['Light Lag', 'A routine message from the colony fleet arrives eleven hours before it is sent.'],
      ['The Seventh Bunk', 'A sealed crew cabin shows signs of recent use, and the station roster refuses to explain it.'],
      ['Dead Reckoning', 'Earth stops acknowledging, and the commander quietly starts rationing the truth along with the air.'],
      ['Solar Minimum', 'A repair spacewalk during a storm of static reveals a second antenna nobody installed.'],
      ['Reply All', 'The crew sends a test question into the future, and the answer divides them.'],
      ['Parallax', 'Ana compares two versions of the same log and finds her own handwriting in both.'],
      ['Meridian', 'A fleet in distress calls for help the station may have already refused.'],
    ],
  }),
  S({
    name: 'Saltmarsh Accounts', tagline: 'The tide hides everything except the paperwork.',
    synopsis: 'A disgraced forensic accountant returns to her fishing hometown to settle her late father\'s books. The numbers point to a decades-old fraud that kept the whole harbor afloat. Exposing it could ruin everyone she has ever loved.',
    year: 2024, maturity: 'TV-MA', match: 95, runtimeMin: 48, genres: ['Crime', 'Drama', 'Thriller'], moods: ['Gritty', 'Suspenseful', 'Dark'],
    palette: ['#0c1a1c', '#3f6b68', '#e4c98a'], motif: 'waves', popularity: 93, original: true, seasonCount: 2,
    lines: ['Your father kept two sets of books. He only lied in one of them.', 'A boat that never sails still pays harbor fees. Ask me why.', 'Everyone on this quay has signed something they regret.'],
    eps: [
      ['Opening Balance', 'Nell Brannock comes home for a funeral and finds a shoebox of receipts that do not belong to any boat.'],
      ['Ghost Tonnage', 'Catch records show a trawler landing fish for nine years after it sank.'],
      ['Double Entry', 'An old family friend offers to buy the books, and then offers again less politely.'],
      ['Low Water', 'A body surfaces in the marsh with the harbor treasurer\'s keys in its pocket.'],
      ['Write-Offs', 'Nell learns exactly who was paid to forget, and her own tuition is on the list.'],
      ['Closing the Year', 'The town gathers for the annual meeting as Nell decides what to read aloud.'],
    ],
  }),
  S({
    name: 'Proof of Crumb', tagline: 'Rise. Fall. Try not to burn the place down.',
    synopsis: 'Three estranged siblings inherit a failing neighborhood bakery along with their grandmother\'s fearsome sourdough starter. None of them can bake, and only one of them can do math. Their customers, unfortunately, have strong opinions.',
    year: 2026, maturity: 'TV-14', match: 94, runtimeMin: 28, genres: ['Comedy', 'Drama'], moods: ['Witty', 'Feel-Good', 'Heartfelt'],
    palette: ['#2a1810', '#b5763f', '#ffe0a3'], motif: 'city', popularity: 91, original: true, seasonCount: 2,
    lines: ['The starter is eighty years old and it has never liked you.', 'We sold four loaves. One of them was to Mum.', 'If anyone asks, the smoke is artisanal.'],
    eps: [
      ['Starter Kit', 'The will is read, the keys are handed over, and the sourdough is already plotting.'],
      ['Knead to Know', 'A health inspector arrives on the same morning as the first attempt at croissants.'],
      ['Gluten for Punishment', 'Dee agrees to cater a wedding before checking whether anyone can make a cake.'],
      ['Half Baked', 'A viral review from a very angry local critic makes the bakery briefly and horribly famous.'],
      ['The Rye Guy', 'A charming rival opens across the street, and Max starts dating him for reconnaissance.'],
      ['Crumb Coat', 'A visit from their long-absent father tests the siblings\' truce at the worst possible hour of the night.'],
      ['Grandmother\'s Hands', 'A hidden recipe book reveals their grandmother\'s secret, and it is mostly swearing.'],
    ],
  }),
  S({
    name: 'Vesper Street', tagline: 'Every light on this block is somebody\'s alibi.',
    synopsis: 'A night-shift detective and a pawnbroker with a perfect memory keep crossing paths on the most crooked block in a rain-slick city. Each season follows one crime from a dozen doorways. Nobody on Vesper Street is innocent, but a few of them are kind.',
    year: 2022, maturity: 'TV-MA', match: 90, runtimeMin: 54, genres: ['Crime', 'Mystery'], moods: ['Dark', 'Gritty', 'Suspenseful'],
    palette: ['#120a1e', '#6a2c86', '#ff4fa0'], motif: 'neon', popularity: 82, seasonCount: 4,
    lines: ['I never forget a watch. Or the wrist it came off.', 'You want a witness on Vesper Street? Try next door to nowhere.', 'The rain does our cleaning for us.'],
  }),
  S({
    name: 'The Ninth Cartographer', tagline: 'Draw the world wrong and the world obeys.',
    synopsis: 'In a kingdom where official maps literally reshape the land, an apprentice inherits the post of royal cartographer after her master vanishes off the edge of his own chart. Rival courts want new borders drawn by morning. She has begun to suspect the land is drawing her back.',
    year: 2025, maturity: 'TV-14', match: 96, runtimeMin: 58, genres: ['Fantasy', 'Action & Adventure', 'Drama'], moods: ['Epic', 'Cerebral', 'Suspenseful'],
    palette: ['#141a2b', '#4b6a8f', '#e8c15a'], motif: 'mountains', popularity: 96, original: true, seasonCount: 3,
    lines: ['Ink is a promise the mountains are forced to keep.', 'He drew a door on the last page and walked through it.', 'Erase that river, and forty villages forget how to drink.'],
    eps: [
      ['Blank Margin', 'Apprentice Teselle finds her master\'s workshop empty and a fresh mountain range where the east road used to be.'],
      ['Scale of Leagues', 'Ordered to redraw a disputed border by dawn, Teselle learns what happened to the last person who refused.'],
      ['Here Be Nothing', 'An expedition into an unmapped province finds people who have never been drawn, and do not wish to be.'],
      ['The Queen\'s Compass', 'A court banquet turns into a duel of surveyors, with an entire valley as the stakes.'],
      ['Contour Lines', 'Teselle draws a small mercy into the map and pays for it with something she cannot remember.'],
      ['Legend', 'A key to an old atlas reveals that seven cartographers before her ended in the same place.'],
      ['True North', 'Armies march on a city that Teselle has not yet decided to put back.'],
      ['The Ninth Hand', 'Her master\'s final chart is complete, and her name has been on it the entire time.'],
    ],
  }),
  S({
    name: 'Ledger of Thorns', tagline: 'In this court, every favor grows teeth.',
    synopsis: 'A bastard daughter of a border lord is sent to serve as hostage in a court that pays its debts in living vines. Learning the rules of the thorn-ledger makes her dangerous. Winning by those rules may cost her the last of her family.',
    year: 2023, maturity: 'TV-MA', match: 89, runtimeMin: 56, genres: ['Fantasy', 'Drama', 'Romance'], moods: ['Dark', 'Romantic', 'Epic'],
    palette: ['#0f1a12', '#2f5b3a', '#d1495b'], motif: 'forest', popularity: 80, seasonCount: 2,
    lines: ['Sign in blood if you like. The vines prefer it.', 'I owe you nothing. Look at my hand and tell me I am lying.', 'She pruned three dukes before breakfast.'],
  }),
  S({
    name: 'Hollowmere', tagline: 'They flooded the village. They did not empty it.',
    synopsis: 'When a drought lowers the reservoir above a drowned village, its church spire breaks the surface for the first time in sixty years. The families who were relocated begin to receive letters from the old post office. A hydrologist with a family tie to the valley goes down to see who is sending them.',
    year: 2024, maturity: 'TV-MA', match: 93, runtimeMin: 46, genres: ['Horror', 'Mystery', 'Drama'], moods: ['Eerie', 'Dark', 'Suspenseful'],
    palette: ['#0b1216', '#3a4a52', '#9ad1c9'], motif: 'storm', popularity: 90, original: true, seasonCount: 2,
    lines: ['The postmark says last Tuesday. The post office has been underwater since before you were born.', 'Do not go past the waterline after the bell.', 'My grandmother left a place set for someone every night.'],
    eps: [
      ['Drawdown', 'Dr. Isla Fenwick is called in to measure the falling water and notices fresh footprints in the mud of the old high street.'],
      ['Return to Sender', 'Three families receive letters written in the hand of relatives who were never found.'],
      ['The Bell Below', 'A night survey picks up a sound on the sonar, and it keeps perfect time with evensong.'],
      ['Parish Records', 'The church register lists Isla\'s grandmother twice, the second time with a date that has not happened yet.'],
      ['Spillway', 'A storm threatens the dam as the villagers on the shore start walking toward the water.'],
      ['High Water', 'Isla opens the sluice gates and meets the people who have been waiting to be remembered.'],
    ],
  }),
  S({
    name: 'Tumble & Fern', tagline: 'Small friends. Big garden. Lots of snacks.',
    synopsis: 'Tumble is a clumsy young hedgehog and Fern is a very bossy houseplant who has just moved outdoors. Together they explore the garden, solve small problems and meet the neighbors under every leaf. Every adventure ends in time for bed.',
    year: 2023, maturity: 'TV-Y', match: 92, runtimeMin: 11, genres: ['Kids & Family', 'Animation'], moods: ['Playful', 'Feel-Good', 'Whimsical'],
    palette: ['#163020', '#5aa469', '#ffe66d'], motif: 'forest', popularity: 74, original: true, seasonCount: 3,
    lines: ['I rolled here on purpose. Mostly.', 'Plants do not get lost, Tumble. We get relocated.', 'Is that a beetle or a very small hat?'],
    eps: [
      ['Fern Goes Outside', 'Fern leaves her pot for the first time and Tumble offers to show her around, very slowly.'],
      ['The Wobbly Bridge', 'A fallen twig is the only way across the puddle, and nobody wants to go first.'],
      ['Snail Mail', 'The friends help a snail deliver one important letter before bedtime, which may take a while.'],
      ['Too Many Acorns', 'Tumble collects so many acorns that he cannot fit through his own front door.'],
      ['Who Is Humming?', 'A mysterious hum keeps the garden awake, and the bees have some explaining to do.'],
      ['Fern Needs a Drink', 'A dry afternoon teaches Tumble how to look after a friend who is too proud to ask.'],
      ['Rain Day', 'Everyone shelters under one big leaf and invents a game with no rules at all.'],
      ['Goodnight, Garden', 'Tumble tries to say goodnight to every creature in the garden and nearly manages it.'],
    ],
  }),
  S({
    name: 'Captain Marzipan\'s Cloud Fleet', tagline: 'All aboard the sweetest airship in the sky!',
    synopsis: 'Captain Marzipan and her crew of very polite pigeons pilot a fleet of candy-colored airships, delivering parcels to islands in the clouds. No two deliveries ever go to plan. Luckily, no problem has yet survived a good map and a sensible snack.',
    year: 2025, maturity: 'TV-Y', match: 91, runtimeMin: 14, genres: ['Kids & Family', 'Animation', 'Action & Adventure'], moods: ['Whimsical', 'Playful', 'Uplifting'],
    palette: ['#1d2a5c', '#7b8cde', '#ffc0d9'], motif: 'aurora', popularity: 78, original: true, seasonCount: 2,
    lines: ['Pigeons, prepare the gentle landing!', 'A captain always checks the weather, and then the biscuits.', 'That cloud looks suspiciously like a castle.'],
    eps: [
      ['Maiden Flight', 'New cabin pigeon Bartleby is so nervous on his first day that he salutes a lamppost.'],
      ['The Parcel That Peeped', 'A package starts chirping halfway to Thimble Island, and the crew must keep it calm.'],
      ['Fog of Forgetting', 'A silly fog makes everyone forget the delivery address, so they follow the smell of toast.'],
      ['Sky Pirates, Please', 'Some extremely well-mannered sky pirates ask to borrow the ship, and promise to give it back.'],
      ['The Lost Island', 'An island has drifted away from its usual spot, and it only wants someone to visit.'],
      ['Captain\'s Day Off', 'Marzipan takes one day of rest, and the pigeons try very hard not to need her.'],
      ['Rainbow Refueling', 'The fleet runs out of puff on the wrong side of a rainbow and everybody has to blow.'],
    ],
  }),
  S({
    name: 'Second Cast', tagline: 'They know every line. Nobody knows their names.',
    synopsis: 'A faded regional theater keeps its doors open with a troupe of perpetual understudies, all waiting for a star who keeps nearly dying. When she finally does get a cold, chaos and ambition arrive in the same taxi. It is a backstage comedy about the people who are almost famous.',
    year: 2021, maturity: 'TV-14', match: 88, runtimeMin: 30, genres: ['Comedy'], moods: ['Witty', 'Quirky', 'Bittersweet'],
    palette: ['#250f1c', '#8a2f55', '#f7c548'], motif: 'city', popularity: 72, seasonCount: 3,
    lines: ['I have been ready for this moment for nineteen years and I have a rash.', 'Dame Oriel has laryngitis. Do not smile. Everyone, stop smiling.', 'You cannot die in the second act, you have a third-act costume.'],
    eps: [
      ['Half Hour Call', 'Thirty minutes before curtain, the star loses her voice and five understudies race to be the first to find out.'],
      ['Off Book', 'Pip goes on without having learned the second act, and improvises a new murder.'],
      ['Notes', 'A brutal director\'s notes session leads to a mutiny, then a truce, then a very long lunch.'],
      ['The Critic in Row F', 'The town\'s only critic falls asleep, and the company tries to stage the play more quietly.'],
      ['Ghost Light', 'A night locked in the theater brings out old grudges and one unexpected kiss.'],
      ['Strike', 'The set is torn down and the troupe learn whether any of them would ever really leave.'],
    ],
  }),
  S({
    name: 'Deadlock Bay', tagline: 'One ferry. Forty hostages. Nobody asking for money.',
    synopsis: 'A veteran crisis negotiator is pulled out of retirement when a commuter ferry is seized in a fog-bound harbor. The hijackers want only one thing, an old case reopened, and it happens to be hers. Told across a single, unbearable week.',
    year: 2023, maturity: 'TV-MA', match: 87, runtimeMin: 44, genres: ['Thriller', 'Crime', 'Action & Adventure'], moods: ['Thrilling', 'Suspenseful', 'Gritty'],
    palette: ['#0a1620', '#2a5a78', '#f25f4c'], motif: 'waves', popularity: 84, seasonCount: 1,
    lines: ['They asked for you by name, and by badge number.', 'Keep him talking. Nobody ever shot anyone mid-sentence.', 'The fog lifts at six. After that they can see our snipers.'],
  }),
  S({
    name: 'Brass Horizon', tagline: 'The railroad is coming. So is everyone it will destroy.',
    synopsis: 'In a parched territory, a surveyor, a water-rights widow and a deserting cavalryman each stake a claim on the route of a new railway. Fortunes rise on rumors and vanish overnight. The desert, as ever, keeps score.',
    year: 2020, maturity: 'TV-MA', match: 86, runtimeMin: 57, genres: ['Historical', 'Drama', 'Action & Adventure'], moods: ['Gritty', 'Epic', 'Dark'],
    palette: ['#2b1608', '#a0592a', '#ffcf70'], motif: 'desert', popularity: 70, seasonCount: 3,
    lines: ['A straight line on paper is a graveyard on the ground.', 'I own the only well for sixty miles, sir. Do take your hat off.', 'They will name the town after whoever is left.'],
  }),
  S({
    name: 'Signal Nineteen', tagline: 'Every call is an emergency. One of them is about her.',
    synopsis: 'An emergency dispatcher in a sprawling metropolis takes a call from a frightened child who knows her name and describes a house she has not seen since childhood. As the calls continue, she realizes the system routing them has been tampered with. Help is only ever a few minutes away, and so is whoever is watching.',
    year: 2026, maturity: 'TV-MA', match: 94, runtimeMin: 45, genres: ['Thriller', 'Mystery', 'Crime'], moods: ['Suspenseful', 'Thrilling', 'Dark'],
    palette: ['#08131c', '#1f6f8b', '#99f2c8'], motif: 'grid', popularity: 95, original: true, seasonCount: 1,
    lines: ['Nineteen is the code for a call that does not exist.', 'Stay on the line. Tell me what you can see from the window.', 'That extension was disconnected in the year you were born.'],
    eps: [
      ['Caller Unknown', 'Dispatcher Rena Oakes takes a call from a child who knows her childhood nickname.'],
      ['Priority One', 'Rena sends a unit to the address and finds the house empty, with a dinner still warm on the table.'],
      ['Crosstalk', 'A colleague notices calls being rerouted through a switchboard decommissioned years ago.'],
      ['Silent Line', 'An open line records eleven minutes of a room nobody can identify, until Rena recognizes the wallpaper.'],
      ['Mutual Aid', 'The city blacks out, the board lights up, and Rena has to choose which call is the real one.'],
      ['Clear the Channel', 'Rena traces the signal to its source and takes the last call of her career.'],
    ],
  }),
  S({
    name: 'Mended in Gold', tagline: 'What breaks can be beautiful, given time.',
    synopsis: 'A burned-out architect takes a pottery apprenticeship in a mountain town to escape the wreck of her marriage. Her teacher is gruff, widowed and a far better listener than he pretends. Each season follows one year of slow repair.',
    year: 2024, maturity: 'TV-PG', match: 90, runtimeMin: 42, genres: ['Romance', 'Drama'], moods: ['Heartfelt', 'Romantic', 'Bittersweet'],
    palette: ['#1e1a18', '#7d6b57', '#e6b84c'], motif: 'mountains', popularity: 76, seasonCount: 2,
    lines: ['You have been holding that bowl like it owes you an apology.', 'The crack is not the failure. The hiding is.', 'Come back in spring. The clay will still be here, and so will I.'],
  }),
  S({
    name: 'Last Ferry to Ilsmere', tagline: 'Miss the boat. Find your life.',
    synopsis: 'A city lawyer misses the last ferry off a tiny island and ends up lodging with the woman who is fighting her client\'s development plans. Winter closes the crossing for weeks. Neither of them is especially pleased about what happens next.',
    year: 2025, maturity: 'TV-14', match: 92, runtimeMin: 40, genres: ['Romance', 'Comedy'], moods: ['Romantic', 'Witty', 'Feel-Good'],
    palette: ['#0f2230', '#4f8a8b', '#ffd6a5'], motif: 'waves', popularity: 83, seasonCount: 2,
    lines: ['There is a ferry on Thursday, weather and Gordon permitting.', 'I am suing your entire island, and this is excellent soup.', 'You can stop pretending you have phone signal.'],
  }),
  S({
    name: 'Undertow Protocol', tagline: 'Her cover was perfect. That was the problem.',
    synopsis: 'A deep-cover agent surfaces after nine years to learn that the agency that sent her no longer officially exists. Hunted by two governments and her own former handler, she has one lead hidden inside a shipping conglomerate. Her false identity has a husband, and he has noticed.',
    year: 2022, maturity: 'TV-MA', match: 88, runtimeMin: 50, genres: ['Action & Adventure', 'Thriller'], moods: ['Thrilling', 'Gritty', 'Suspenseful'],
    palette: ['#0c1420', '#35506e', '#ff8c42'], motif: 'storm', popularity: 86, seasonCount: 3,
    lines: ['Burn the passport, keep the shoes.', 'Nine years I have been answering to a dead woman\'s name.', 'If your handler is calling, the building is already surrounded.'],
  }),
  S({
    name: 'Knives at Altitude', tagline: 'Thin air. Thick tension. Very sharp knives.',
    synopsis: 'Twelve professional cooks climb from camp to camp up a remote mountain range, cooking for a panel of judges with whatever the porters can carry. Every thousand meters, water boils cooler and tempers boil hotter. Only one chef reaches the summit table.',
    year: 2026, maturity: 'TV-14', match: 89, runtimeMin: 47, genres: ['Reality', 'Action & Adventure'], moods: ['Thrilling', 'Inspiring', 'Quirky'],
    palette: ['#10202e', '#57788f', '#ffb703'], motif: 'mountains', popularity: 77, original: true, seasonCount: 2,
    lines: ['Rice does not cook at this altitude. I will not be going home.', 'Chefs, your pantry today is what you carried up the ridge.', 'I have lost two toes of feeling and one sous chef.'],
    eps: [
      ['Base Camp', 'Twelve chefs meet their rucksacks and face a welcome dinner cooked over a single gas ring.'],
      ['Boiling Point', 'At 3,000 meters, water behaves badly and a classically trained favorite serves raw lentils.'],
      ['Porter\'s Choice', 'Contestants must trade with the porters for ingredients, and the porters prove sharp negotiators.'],
      ['Whiteout', 'A storm traps the teams in camp, and dinner must be cooked inside a very small tent.'],
      ['Ridge Line', 'A dessert challenge at altitude leads to a collapsed souffle and a collapsed alliance.'],
      ['Summit Table', 'The final three climb before dawn to plate one last meal above the clouds.'],
    ],
  }),
  S({
    name: 'Lantern Run', tagline: 'Twelve teams. One desert. A light that must not go out.',
    synopsis: 'Pairs of strangers race across a vast desert carrying a lit lantern between checkpoints. If the flame dies, they start the leg again. Friendships are forged and dissolved under an enormous night sky.',
    year: 2024, maturity: 'TV-PG', match: 84, runtimeMin: 44, genres: ['Reality', 'Action & Adventure'], moods: ['Inspiring', 'Thrilling', 'Uplifting'],
    palette: ['#1c1208', '#a86f2b', '#ffe27a'], motif: 'desert', popularity: 66, seasonCount: 2,
    lines: ['Cup your hands! Cup your hands, the wind is picking up!', 'She carried the lantern for nine miles and never told me about her ankle.', 'If this goes out, I am walking home.'],
  }),
  S({
    name: 'Deep Field Diaries', tagline: 'A year in the life of people who watch the dark.',
    synopsis: 'Filmed over four years at three remote observatories, this series follows the astronomers, engineers and cooks who keep the great telescopes running. Between the discoveries there are blizzards, budget crises and a great deal of soup. It is a portrait of patience on a cosmic scale.',
    year: 2025, maturity: 'TV-PG', match: 93, runtimeMin: 50, genres: ['Documentary'], moods: ['Inspiring', 'Cerebral', 'Uplifting'],
    palette: ['#050a18', '#2d3a70', '#b8c6ff'], motif: 'orbit', popularity: 69, original: true, seasonCount: 2,
    lines: ['This light left its star before there was anyone to see it.', 'We get about nine clear nights a month, and we argue over every one.', 'The cook has been here longer than the telescope.'],
    eps: [
      ['First Light', 'A new mirror is switched on after nineteen years of planning, and the first image is a smudge.'],
      ['The Night Assistants', 'The operators who actually run the telescope explain how to stay awake for fourteen hours.'],
      ['Cloud Cover', 'A team loses its observing time to weather, and with it a graduate student\'s thesis.'],
      ['Soup and Spectra', 'Life at altitude revolves around one kitchen, where the big arguments get settled.'],
      ['Transit', 'Three observatories on three continents race to catch a four-minute event.'],
      ['The Long Exposure', 'A retiring astronomer takes one final image and hands her notebooks to the next generation.'],
    ],
  }),
  S({
    name: 'Rivers That Remember', tagline: 'Every river is an archive. Few of us can read it.',
    synopsis: 'Each episode travels the length of a single great river, from glacier to delta, with the people who depend on it. Scientists and elders trace how the water has changed course over centuries. The series asks what these rivers will carry next.',
    year: 2023, maturity: 'TV-PG', match: 88, runtimeMin: 52, genres: ['Documentary', 'Historical'], moods: ['Inspiring', 'Bittersweet', 'Cerebral'],
    palette: ['#0a1e24', '#2c7a7b', '#a5f3e0'], motif: 'waves', popularity: 58, seasonCount: 2,
    lines: ['My grandfather fished where that road now runs.', 'The sediment here is a diary six thousand years long.', 'A river does not flood. It simply remembers where it used to be.'],
  }),
  S({
    name: 'Wild Engineers', tagline: 'Nature\'s best builders are already on the job.',
    synopsis: 'From beaver dams to termite skyscrapers, this bright and curious series meets the animals who build the world around them. Human engineers try, often hilariously, to copy their work. Great for curious minds of any age.',
    year: 2024, maturity: 'TV-PG', match: 90, runtimeMin: 26, genres: ['Documentary', 'Kids & Family'], moods: ['Uplifting', 'Playful', 'Inspiring'],
    palette: ['#10261a', '#4d8b4f', '#f4d35e'], motif: 'forest', popularity: 61, seasonCount: 2,
    lines: ['This bird has no thumbs and it has just tied a knot.', 'Our bridge collapsed. The spider\'s did not.', 'Termites have had air conditioning for a very long time.'],
  }),
  S({
    name: 'Chambers of Mrs. Adeyo', tagline: 'She has never lost a case. She has lost nearly everything else.',
    synopsis: 'A formidable barrister with a failing memory takes on one last year of cases, hiding her diagnosis from her chambers. Her newest junior figures it out by the second week. Together they keep up the act while the law, and her family, press in.',
    year: 2023, maturity: 'TV-14', match: 94, runtimeMin: 55, genres: ['Drama', 'Crime'], moods: ['Heartfelt', 'Witty', 'Bittersweet'],
    palette: ['#1a1218', '#5b3a55', '#e0b0ff'], motif: 'city', popularity: 79, seasonCount: 3,
    lines: ['My lady, I withdraw the question, but I do not withdraw the implication.', 'Write it on my hand, child. Quickly, before I stand.', 'I have forgotten more law than you will ever read, and I do mean that literally.'],
  }),
  S({
    name: 'The Long Ward', tagline: 'Nights are long. Nobody here is coming to save them.',
    synopsis: 'On the overnight shift at an underfunded city hospital, a new charge nurse tries to keep a ward running while the building itself falls apart. Patients come and go, some of them in the wrong order. The show finds grace in exhaustion and bad coffee.',
    year: 2021, maturity: 'TV-MA', match: 87, runtimeMin: 48, genres: ['Drama'], moods: ['Gritty', 'Heartfelt', 'Bittersweet'],
    palette: ['#0f1a1f', '#4a7178', '#d7f0ec'], motif: 'city', popularity: 71, seasonCount: 4,
    lines: ['Bed nine has been asking for you. Bed nine has also been dead for an hour, so go and sit with his wife.', 'The lift is out again. Grab the other end of this.', 'Nobody thanks you at four in the morning. Except sometimes, and that is the job.'],
  }),
  S({
    name: 'Northlight Academy', tagline: 'Some lessons only happen after dark.',
    synopsis: 'At a boarding school above the Arctic Circle, students study the aurora as a language rather than a light show. A shy new scholarship student discovers she can read it fluently, and that it has been warning the school for years. Now her dormitory wants answers and so does the headmaster.',
    year: 2025, maturity: 'TV-PG', match: 92, runtimeMin: 38, genres: ['Fantasy', 'Kids & Family', 'Mystery'], moods: ['Whimsical', 'Uplifting', 'Suspenseful'],
    palette: ['#071a2a', '#1f7a8c', '#7dffb2'], motif: 'aurora', popularity: 85, original: true, seasonCount: 2,
    lines: ['It is not a color, it is a sentence, and it is telling us to leave.', 'No one has passed Advanced Aurora on the first try. No one.', 'Lights out does not mean what you think it means here.'],
    eps: [
      ['Polar Night', 'Scholarship student Liv arrives during the last sunset of the year and sees words in the sky.'],
      ['Basic Green', 'Her first aurora class goes badly, because she keeps correcting the textbook.'],
      ['The Ice Library', 'A forbidden wing of the library holds the records of everyone who ever read too well.'],
      ['Lights Out', 'A dormitory dare leads Liv and her friends onto the frozen lake at midnight.'],
      ['The Red Line', 'A rare crimson aurora throws the school into panic, and only Liv knows what it says.'],
      ['Reply', 'The students build a way to answer the sky, and something answers back.'],
      ['First Sunrise', 'The polar night ends with a choice that will change who is allowed to read at all.'],
    ],
  }),
  S({
    name: 'The Cold Archive', tagline: 'Some cases do not stay filed.',
    synopsis: 'A records clerk in a basement police archive begins noticing small edits made to decades-old case files, all pointing to one investigator. She teams up with a retired detective who is not sure he can trust his own memory of events. The person altering history is still in the building.',
    year: 2022, maturity: 'TV-14', match: 89, runtimeMin: 47, genres: ['Mystery', 'Crime', 'Thriller'], moods: ['Cerebral', 'Suspenseful', 'Dark'],
    palette: ['#10151c', '#546a7b', '#c6e2e9'], motif: 'grid', popularity: 75, seasonCount: 3,
    lines: ['Same case number. Different typewriter.', 'I signed that statement. I am almost certain I signed that statement.', 'Paper does not lie, but somebody has been teaching it.'],
  }),
  S({
    name: 'Mirrorlake Detective Agency', tagline: 'No case too small. Some cases extremely small.',
    synopsis: 'Three eleven-year-olds and a retired police dog run the only detective agency in the sleepy town of Mirrorlake. They investigate missing trophies, haunted boathouses and mysterious pies. The grown-ups are always the last to work it out.',
    year: 2022, maturity: 'TV-PG', match: 86, runtimeMin: 24, genres: ['Kids & Family', 'Mystery', 'Comedy'], moods: ['Playful', 'Witty', 'Feel-Good'],
    palette: ['#132a3a', '#3f88a5', '#ffd166'], motif: 'waves', popularity: 64, seasonCount: 3,
    lines: ['Biscuit has found a clue. Or a sandwich. Hold on.', 'Our fee is two dollars or one very good secret.', 'The pie was stolen from inside a locked pie.'],
  }),
  S({
    name: 'Static Kingdom', tagline: 'Long live the signal.',
    synopsis: 'In a hand-drawn future where cities broadcast their own weather, a teenage courier discovers a pirate radio station run by a machine that thinks it is a medieval king. Together they take on the network that owns the sky. It is loud, funny and bigger than it first appears.',
    year: 2024, maturity: 'TV-14', match: 91, runtimeMin: 25, genres: ['Animation', 'Sci-Fi', 'Action & Adventure'], moods: ['Thrilling', 'Quirky', 'Playful'],
    palette: ['#180c2c', '#5b2a9c', '#39ffe0'], motif: 'neon', popularity: 81, seasonCount: 3,
    lines: ['Kneel before your king, or at least adjust my antenna.', 'They scheduled the rain to start when my shift ends. Again.', 'Tune to the frequency nobody pays for.'],
  }),
  S({
    name: 'Ink & Comet', tagline: 'Her sketchbook has started to answer back.',
    synopsis: 'A struggling comics artist finds that whatever she draws in an old sketchbook appears on her roof the next morning. Her first creation, a sarcastic comet named Gerald, refuses to leave. This warm and strange animated series is about making things and living with them.',
    year: 2023, maturity: 'TV-14', match: 88, runtimeMin: 24, genres: ['Animation', 'Comedy', 'Fantasy'], moods: ['Quirky', 'Heartfelt', 'Witty'],
    palette: ['#14162e', '#3e4a9e', '#ffa8c5'], motif: 'orbit', popularity: 68, seasonCount: 2,
    lines: ['You gave me a tail and no feet. Think about what you have done.', 'I drew a landlord who likes me. He is on the roof.', 'Never sketch while hungry. That is how we got the giant toast.'],
  }),
  S({
    name: 'Queen of the Dry Season', tagline: 'A throne is only as strong as its wells.',
    synopsis: 'In a medieval desert kingdom, a young regent inherits a court at war and a water supply that is secretly running out. Her uncle holds the armies, and her rivals hold the caravan roads. She holds one secret map of the old aquifers.',
    year: 2027, maturity: 'TV-MA', match: 90, runtimeMin: 58, genres: ['Historical', 'Drama', 'Action & Adventure'], moods: ['Epic', 'Dark', 'Suspenseful'],
    palette: ['#2a1405', '#b3611d', '#ffd98e'], motif: 'desert', popularity: 88, original: true, soon: '2027-01-22', seasonCount: 1,
    lines: ['Tell the court there is water enough for ten years. Tell me the truth.', 'My uncle has the armies. I have the wells. We shall see who gets thirsty.', 'Bury the steward with his ledger, and bring me the second one.'],
  }),
  S({
    name: 'Iron Almanac', tagline: 'The mill gave the town everything. Then it sent the bill.',
    synopsis: 'Across three generations, two families are bound together by a steel mill in a smoky river valley. Strikes, marriages and betrayals are recorded in the pages of a shared almanac. The present-day heirs discover it is missing one crucial year.',
    year: 2021, maturity: 'TV-14', match: 85, runtimeMin: 53, genres: ['Historical', 'Drama'], moods: ['Gritty', 'Epic', 'Bittersweet'],
    palette: ['#14100e', '#6b4a3a', '#ff7b39'], motif: 'storm', popularity: 62, seasonCount: 2,
    lines: ['The whistle goes at five, wedding or no wedding.', 'Your grandfather crossed that picket line, and mine remembered it.', 'Somebody cut 1931 out with a razor.'],
  }),
  S({
    name: 'The House of Small Hours', tagline: 'It only opens between three and four.',
    synopsis: 'A grieving family moves to a rambling farmhouse with an extra hallway that appears for one hour each night. Each of them privately explores it, and each comes back slightly changed. Nobody discusses it at breakfast.',
    year: 2023, maturity: 'TV-MA', match: 91, runtimeMin: 43, genres: ['Horror', 'Drama'], moods: ['Eerie', 'Dark', 'Bittersweet'],
    palette: ['#0c0a10', '#3c2f4f', '#b89cff'], motif: 'forest', popularity: 83, seasonCount: 2,
    lines: ['Dad, why are there more doors at night?', 'I have been making breakfast for a child we buried.', 'Be back before four. It does not wait.'],
  }),
  S({
    name: 'The Weight of Bells', tagline: 'A village, a war and one enormous secret.',
    synopsis: 'During an occupation, the villagers of a remote valley hide their cathedral bells from enemy foundries by sinking them in a mountain lake. Decades later, a young diver comes looking and finds that the village has been lying about far more than bronze. Past and present ring together.',
    year: 2020, maturity: 'TV-14', match: 87, runtimeMin: 49, genres: ['Historical', 'Mystery', 'Drama'], moods: ['Bittersweet', 'Suspenseful', 'Heartfelt'],
    palette: ['#101820', '#556b7a', '#e3b778'], motif: 'mountains', popularity: 60, seasonCount: 2,
    lines: ['Eleven men carried that bell up the pass. Ten of them came home.', 'We do not talk about the lake.', 'If you find the bell, you will find the rest of them.'],
  }),
  S({
    name: 'End-Times Flatshare', tagline: 'The world is ending. The rent is still due.',
    synopsis: 'A shared flat of mismatched twenty-somethings gets a government notice that the planet has three years left, and that the landlord still expects deposits. Life goes on, awkwardly. Somebody has to buy milk at the apocalypse.',
    year: 2024, maturity: 'TV-MA', match: 89, runtimeMin: 26, genres: ['Comedy', 'Sci-Fi'], moods: ['Witty', 'Quirky', 'Dark'],
    palette: ['#1e1a0f', '#8b7f2a', '#f7ff58'], motif: 'city', popularity: 87, seasonCount: 3,
    lines: ['Three years is plenty of time to finally fix the boiler. Is it? Nobody knows.', 'I have decided not to floss anymore. Big decision. Very freeing.', 'Whose turn is it to tell Colin about the asteroid?'],
  }),
  S({
    name: 'Mild Peril', tagline: 'Murder, with a light drizzle.',
    synopsis: 'A polite English village keeps experiencing crimes so minor that the sole police sergeant has to invent paperwork for them. Then an actual body turns up at the flower show, and everyone is secretly delighted. Cozy, silly and sharper than it looks.',
    year: 2022, maturity: 'TV-PG', match: 90, runtimeMin: 33, genres: ['Comedy', 'Mystery', 'Crime'], moods: ['Witty', 'Feel-Good', 'Quirky'],
    palette: ['#1b241a', '#6b8f5e', '#f5e6a8'], motif: 'forest', popularity: 73, seasonCount: 4,
    lines: ['Sergeant, somebody has moved the marrows.', 'A proper corpse! Oh, this is dreadful. Shall I put the kettle on?', 'In forty years we have never had a motive. We hardly know where to put it.'],
  }),
  S({
    name: 'Terminal Velvet', tagline: 'The future has a dress code.',
    synopsis: 'Inside an elite orbital nightclub where memories are the only accepted currency, a coat-check attendant starts recognizing memories that belong to people who never visited. Someone is laundering lives. A velvet rope is all that separates her from a very long fall.',
    year: 2026, maturity: 'TV-MA', match: 95, runtimeMin: 49, genres: ['Sci-Fi', 'Thriller', 'Crime'], moods: ['Dark', 'Thrilling', 'Cerebral'],
    palette: ['#14081f', '#7a1f6b', '#ff5cf0'], motif: 'neon', popularity: 94, original: true, seasonCount: 2,
    lines: ['That is a very expensive childhood you are wearing.', 'I checked that coat for a man who died on Mars, and he picked it up himself.', 'Nobody pays cash here. Pay me with your first kiss or get out.'],
    eps: [
      ['Coat Check', 'Mara Quill accepts a stranger\'s memory as a tip and sees a murder from inside it.'],
      ['Cover Charge', 'A customer offers Mara a fortune to forget what she saw, then politely asks to watch her do it.'],
      ['The Exchange Rate', 'Mara learns how the memory markets actually work, and who sets the price of grief.'],
      ['Velvet Rope', 'She gets past the rope for the first time and finds someone wearing her mother\'s voice.'],
      ['Decompression', 'A failed airlock on the service deck turns out to be no accident, and no one remembers the victim.'],
      ['Last Orders', 'Mara drains her own past to buy the one memory that can bring the club down.'],
    ],
  }),
  S({
    name: 'Ghostlight Motel', tagline: 'Checkout is at eleven. It is enforced.',
    synopsis: 'Two cousins take over a failing roadside motel in the high desert, only to discover that most of the rooms are permanently occupied by the dead. The ghosts leave excellent reviews, and the living keep complaining. Business is complicated.',
    year: 2021, maturity: 'TV-14', match: 86, runtimeMin: 29, genres: ['Horror', 'Comedy'], moods: ['Quirky', 'Eerie', 'Witty'],
    palette: ['#1a0f14', '#7a3b3b', '#7fffd4'], motif: 'desert', popularity: 67, seasonCount: 3,
    lines: ['Room six is booked until 2190, and he tips.', 'Sir, you cannot haunt the vending machine, there is a sign.', 'We do not get a lot of walk-ins. We get a lot of walk-throughs.'],
  }),
  S({
    name: 'Thirteen Moons Over Varda', tagline: 'Every moon has a name. One of them is lying.',
    synopsis: 'Settlers on a many-mooned world wake from cold sleep to find a calendar that no longer matches the sky. A linguist and a terraformer must learn why a thirteenth moon has appeared. It seems to be listening to the colony\'s radio.',
    year: 2026, maturity: 'TV-14', match: 88, runtimeMin: 51, genres: ['Sci-Fi', 'Mystery'], moods: ['Cerebral', 'Eerie', 'Epic'],
    palette: ['#0b0f24', '#3a3f8f', '#c9b6ff'], motif: 'aurora', popularity: 89, original: true, soon: '2026-12-11', seasonCount: 1,
    lines: ['We counted twelve when we went to sleep.', 'It has started broadcasting our own lullabies back at us.', 'Moons do not change orbit because someone said good morning.'],
  }),
  S({
    name: 'The Tiny Dragon Post Office', tagline: 'Neither snow nor sneezes shall stop the mail!',
    synopsis: 'In a tall mountain village, young dragons learn to deliver letters to all the neighbors. Pip the dragon is very small, sneezes sparks and has never once been on time. Everybody loves him anyway.',
    year: 2024, maturity: 'TV-Y', match: 93, runtimeMin: 12, genres: ['Kids & Family', 'Animation', 'Fantasy'], moods: ['Whimsical', 'Feel-Good', 'Playful'],
    palette: ['#1a2440', '#5d7fbf', '#ff9f6e'], motif: 'mountains', popularity: 79, original: true, seasonCount: 3,
    lines: ['Achoo! Oh dear, that was the birthday card.', 'Mrs. Goat is waiting for her parcel at the very top.', 'A good postal dragon always wipes her claws.'],
  }),
  S({
    name: 'Sprocket and the Moon Garden', tagline: 'Plant a seed. Grow a star.',
    synopsis: 'Sprocket is a curious little robot who tends a garden on the moon. Space seeds grow into all sorts of surprising things, from singing vines to bouncing pumpkins. Each story gently introduces a bit of science and a lot of kindness.',
    year: 2023, maturity: 'TV-Y', match: 89, runtimeMin: 12, genres: ['Kids & Family', 'Animation', 'Sci-Fi'], moods: ['Playful', 'Uplifting', 'Whimsical'],
    palette: ['#10142e', '#4c5cc4', '#b6ffc5'], motif: 'orbit', popularity: 65, seasonCount: 2,
    lines: ['Beep boop! The pumpkin has bounced over the crater again.', 'Moon dust is only dirt that has been on holiday.', 'Plants need water and light and a song. Everybody knows that.'],
  }),
  S({
    name: 'Second Harbor', tagline: 'Everybody comes back eventually.',
    synopsis: 'A marine biologist returns to run her family\'s failing boatyard, where her ex now captains the town\'s only ferry. Secrets, storms and a long-running feud fill this warm-hearted coastal saga. Every summer brings new arrivals and old flames.',
    year: 2019, maturity: 'TV-14', match: 83, runtimeMin: 44, genres: ['Romance', 'Drama'], moods: ['Romantic', 'Heartfelt', 'Feel-Good'],
    palette: ['#0d2030', '#39708f', '#ffcfa5'], motif: 'waves', popularity: 63, seasonCount: 5,
    lines: ['You sold the boat. You sold the boat we named together.', 'Your mother has been waving at me from that window for ten years.', 'Stay for the regatta, and then you can leave me properly.'],
  }),
  S({
    name: 'The Alibi Society', tagline: 'For a modest fee, you were somewhere else.',
    synopsis: 'A retired stage magician, a disbarred lawyer and a very good forger run a discreet agency manufacturing alibis for people who need one. When a client turns up dead with an alibi they sold him, they have to solve the case to save themselves. Clever, breezy and only slightly illegal.',
    year: 2025, maturity: 'TV-14', match: 93, runtimeMin: 45, genres: ['Mystery', 'Comedy', 'Crime'], moods: ['Witty', 'Suspenseful', 'Quirky'],
    palette: ['#1c1420', '#6e4a7e', '#ffd166'], motif: 'city', popularity: 92, seasonCount: 2,
    lines: ['You were at the opera, and you hated it. Here is your ticket stub and your opinion.', 'We sold him an alibi for a murder he did not commit, and then he was murdered.', 'Never do magic for a man holding a warrant.'],
    eps: [
      ['Somewhere Else', 'A routine alibi for an unfaithful banker goes wrong when the banker is found in the river.'],
      ['Dinner for Nine', 'The Society fakes a dinner party, only to learn that one of the invented guests has been seen around town.'],
      ['Sleight of Hand', 'Ambrose returns to the stage to steal a ledger in front of six hundred witnesses.'],
      ['Forgery Is a Love Language', 'Odile\'s old partner reappears with a perfect copy of the Society\'s client list.'],
      ['Reasonable Doubt', 'Cass goes back to the courthouse in disguise, and is immediately recognized by a judge who owes her.'],
      ['The Client Is Always Dead', 'The trio stage their boldest trick yet to unmask the killer at a fake funeral.'],
    ],
  }),
  S({
    name: 'Gale Rescue Eleven', tagline: 'When everyone else turns back, they launch.',
    synopsis: 'The volunteer crew of a storm-battered lifeboat station risk everything on one of the world\'s most dangerous coasts. Between rescues, they fight budget cuts and each other. A rookie with something to prove joins the crew just before the worst winter on record.',
    year: 2023, maturity: 'TV-14', match: 85, runtimeMin: 46, genres: ['Action & Adventure', 'Drama'], moods: ['Thrilling', 'Inspiring', 'Heartfelt'],
    palette: ['#0a1a26', '#2b6a8c', '#ff9f1c'], motif: 'storm', popularity: 74, seasonCount: 3,
    lines: ['There are four on that trawler and we have one good engine.', 'You do not have to come back a hero. You do have to come back.', 'The pager goes, you run. Finish your wedding later.'],
  }),
  S({
    name: 'Bread and Bridges', tagline: 'Two chefs. One food truck. A very long road.',
    synopsis: 'Two rival home cooks are thrown together to drive a food truck across a whole continent, serving whoever they meet. Every town teaches them a new dish and a new way to argue. By the end of the road, this reality series has become a love letter to strangers.',
    year: 2022, maturity: 'TV-PG', match: 86, runtimeMin: 40, genres: ['Reality', 'Documentary'], moods: ['Feel-Good', 'Heartfelt', 'Uplifting'],
    palette: ['#201812', '#8a6642', '#ffd28a'], motif: 'desert', popularity: 59, seasonCount: 3,
    lines: ['We have forty hungry bikers and half an onion.', 'She taught me that dumpling in a parking lot, and I will never forget her.', 'I swore I would not cry over a bowl of soup, and yet.'],
  }),
  S({
    name: 'The Greenhouse Wars', tagline: 'Grow well. Grow fast. Trust no one with the compost.',
    synopsis: 'Ten obsessive gardeners move into a row of glasshouses for one growing season, each competing to raise the impossible on a deadline. Late frosts, rogue slugs and open sabotage are all part of the game. The prize is a historic walled garden of their own.',
    year: 2025, maturity: 'TV-PG', match: 85, runtimeMin: 42, genres: ['Reality', 'Comedy'], moods: ['Feel-Good', 'Quirky', 'Witty'],
    palette: ['#0f2415', '#4f9a5b', '#f6ff8f'], motif: 'forest', popularity: 61, seasonCount: 3,
    lines: ['Somebody has been talking to my tomatoes, and it was not me.', 'Gardeners, you have nine days and one very sulky orchid.', 'I grew that melon from a seed my nan kept in a biscuit tin.'],
  }),
  S({
    name: 'Master of Small Rooms', tagline: 'Forty square feet. Infinite ego.',
    synopsis: 'Rival designers transform impossibly tiny spaces, from lighthouse pantries to decommissioned phone boxes, for real families with real needs. Each week the rooms get smaller and the ambitions get larger. It is the rare makeover show where everyone cries over a shelf.',
    year: 2024, maturity: 'TV-PG', match: 82, runtimeMin: 38, genres: ['Reality', 'Drama'], moods: ['Uplifting', 'Quirky', 'Feel-Good'],
    palette: ['#1d1a24', '#7a6c9c', '#ffcdb2'], motif: 'grid', popularity: 55, seasonCount: 2,
    lines: ['That is not a bed, that is a shelf with confidence.', 'Designers, your client is six foot four and owns a tuba.', 'I have measured this hallway nine times and it keeps getting worse.'],
  }),
  S({
    name: 'Stitch or Swim', tagline: 'Sewing at sea. What could possibly unravel?',
    synopsis: 'Twelve tailors board a working cargo ship with a sewing machine each and a hold full of salvaged cloth. At every port, they must dress a local client using only what they can trade for. The losers are put ashore with their bobbins.',
    year: 2026, maturity: 'TV-PG', match: 84, runtimeMin: 45, genres: ['Reality', 'Comedy'], moods: ['Quirky', 'Feel-Good', 'Thrilling'],
    palette: ['#0b1e2d', '#2f7f9f', '#ff9fb2'], motif: 'waves', popularity: 76, original: true, soon: '2026-11-27', seasonCount: 1,
    lines: ['A nine-foot wave just took my only good pair of scissors.', 'Tailors, the client is a harbormaster, and she hates buttons.', 'I sewed that hem on a forty-degree tilt, and it is straight.'],
  }),
];

/* ---------- films ---------- */

const FILMS = [
  F({ name: 'The Glass Aviary', tagline: 'Everyone in this house is kept beautifully.', synopsis: 'A young ornithologist is hired to catalog a reclusive widow\'s collection of rare birds in a vast glass conservatory. She soon realizes that the widow keeps more than birds. An elegant, unsettling portrait of possession.', year: 2024, maturity: 'R', match: 91, runtimeMin: 118, genres: ['Drama', 'Thriller'], moods: ['Eerie', 'Cerebral', 'Dark'], palette: ['#0f1c1c', '#3f7f76', '#ffd8a8'], motif: 'forest', popularity: 85, lines: ['None of them have ever tried to leave. Is that not lovely?', 'The latch is on the outside, dear. For the birds.', 'You have been here four months. Did you not sign for a week?'] }),
  F({ name: 'Last Light Over Tarn', tagline: 'Six climbers. One storm. No radio.', synopsis: 'When a late-season storm strands a mountain rescue team on the wrong side of a glacier, they have until sunset to bring down two injured strangers. One of those strangers is not who he claims to be. A relentless survival thriller shot against an impossible landscape.', year: 2025, maturity: 'PG-13', match: 92, runtimeMin: 124, genres: ['Action & Adventure', 'Thriller'], moods: ['Thrilling', 'Suspenseful', 'Epic'], palette: ['#10182a', '#566f94', '#ffb26b'], motif: 'mountains', popularity: 93, original: true, lines: ['We lose the light in forty minutes. We lose the rope in twenty.', 'He says he is a teacher. Look at his hands.', 'Nobody goes down until everybody goes down.'] }),
  F({ name: 'Nocturne for Two Thieves', tagline: 'A perfect duet. A terrible idea.', synopsis: 'A concert pianist and a safe-cracker fall in love during the heist of a priceless score hidden in an opera house. Each of them has been hired to betray the other. They have until the final movement to decide.', year: 2023, maturity: 'PG-13', match: 94, runtimeMin: 127, genres: ['Crime', 'Romance', 'Thriller'], moods: ['Witty', 'Romantic', 'Thrilling'], palette: ['#180d24', '#5a2d82', '#ff7ac6'], motif: 'neon', popularity: 90, original: true, lines: ['You play the second movement. I will take the second safe.', 'I always know when a man is lying. His left hand goes flat.', 'We have until the applause.'] }),
  F({ name: 'The Pearwood Inheritance', tagline: 'They all came for the money. Only she came for the trees.', synopsis: 'After the death of a difficult patriarch, four siblings gather at the family orchard to divide the estate. An unexpected will leaves everything to a housekeeper nobody really knew. Long-buried truths ripen along with the harvest.', year: 2021, maturity: 'PG-13', match: 87, runtimeMin: 112, genres: ['Drama', 'Mystery'], moods: ['Bittersweet', 'Heartfelt', 'Witty'], palette: ['#1a1f12', '#6d7f3a', '#f2d16b'], motif: 'forest', popularity: 64, lines: ['He loved those trees more than he ever loved us, and they knew it.', 'She has a key to a room none of us have seen.', 'You may have the silver. I want the ledger from the shed.'] }),
  F({ name: 'Halfway to Perihelion', tagline: 'Love is a long-distance orbit.', synopsis: 'Two long-haul ship mechanics who have only ever spoken via time-delayed maintenance reports decide to meet at the one point where their orbits cross. It takes eleven months. A big-hearted and very funny romance across the solar system.', year: 2026, maturity: 'PG-13', match: 95, runtimeMin: 109, genres: ['Sci-Fi', 'Romance', 'Comedy'], moods: ['Romantic', 'Witty', 'Uplifting'], palette: ['#0c1228', '#3956a3', '#ffc26f'], motif: 'orbit', popularity: 96, original: true, lines: ['Your last message took nine hours to arrive and I laughed at it for ten.', 'I have replaced the coolant. Also, I think I love you. End report.', 'We will pass each other at eleven kilometers a second. Wear something nice.'] }),
  F({ name: 'Starlit Salvage', tagline: 'Finders keepers. Losers drift.', synopsis: 'A debt-ridden salvage crew stumbles on a pristine warship from a war nobody will admit happened. Three rival fleets converge on the wreck within a day. The ship, it turns out, has views of its own.', year: 2022, maturity: 'PG-13', match: 88, runtimeMin: 131, genres: ['Sci-Fi', 'Action & Adventure'], moods: ['Thrilling', 'Epic', 'Witty'], palette: ['#0a0f1f', '#2f4a7f', '#ff6b4a'], motif: 'orbit', popularity: 89, lines: ['Standard salvage law says it is ours. Standard salvage law also did not expect lasers.', 'Captain, the wreck just asked us to wipe our feet.', 'We owe money to all three of those fleets.'] }),
  F({ name: 'The Drowned Choir', tagline: 'They have been singing for you all along.', synopsis: 'A sound engineer recording coastal fog signals hears a choir under the waves on her tapes. Each playback brings the singing closer to the shore. Her small town has a very old reason for keeping its windows shut at high tide.', year: 2023, maturity: 'R', match: 89, runtimeMin: 102, genres: ['Horror', 'Mystery'], moods: ['Eerie', 'Dark', 'Suspenseful'], palette: ['#071218', '#25505c', '#8ff0e0'], motif: 'waves', popularity: 79, lines: ['Play it back. Is that a child in the second row?', 'High tide at nine. Close the shutters, and do not hum.', 'Everyone in this town sings flat on purpose.'] }),
  F({ name: 'Wickerlight', tagline: 'Follow the lanterns. Do not count them.', synopsis: 'Four friends hike into an old forest to scatter a friend\'s ashes, and find a trail of woven lanterns that weren\'t on any map. Each one they pass burns with something they have kept secret. By nightfall there is one more lantern than there should be.', year: 2020, maturity: 'R', match: 84, runtimeMin: 97, genres: ['Horror', 'Thriller'], moods: ['Eerie', 'Dark', 'Thrilling'], palette: ['#0e120a', '#46552b', '#ffb347'], motif: 'forest', popularity: 72, lines: ['There were nine when we passed them this morning.', 'That is my handwriting on the tag.', 'It knows what you told him. It knows what you did not.'] }),
  F({ name: 'The Concierge Knows', tagline: 'Discretion is included in the price.', synopsis: 'At a faded grand hotel, a veteran concierge notices a guest checking in under the name of a man who died in Room 412 forty years ago. His quiet inquiries unsettle a government delegation staying on the top floor. By morning, someone has checked out permanently.', year: 2024, maturity: 'PG-13', match: 90, runtimeMin: 116, genres: ['Thriller', 'Mystery'], moods: ['Suspenseful', 'Witty', 'Cerebral'], palette: ['#1a1014', '#6f2f3f', '#e8c37a'], motif: 'city', popularity: 77, lines: ['Your room has been prepared, sir, as it was the last time you died.', 'One does not ask a guest why the bath is full of ice.', 'I have held this key for forty years. Do you know who keeps asking for it?'] }),
  F({ name: 'A Wedding in Three Languages', tagline: 'I do. Je veux. Sí. Wait, what did he say?', synopsis: 'A translator is hired to help two sprawling families communicate during a destination wedding, and quickly realizes that she could say anything she likes. A few small edits lead to total catastrophe. It also lands her in love with the wrong brother.', year: 2025, maturity: 'PG-13', match: 89, runtimeMin: 104, genres: ['Comedy', 'Romance'], moods: ['Witty', 'Romantic', 'Feel-Good'], palette: ['#22130f', '#c06b4a', '#ffe0b8'], motif: 'city', popularity: 84, lines: ['He just said your mother is a lovely, lovely woman. That is roughly what he said.', 'Do not translate that. Do not translate that either.', 'The toast went well, but I may have started a land dispute.'] }),
  F({ name: 'Forty Letters to Lisbon', tagline: 'She answered every one. He only ever read the last.', synopsis: 'A widowed postman finds a bundle of undelivered love letters while clearing out his old sorting office. He sets out across Portugal to deliver them at last, decades too late. Each stop gently rewrites what he thought he knew about his own marriage.', year: 2022, maturity: 'PG', match: 93, runtimeMin: 113, genres: ['Romance', 'Drama'], moods: ['Heartfelt', 'Bittersweet', 'Romantic'], palette: ['#142028', '#4f7c8a', '#ffd9a0'], motif: 'waves', popularity: 74, lines: ['It is sixty years late, senhora. I do apologize.', 'She kept the stamp and burned the letter.', 'My wife wrote this. That is my wife\'s hand.'] }),
  F({ name: 'Dust Psalm', tagline: 'The Lord giveth. The dust taketh away.', synopsis: 'A preacher\'s widow rides into a dying mining town to collect a debt from the three men who killed her husband. The town, having grown fond of its killers, has other plans. A spare and ferocious western.', year: 2019, maturity: 'R', match: 86, runtimeMin: 121, genres: ['Historical', 'Action & Adventure', 'Drama'], moods: ['Gritty', 'Dark', 'Epic'], palette: ['#241108', '#8c4a1f', '#ffbb5c'], motif: 'desert', popularity: 68, lines: ['I have read the whole book, sir. It is full of people like me.', 'There are three names on this page and I can spell all of them.', 'This town has only one street, ma\'am, and you are standing in it.'] }),
  F({ name: 'The Clockmaker\'s Gambit', tagline: 'Every second was planned.', synopsis: 'In 1880s Prague, a watchmaker\'s apprentice is accused of murdering the city\'s chief astronomer in a locked tower. To clear his name he has to solve the riddle hidden inside the victim\'s final clock. Its next chime will kill again.', year: 2021, maturity: 'PG-13', match: 88, runtimeMin: 128, genres: ['Mystery', 'Historical'], moods: ['Cerebral', 'Suspenseful', 'Witty'], palette: ['#17130d', '#6a5634', '#d9b35f'], motif: 'grid', popularity: 70, lines: ['The hands turn backward between midnight and one. Why build that?', 'A man who sets every clock in the city can choose when anything happens.', 'You will find the door locked, Inspector. I oiled it myself.'] }),
  F({ name: 'Paddle Boat Pirates', tagline: 'Set sail! But not too far from the snack stand.', synopsis: 'During a long summer at the lake, four cousins commandeer a swan-shaped paddle boat in search of a treasure map from their grandad. Rival pirates from the opposite shore have the other half. It\'s a big adventure on a very small body of water.', year: 2023, maturity: 'G', match: 90, runtimeMin: 88, genres: ['Kids & Family', 'Comedy', 'Action & Adventure'], moods: ['Playful', 'Feel-Good', 'Whimsical'], palette: ['#0f2e3d', '#3aa6b9', '#ffd93d'], motif: 'waves', popularity: 71, lines: ['Hoist the swan!', 'That is not a sea monster, that is Uncle Tobias swimming.', 'X marks the spot, right behind the ice cream van.'] }),
  F({ name: 'Moss the Mighty', tagline: 'The smallest knight in the whole wide wood.', synopsis: 'Moss is a tiny dormouse who dreams of being a knight, despite sleeping through most of his training. When a thunderous giant is reported in the woods, only he is small enough to find out why it is crying. It\'s a sweet tale about courage of the quieter kind.', year: 2024, maturity: 'G', match: 94, runtimeMin: 84, genres: ['Kids & Family', 'Animation', 'Fantasy'], moods: ['Whimsical', 'Heartfelt', 'Uplifting'], palette: ['#16260f', '#6a9c3d', '#ffe082'], motif: 'forest', popularity: 82, original: true, lines: ['I am Moss the Mighty! Sorry, I was asleep. Who are you?', 'A true knight always asks the giant how his day is going.', 'You cannot lift the sword? Then we shall carry it together.'] }),
  F({ name: 'Pocketful of Thunder', tagline: 'Some weather is meant to be kept.', synopsis: 'A girl who is afraid of storms finds a baby thundercloud hiding in her coat pocket. Hiding it from her parents is hard, and it grows every time it gets excited. To get it home, she will have to fly straight into the storm.', year: 2022, maturity: 'PG', match: 91, runtimeMin: 95, genres: ['Kids & Family', 'Fantasy', 'Action & Adventure'], moods: ['Whimsical', 'Uplifting', 'Heartfelt'], palette: ['#141e3a', '#5570a8', '#ffe45e'], motif: 'storm', popularity: 76, lines: ['Shh, please do not rumble. Mum is on the phone.', 'It rained in the school library. That was not me.', 'You are not scary at all. You are only loud because you are little.'] }),
  F({ name: 'The Snowglobe Engineers', tagline: 'Big problems. Tiny world.', synopsis: 'Inside a snowglobe on a toyshop shelf, a village of tiny engineers has long kept the snow machine running. When the globe gets knocked off a shelf and cracks, they have one night to fix it. Two young inventors go out into the enormous shop to find glue.', year: 2025, maturity: 'G', match: 92, runtimeMin: 86, genres: ['Kids & Family', 'Animation', 'Comedy'], moods: ['Feel-Good', 'Playful', 'Whimsical'], palette: ['#10223a', '#6fa8dc', '#fff4c2'], motif: 'aurora', popularity: 80, original: true, lines: ['Nobody has ever been outside the glass. Nobody!', 'That is the shop cat. Walk slowly and pretend you are a marble.', 'Every shake, we rebuild. That is what we do.'] }),
  F({ name: 'Goodnight, Comet Kid', tagline: 'It is a long way home. Better pack a sandwich.', synopsis: 'A young comet misses her family\'s orbit and lands, with a soft bump, in a small boy\'s backyard. The two have until the next meteor shower to get her back into space. A gentle bedtime epic with an enormous heart.', year: 2023, maturity: 'PG', match: 90, runtimeMin: 91, genres: ['Kids & Family', 'Animation', 'Sci-Fi'], moods: ['Heartfelt', 'Uplifting', 'Whimsical'], palette: ['#0c1033', '#3f49a8', '#ffd1f0'], motif: 'orbit', popularity: 73, lines: ['Do comets get homesick? Mine is glowing a bit less.', 'Hold my hand, but mind the sparks.', 'Goodnight, Comet Kid. Wave when you pass over.'] }),
  F({ name: 'The Ordinary Miracles of Dr. Pell', tagline: 'He did not believe in them either.', synopsis: 'A skeptical country doctor keeps being credited with minor miracles he insists are just good bedside manners. When pilgrims start lining up outside his surgery, his quiet life unravels. It is a gentle, funny film about being needed.', year: 2020, maturity: 'PG', match: 88, runtimeMin: 106, genres: ['Drama', 'Comedy'], moods: ['Heartfelt', 'Witty', 'Feel-Good'], palette: ['#1b2018', '#6d8061', '#f5deb3'], motif: 'mountains', popularity: 62, lines: ['I gave her an aspirin and told her to walk more. That is not a miracle.', 'There is a coach party in the car park, Doctor, and they have brought their dogs.', 'You sat with him all night. What do you suppose a miracle is?'] }),
  F({ name: 'Out of Office Forever', tagline: 'He quit. Nobody noticed. He still gets paid.', synopsis: 'A mid-level analyst discovers a payroll glitch that makes him officially retired, officially employed and officially dead all at once. He and three coworkers exploit it for one glorious summer. Then the audit arrives.', year: 2024, maturity: 'R', match: 87, runtimeMin: 99, genres: ['Comedy', 'Crime'], moods: ['Witty', 'Quirky', 'Feel-Good'], palette: ['#101a24', '#5a7ca3', '#d4ff5c'], motif: 'grid', popularity: 86, lines: ['According to HR, I died in March and got promoted in May.', 'It is not embezzlement if the computer insists.', 'The auditor is here, and she has brought a smaller auditor.'] }),
  F({ name: 'Undersong', tagline: 'Listen closely. That is how they find you.', synopsis: 'An audio forensics analyst finds a hidden message inside the background music of a hit pop single. Whoever put it there is now watching the three people who noticed. She has only her ears and a very bad feeling.', year: 2022, maturity: 'R', match: 85, runtimeMin: 108, genres: ['Thriller', 'Mystery'], moods: ['Suspenseful', 'Cerebral', 'Dark'], palette: ['#0c0e1c', '#333f6e', '#ff5d8f'], motif: 'neon', popularity: 75, lines: ['Slow it to one-third speed and tell me what you hear on the bridge.', 'That song has played in every city where somebody disappeared.', 'Take your headphones off. Now. Do not look at the window.'] }),
  F({ name: 'The Long Haul Home', tagline: 'Two thousand miles. One broken truck. No more excuses.', synopsis: 'A retiring long-distance trucker agrees to drive his estranged granddaughter across the country for her college audition. Neither of them knows how to talk to the other. The road, and a very persistent radio preacher, have some suggestions.', year: 2021, maturity: 'PG-13', match: 91, runtimeMin: 115, genres: ['Drama', 'Comedy'], moods: ['Heartfelt', 'Bittersweet', 'Feel-Good'], palette: ['#20140a', '#94693d', '#ffcc80'], motif: 'desert', popularity: 66, lines: ['Your grandmother drove this route with me, and she never shut up either.', 'I do not need your approval, I need a jump start.', 'Play it again. The piece. Play it for me here.'] }),
  F({ name: 'The Iron Waltz', tagline: 'They danced once. Then the war came.', synopsis: 'A military engineer and a ballroom pianist meet at the last dance before a border war divides their city. Over seven years, a letter at a time, they keep faith across the front lines. A sweeping and devastating romance.', year: 2018, maturity: 'PG-13', match: 92, runtimeMin: 148, genres: ['Historical', 'Romance', 'Drama'], moods: ['Romantic', 'Epic', 'Bittersweet'], palette: ['#161216', '#5c4a56', '#d4af7a'], motif: 'storm', popularity: 69, lines: ['Save me the last waltz. The last one. Whichever that turns out to be.', 'They have closed the bridge, and I am on the wrong side of your city.', 'I learned this song by ear, through a wall, in a prison.'] }),
  F({ name: 'Voltage Saints', tagline: 'Pray for power.', synopsis: 'In a blacked-out megacity, a street-racing crew runs illicit batteries to the hospitals that the power companies have cut off. When a corporate enforcer starts hunting them, their leader plans one last run across the whole grid. Fast, loud and gloriously electric.', year: 2025, maturity: 'R', match: 90, runtimeMin: 119, genres: ['Action & Adventure', 'Sci-Fi', 'Crime'], moods: ['Thrilling', 'Gritty', 'Epic'], palette: ['#0d0a1f', '#402a9e', '#00f0ff'], motif: 'neon', popularity: 91, original: true, lines: ['Forty percent charge, nine miles, and two of them behind us. Easy.', 'The saints only work nights.', 'Tell the ward we are six minutes out and very on fire.'] }),
  F({ name: 'Redline Monsoon', tagline: 'The road is flooding. The race does not stop.', synopsis: 'An ex-rally champion is forced back behind the wheel for an illegal mountain race run during the monsoon season. Her co-driver is a teenage mechanic with a secret. The roads are washing out behind them one kilometer at a time.', year: 2023, maturity: 'PG-13', match: 83, runtimeMin: 113, genres: ['Action & Adventure', 'Thriller'], moods: ['Thrilling', 'Gritty', 'Uplifting'], palette: ['#0e1a18', '#2f6f62', '#ff3f6c'], motif: 'storm', popularity: 78, lines: ['Left over crest, then pray.', 'That bridge is not on my notes. That bridge is not on anything.', 'You call the corners, kid. I will worry about the river.'] }),
  F({ name: 'Cipher for a Dead Language', tagline: 'The last speaker died. The language kept talking.', synopsis: 'A linguist is summoned to decode a message in a language with no living speakers, sent to the world\'s governments overnight. The closer she gets, the more it seems to be addressed to her. A brainy thriller that never stops turning.', year: 2026, maturity: 'PG-13', match: 93, runtimeMin: 122, genres: ['Thriller', 'Sci-Fi', 'Mystery'], moods: ['Cerebral', 'Suspenseful', 'Thrilling'], palette: ['#0e1216', '#47606e', '#f0e68c'], motif: 'grid', popularity: 88, original: true, lines: ['There is no word in it for yesterday. Think about that.', 'Whoever wrote this knew my grandmother\'s lullaby.', 'Translate that line for me again. Slower. Now tell me why you are crying.'] }),
  F({ name: 'The Beekeeper\'s Algorithm', tagline: 'A hive has no leader. Neither does this.', synopsis: 'A rural beekeeper\'s records turn out to be the training data for a machine intelligence running half of the world\'s supply chains. When the bees begin to die, so does global order. A quiet and beautiful science-fiction drama about attention.', year: 2024, maturity: 'PG-13', match: 89, runtimeMin: 110, genres: ['Sci-Fi', 'Drama'], moods: ['Cerebral', 'Bittersweet', 'Heartfelt'], palette: ['#1a1608', '#8a7321', '#ffd23f'], motif: 'grid', popularity: 67, lines: ['I only ever wrote down when they swarmed. That is all I wrote.', 'Four continents are waiting on your notebook, Mrs. Tan.', 'You cannot debug a hive. You sit with it.'] }),
  F({ name: 'Hum of the Deep Ice', tagline: 'Listen to the oldest sound on Earth.', synopsis: 'A small scientific team spends a polar winter recording the strange low notes made by an ice shelf as it shifts. What they capture has moved musicians and alarmed climatologists. This intimate documentary is haunting and beautiful in equal measure.', year: 2023, maturity: 'G', match: 90, runtimeMin: 82, genres: ['Documentary'], moods: ['Cerebral', 'Bittersweet', 'Inspiring'], palette: ['#071826', '#2d6d8e', '#bdf3ff'], motif: 'aurora', popularity: 56, lines: ['At night you feel it in your teeth before you hear it.', 'The ice is forty thousand years old, and it has started to change key.', 'We kept the microphones running through the whole of June.'] }),
  F({ name: 'Feast of the Nomad Kitchens', tagline: 'Dinner has been traveling for three thousand years.', synopsis: 'A chef and a historian follow seasonal herding families across three continents, cooking with them along the way. Recipes turn out to be maps of migration, trade and survival. It will make you hungry and then quite thoughtful.', year: 2022, maturity: 'PG', match: 87, runtimeMin: 94, genres: ['Documentary', 'Historical'], moods: ['Uplifting', 'Heartfelt', 'Inspiring'], palette: ['#22130a', '#a0632a', '#ffd38a'], motif: 'desert', popularity: 54, lines: ['This bread has been on this road longer than the road has.', 'She does not measure. She has never once measured.', 'Eat first. Then you may ask your questions.'] }),
  F({ name: 'Tall Ships, Small Crews', tagline: 'Nine teenagers. One tall ship. An ocean to cross.', synopsis: 'A training voyage takes nine teenagers from very different backgrounds across the Atlantic aboard a century-old sailing ship. Filmed entirely by the crew, the film captures seasickness, storms and something like growing up. You will be rooting for all of them.', year: 2024, maturity: 'PG', match: 88, runtimeMin: 90, genres: ['Documentary', 'Action & Adventure'], moods: ['Inspiring', 'Uplifting', 'Heartfelt'], palette: ['#0b1f33', '#3b7ca8', '#ffe7a0'], motif: 'waves', popularity: 57, lines: ['I have never been on a boat, and I am in charge of this rope.', 'At three in the morning, there is nobody on that mast to be except yourself.', 'Land! Sorry, that is a cloud. False alarm.'] }),
  F({ name: 'The Last Analog City', tagline: 'They never got around to upgrading. They are glad.', synopsis: 'A remote island capital still runs on rotary phones, paper ledgers and telegrams, thanks to an accident of history. A filmmaker spends a year with its switchboard operators as the fiber cables finally arrive. It is a funny and affectionate farewell.', year: 2026, maturity: 'PG', match: 86, runtimeMin: 86, genres: ['Documentary', 'Comedy'], moods: ['Quirky', 'Bittersweet', 'Feel-Good'], palette: ['#1c1a14', '#7a725a', '#ffbf69'], motif: 'city', popularity: 60, lines: ['Hold the line, I will walk over and see if he is in.', 'We do have a website. It is a noticeboard outside the bakery.', 'Forty-one years at this switchboard, and I know who is calling by the ring.'] }),
  F({ name: 'Moonrise Over Kettle Lake', tagline: 'One summer. One cabin. Twenty years of things unsaid.', synopsis: 'Old college friends reunite for a final summer at a lakeside cabin that one of them must sell. Romance rekindles, grudges resurface and the kettle will not stop whistling. A warm, funny and quietly wise ensemble film.', year: 2021, maturity: 'PG-13', match: 85, runtimeMin: 105, genres: ['Romance', 'Comedy', 'Drama'], moods: ['Bittersweet', 'Romantic', 'Witty'], palette: ['#101c2c', '#5c7fa3', '#ffe08a'], motif: 'waves', popularity: 65, lines: ['You did not write. You said you would write.', 'We were going to save the world by thirty. I have a mortgage.', 'Swim out to the raft with me. Like we used to.'] }),
  F({ name: 'Seven Doors to Aldermoor', tagline: 'Six are safe. Nobody remembers which.', synopsis: 'When her brother vanishes through a door in an old estate, a stubborn young locksmith follows him into the shifting realm of Aldermoor. Each door demands a price of memory to pass. She has to choose what she can afford to forget.', year: 2025, maturity: 'PG-13', match: 92, runtimeMin: 134, genres: ['Fantasy', 'Action & Adventure'], moods: ['Epic', 'Whimsical', 'Suspenseful'], palette: ['#141024', '#54408f', '#7be0ad'], motif: 'forest', popularity: 87, lines: ['Every lock in Aldermoor is hungry, and it is your memories it eats.', 'You have given up your mother\'s face. Was that worth a corridor?', 'The seventh door is older than the house, and it is not on your side.'] }),
  F({ name: 'The Witch of Tollgate Pass', tagline: 'Everyone pays. Ask her what.', synopsis: 'A centuries-old witch guards the only mountain pass into a warring kingdom, taking a strange toll from each traveler. A runaway prince and his bodyguard try to cross with nothing left to give. She takes an interest, and that may be worse.', year: 2022, maturity: 'PG-13', match: 86, runtimeMin: 125, genres: ['Fantasy', 'Drama'], moods: ['Dark', 'Witty', 'Epic'], palette: ['#10161f', '#47586f', '#ff9d6c'], motif: 'mountains', popularity: 63, lines: ['I do not want your gold, little prince. I want your best memory of your mother.', 'Three hundred years I have sat here, and you are the first to say please.', 'The toll has already been paid. Check your pockets, and your shadow.'] }),
  F({ name: 'The Feathered Crown', tagline: 'To rule the sky, you must first learn to fall.', synopsis: 'In a world of floating islands, a flightless young heron is unexpectedly named heir to the Sky Throne. To claim it she must cross the Great Updraft on foot, ladder and borrowed goose. A dazzling animated adventure for all ages.', year: 2026, maturity: 'PG', match: 94, runtimeMin: 101, genres: ['Animation', 'Kids & Family', 'Fantasy'], moods: ['Epic', 'Uplifting', 'Whimsical'], palette: ['#0d2340', '#4d9de0', '#ffcf56'], motif: 'aurora', popularity: 92, original: true, lines: ['A queen who cannot fly? Well, at least she will notice the ground.', 'Ladder, goose, ladder, goose. That is the entire plan.', 'Every bird has fallen once. They just do not mention it.'] }),
  F({ name: 'Laugh Track for a Funeral', tagline: 'Please hold your applause until after the burial.', synopsis: 'When the star of a beloved old sitcom dies, the cast reunites to perform his eulogy in front of a live studio audience, at his insistence. Old rivalries and terrible catchphrases return in force. It\'s absurd, messy and surprisingly moving.', year: 2025, maturity: 'R', match: 91, runtimeMin: 96, genres: ['Comedy', 'Drama'], moods: ['Witty', 'Bittersweet', 'Quirky'], palette: ['#1f0e16', '#9c3a5c', '#ffd2a1'], motif: 'city', popularity: 81, lines: ['He wrote it into his will: three cameras and a warm-up act.', 'If you do the catchphrase at the graveside, I will end you.', 'We shot two hundred episodes, and I never once knew what he thought of me.'] }),
  F({ name: 'Paper Tigers of Harrow Row', tagline: 'Sometimes the bluff is the only weapon left.', synopsis: 'Three aging con artists in a seaside retirement home discover that its owner is quietly draining the residents\' savings. They come out of retirement for one last elaborate sting, armed with walkers, wit and a borrowed hearse. Nobody suspects the old folks.', year: 2026, maturity: 'PG-13', match: 90, runtimeMin: 107, genres: ['Crime', 'Comedy'], moods: ['Witty', 'Feel-Good', 'Quirky'], palette: ['#191410', '#7d5a3c', '#ffb86b'], motif: 'city', popularity: 83, lines: ['Margaret, you are the distraction. Faint as if you mean it.', 'I sold a bridge in 1962. I can sell this man a parking space.', 'At our age, every getaway is a slow one.'] }),
  F({ name: 'Emberfall', tagline: 'The last dragon does not want to be saved.', synopsis: 'A disillusioned royal hunter is ordered to bring in the last living dragon, only to find an old and tired creature with a sharp tongue. Together they cross a kingdom that wants both of them dead. An unusual and touching fantasy adventure.', year: 2027, maturity: 'PG-13', match: 89, runtimeMin: 138, genres: ['Fantasy', 'Action & Adventure'], moods: ['Epic', 'Witty', 'Bittersweet'], palette: ['#1e0e08', '#a33e16', '#ffc145'], motif: 'storm', popularity: 94, original: true, soon: '2027-03-05', lines: ['You are late. The last hunter was prompt. He is over there.', 'I have eaten kings with better manners than you.', 'They will write that you slew me. Do try to look surprised.'] }),
  F({ name: 'The Tenant Upstairs', tagline: 'Nobody has rented that flat in eleven years.', synopsis: 'A newly arrived night nurse keeps hearing footsteps from the flat above hers, and then a voice through the ceiling that knows her schedule. The landlord insists the top floor has been empty for over a decade. She starts to leave notes, and the notes get answered.', year: 2026, maturity: 'R', match: 88, runtimeMin: 100, genres: ['Horror', 'Thriller'], moods: ['Eerie', 'Suspenseful', 'Dark'], palette: ['#100d0d', '#4a3838', '#ff6f59'], motif: 'city', popularity: 86, soon: '2026-12-18', lines: ['You worked late again. I waited up.', 'There is no fourth floor, love. The stairs stop at three.', 'The note says thank you for the milk, and I never bought any milk.'] }),
  F({ name: 'Marigold Junction', tagline: 'The train stops here for four minutes. Long enough.', synopsis: 'A commuter and a railway-station tea seller share a four-minute conversation every morning for six years. When the line is scheduled to close, they must decide whether they can exist outside of those minutes. It is a tender romance told in very short scenes.', year: 2027, maturity: 'PG', match: 92, runtimeMin: 103, genres: ['Romance', 'Drama'], moods: ['Romantic', 'Heartfelt', 'Bittersweet'], palette: ['#241806', '#c98a1b', '#ffe29a'], motif: 'grid', popularity: 78, soon: '2027-02-12', lines: ['You have four minutes, and I have made it the way you like.', 'Six years, and I do not know your surname.', 'They are closing the line in March. Say something, the whistle is going.'] }),
  F({ name: 'Bramble and the Big Sneeze', tagline: 'One sneeze changed everything. Bless you.', synopsis: 'A little badger named Bramble sneezes so hard that the whole forest gets blown to the other side of the valley. Now she and her friends have to bring it all back before winter, tree by tree. A very silly and very sweet family film.', year: 2026, maturity: 'G', match: 87, runtimeMin: 79, genres: ['Kids & Family', 'Animation', 'Comedy'], moods: ['Playful', 'Feel-Good', 'Whimsical'], palette: ['#17260f', '#7cb342', '#ffd180'], motif: 'forest', popularity: 75, lines: ['Ah, ah, ah, nobody stand behind me!', 'Excuse me, Mr. Owl, have you seen an oak? It was here on Tuesday.', 'We can carry it, if everyone takes one leaf.'] }),
];

/* ---------- public data ---------- */

export const TITLES = [...SERIES, ...FILMS];

const BY_ID = new Map(TITLES.map((t) => [t.id, t]));
const GENRE_BY_SLUG = new Map(GENRES.map((g) => [slug(g), g]));
const streaming = () => TITLES.filter((t) => !t.comingSoon);
const byPopularity = (a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name);

/* ---------- public functions ---------- */

export function getTitle(id) {
  return BY_ID.get(id);
}

export function titlesByGenre(genre) {
  return streaming().filter((t) => t.genres.includes(genre)).sort(byPopularity);
}

export function genreFromSlug(s) {
  return GENRE_BY_SLUG.get(s);
}

export function searchTitles(query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  const wordStart = (text, w) => text.split(/[^a-z0-9']+/).some((part) => part.startsWith(w));
  const scored = [];
  for (const t of TITLES) {
    const name = t.name.toLowerCase();
    const people = [...t.cast, ...t.creators].map((p) => p.toLowerCase());
    const genres = t.genres.map((g) => g.toLowerCase());
    const moods = t.moods.map((m) => m.toLowerCase());
    let score = 0;
    if (name === q) score += 1000;
    else if (name.startsWith(q)) score += 500;
    else if (name.includes(q)) score += 300;
    let allMatched = true;
    for (const w of words) {
      let best = 0;
      if (wordStart(name, w)) best = 100;
      else if (name.includes(w)) best = 70;
      else if (people.some((p) => wordStart(p, w))) best = 60;
      else if (genres.some((g) => wordStart(g, w))) best = 50;
      else if (moods.some((m) => wordStart(m, w))) best = 40;
      else if (people.some((p) => p.includes(w)) || genres.some((g) => g.includes(w)) || moods.some((m) => m.includes(w))) best = 20;
      if (!best) allMatched = false;
      score += best;
    }
    if (allMatched) scored.push({ t, score });
  }
  return scored.sort((a, b) => b.score - a.score || byPopularity(a.t, b.t)).map((s) => s.t);
}

export function getSimilar(id, n = 12) {
  const base = getTitle(id);
  if (!base) return [];
  const score = (t) =>
    t.genres.filter((g) => base.genres.includes(g)).length * 3 +
    t.moods.filter((m) => base.moods.includes(m)).length * 2 +
    (t.type === base.type ? 1 : 0) +
    (t.motif === base.motif ? 1 : 0) +
    (isKidsSafe(t) === isKidsSafe(base) ? 2 : 0) +
    t.popularity / 100;
  return streaming()
    .filter((t) => t.id !== id)
    .map((t) => ({ t, s: score(t) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.t);
}

export function getTopTen(type) {
  return streaming()
    .filter((t) => !type || t.type === type)
    .sort(byPopularity)
    .slice(0, 10);
}

export function getComingSoon() {
  return TITLES.filter((t) => t.comingSoon).sort((a, b) => a.comingSoon.localeCompare(b.comingSoon));
}

export function isKidsSafe(title) {
  return ['G', 'PG', 'TV-Y', 'TV-PG'].includes(title.maturity);
}

export function getHomeRows() {
  const all = streaming();
  const where = (fn) => all.filter(fn);
  const hasGenre = (...gs) => (t) => t.genres.some((g) => gs.includes(g));
  const hasMood = (...ms) => (t) => t.moods.some((m) => ms.includes(m));
  // A stable shuffle keeps rows from all opening with the same few titles, while favoring popular ones.
  const blend = (list, key, cap = 20) =>
    list
      .map((t) => ({ t, s: t.popularity + (hash(`${key}|${t.id}`) % 30) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, cap)
      .map((x) => x.t);
  return [
    { title: 'Trending Now', items: blend(all, 'trending') },
    { title: 'Top 10 Series Today', items: getTopTen('series'), ranked: true },
    { title: 'New on Lumora', items: blend(where((t) => t.isNew || t.year === 2025), 'new') },
    { title: 'Lumora Originals', items: blend(where((t) => t.isOriginal), 'originals') },
    { title: 'Tense and Twisty', items: blend(where(hasGenre('Thriller', 'Mystery', 'Crime')), 'tense') },
    { title: 'Top 10 Films Today', items: getTopTen('movie'), ranked: true },
    { title: 'Comedies With Bite', items: blend(where(hasGenre('Comedy')), 'comedy') },
    { title: 'Worlds Beyond Ours', items: blend(where(hasGenre('Sci-Fi', 'Fantasy')), 'worlds') },
    { title: 'Binge-Worthy Series', items: blend(where((t) => t.type === 'series' && t.seasons.length >= 2 && t.match >= 85), 'binge') },
    { title: 'Critics’ Favorites', items: [...all].sort((a, b) => b.match - a.match || byPopularity(a, b)).slice(0, 20) },
    { title: 'Leave the Lights On', items: blend(where((t) => t.genres.includes('Horror') || t.moods.includes('Eerie') || (t.moods.includes('Dark') && t.genres.includes('Mystery'))), 'horror') },
    { title: 'Love Stories', items: blend(where((t) => t.genres.includes('Romance') || t.moods.includes('Romantic')), 'romance') },
    { title: 'Pulse-Racing Adventures', items: blend(where(hasGenre('Action & Adventure')), 'action') },
    { title: 'Stories From Another Time', items: blend(where((t) => t.genres.includes('Historical') || (t.genres.includes('Fantasy') && t.moods.includes('Epic'))), 'history') },
    { title: 'True Stories and Real Competition', items: blend(where(hasGenre('Documentary', 'Reality')), 'real') },
    { title: 'Family Movie Night', items: blend(where(hasGenre('Kids & Family')), 'family') },
    { title: 'Feel-Good Favorites', items: blend(where(hasMood('Feel-Good', 'Uplifting')), 'feelgood') },
  ];
}
