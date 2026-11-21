// Noms de compétitions, de tours et de libellés sportifs en français (les sources ESPN / API-Sports sont en anglais).
const EXACT = {
  "english premier league": "Premier League (Angleterre)", "premier league": "Premier League (Angleterre)",
  "spanish laliga": "LaLiga (Espagne)", "laliga": "LaLiga (Espagne)", "spanish la liga": "LaLiga (Espagne)", "la liga": "LaLiga (Espagne)",
  "italian serie a": "Serie A (Italie)", "german bundesliga": "Bundesliga (Allemagne)", "bundesliga": "Bundesliga (Allemagne)",
  "french ligue 1": "Ligue 1", "ligue 1": "Ligue 1", "french ligue 2": "Ligue 2", "ligue 2": "Ligue 2",
  "uefa champions league": "Ligue des champions", "champions league": "Ligue des champions",
  "uefa europa league": "Ligue Europa", "europa league": "Ligue Europa",
  "uefa conference league": "Ligue Conférence", "uefa europa conference league": "Ligue Conférence", "conference league": "Ligue Conférence",
  "uefa nations league": "Ligue des nations", "uefa super cup": "Supercoupe d'Europe",
  "english championship": "Championship (Angleterre)", "english league one": "League One (Angleterre)", "english league two": "League Two (Angleterre)",
  "english fa cup": "FA Cup", "english carabao cup": "Coupe de la Ligue anglaise", "english league cup": "Coupe de la Ligue anglaise",
  "spanish copa del rey": "Coupe du Roi", "german dfb pokal": "Coupe d'Allemagne", "italian coppa italia": "Coupe d'Italie", "coupe de france": "Coupe de France", "french coupe de france": "Coupe de France",
  "dutch eredivisie": "Eredivisie (Pays-Bas)", "portuguese primeira liga": "Liga Portugal", "portuguese liga": "Liga Portugal", "belgian pro league": "Jupiler Pro League (Belgique)",
  "turkish super lig": "Süper Lig (Turquie)", "scottish premiership": "Premiership (Écosse)", "saudi pro league": "Saudi Pro League (Arabie saoudite)",
  "mls": "MLS (États-Unis)", "major league soccer": "MLS (États-Unis)", "mexican liga mx": "Liga MX (Mexique)", "brazilian serie a": "Brasileirão Série A", "argentine liga profesional": "Liga Profesional (Argentine)",
  "international friendly": "Match amical international", "friendly": "Match amical", "club friendly": "Match amical (clubs)", "club friendlies": "Matchs amicaux (clubs)",
  "fifa world cup": "Coupe du monde", "fifa club world cup": "Coupe du monde des clubs", "africa cup of nations": "Coupe d'Afrique des nations", "copa america": "Copa América",
  "nba": "NBA", "nhl": "NHL", "nfl": "NFL", "mlb": "MLB",
};
const COUNTRY = {
  english: "Angleterre", spanish: "Espagne", italian: "Italie", german: "Allemagne", french: "France", dutch: "Pays-Bas", portuguese: "Portugal", belgian: "Belgique",
  turkish: "Turquie", scottish: "Écosse", welsh: "Pays de Galles", irish: "Irlande", greek: "Grèce", swiss: "Suisse", austrian: "Autriche", danish: "Danemark",
  swedish: "Suède", norwegian: "Norvège", finnish: "Finlande", polish: "Pologne", czech: "Tchéquie", croatian: "Croatie", serbian: "Serbie", romanian: "Roumanie",
  russian: "Russie", ukrainian: "Ukraine", brazilian: "Brésil", argentine: "Argentine", argentinian: "Argentine", chilean: "Chili", colombian: "Colombie", mexican: "Mexique",
  american: "États-Unis", saudi: "Arabie saoudite", japanese: "Japon", korean: "Corée du Sud", chinese: "Chine", australian: "Australie", egyptian: "Égypte", moroccan: "Maroc",
};
const WORDS = [
  [/\bMen'?s\b\s*/gi, ""],
  [/\bWorld Cup Qualifying\b/gi, "Éliminatoires Coupe du monde"], [/\bQualifying\b/gi, "Qualifications"], [/\bQualifiers?\b/gi, "Qualifications"],
  [/\bChampions League\b/gi, "Ligue des champions"], [/\bEuropa League\b/gi, "Ligue Europa"], [/\bConference League\b/gi, "Ligue Conférence"], [/\bNations League\b/gi, "Ligue des nations"],
  [/\bWorld Cup\b/gi, "Coupe du monde"], [/\bSuper Cup\b/gi, "Supercoupe"], [/\bLeague Cup\b/gi, "Coupe de la Ligue"], [/\bCup\b/gi, "Coupe"],
  [/\bFriendl(y|ies)\b/gi, "Matchs amicaux"], [/\bPlayoffs?\b/gi, "Barrages"], [/\bPlay-offs?\b/gi, "Barrages"],
  [/\bRound of 16\b/gi, "Huitièmes de finale"], [/\bRound of 32\b/gi, "Seizièmes de finale"], [/\bRound of (\d+)\b/gi, "Tour des $1"], [/\bQuarterfinals?\b/gi, "Quarts de finale"], [/\bQuarter-finals?\b/gi, "Quarts de finale"], [/\bSemifinals?\b/gi, "Demi-finales"], [/\bSemi-finals?\b/gi, "Demi-finales"],
  [/(?<!(?:ATP|WTA|NBA|NFL|Cup) )\bFinals?\b/gi, "Finale"], [/\bGroup Stage\b/gi, "Phase de groupes"], [/\bLeague Phase\b/gi, "Phase de ligue"], [/\bGroup\b/gi, "Groupe"], [/\bRound\b/gi, "Tour"], [/\bMatchday\b/gi, "Journée"],
  [/\bFirst Division\b/gi, "1re division"], [/\bSecond Division\b/gi, "2e division"], [/\bReserves?\b/gi, "réserve"], [/\bYouth\b/gi, "jeunes"],
];

export function frComp(name) {
  if (!name || typeof name !== "string") return name;
  // compétitions féminines : on traduit le nom puis on ajoute « (féminine) »
  if (/\bWomen'?s?\b|\bWomen\b/i.test(name)) { const base = frComp(name.replace(/\bWomen'?s?\b\s*/gi, "").replace(/\s{2,}/g, " ")); return /féminine/.test(base) ? base : `${base} (féminine)`; }
  const raw = name.trim(), k = raw.toLowerCase();
  if (EXACT[k]) return EXACT[k];
  // « English Premier League », « Spanish Copa del Rey »… : adjectif de pays en tête
  const m = /^([A-Za-z]+)\s+(.+)$/.exec(raw);
  if (m && COUNTRY[m[1].toLowerCase()]) {
    const rest = EXACT[m[2].toLowerCase()] || WORDS.reduce((s, [re, to]) => s.replace(re, to), m[2]);
    return /\(/.test(rest) ? rest : `${rest} (${COUNTRY[m[1].toLowerCase()]})`;
  }
  let s = raw.replace(/^UEFA\s+/i, "").replace(/^FIFA\s+/i, "");
  if (EXACT[s.toLowerCase()]) return EXACT[s.toLowerCase()];
  for (const [re, to] of WORDS) s = s.replace(re, to);
  return s.replace(/\s+-\s+/g, " · ").replace(/\s{2,}/g, " ").trim();
}
