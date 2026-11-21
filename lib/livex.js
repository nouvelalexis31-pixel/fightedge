// Scores en direct hors football (API-Sports, offre gratuite : 100 requêtes par jour et par sport).
// Un appel par sport, mis en cache 8 minutes : au plus ~90 appels par sport sur une journée de matchs.
import { espnJson } from "./espnfetch.js";
import { afOn, afGuard, afFail } from "./afguard.js";
import { unstable_cache } from "next/cache";
import { todayKey } from "@/lib/format";

export const OTHER = [
  { id: "basket", label: "Basket", icon: "🏀", host: "v1.basketball.api-sports.io", path: "games", leagues: /^(NBA|Euroleague|EuroLeague|EuroCup|Eurocup|NCAA|LNB.*|Pro A|Betclic.*|ACB|Liga ACB|Lega Basket.*|BBL|Basketball Bundesliga)$/i },
  { id: "hockey", label: "Hockey", icon: "🏒", host: "v1.hockey.api-sports.io", path: "games", leagues: /^(NHL|AHL|KHL|SHL|Liiga|DEL|Ligue Magnus|Champions Hockey League)$/i },
  { id: "rugby", label: "Rugby", icon: "🏉", host: "v1.rugby.api-sports.io", path: "games", leagues: /top 14|pro d2|premiership|united rugby|urc|champions cup|challenge cup|six nations|rugby championship|super rugby|international|nations/i },
  { id: "baseball", label: "Baseball", icon: "⚾", host: "v1.baseball.api-sports.io", path: "games", leagues: /^MLB$/i },
  { id: "nfl", label: "Foot US", icon: "🏈", host: "v1.american-football.api-sports.io", path: "games", leagues: /^(NFL|NCAA)$/i },
  { id: "mma", label: "MMA", icon: "🥋", host: "v1.mma.api-sports.io", path: "fights", leagues: /ufc|bellator|pfl|one championship/i },
];

const UP = /^(NS|TBD|SCH|NOT STARTED)$/i;
const OFF = /^(PST|POST|CANC|ABD|SUSP|WO|AW|INTR)$/i;
const DONE = /^(FT|AOT|AET|AP|PEN|FIN|F|FINAL|ENDED|FINISHED|AFTER OVER TIME)$/i;
const LABEL = { HT: "Mi-temps", BT: "Pause", OT: "Prolong.", P1: "1re période", P2: "2e période", P3: "3e période", "1H": "1re mi-temps", "2H": "2e mi-temps", Q1: "1er quart", Q2: "2e quart", Q3: "3e quart", Q4: "4e quart" };

const num = (x) => (x == null ? null : typeof x === "object" ? (x.total ?? null) : Number.isFinite(Number(x)) ? Number(x) : null);

function norm(g) {
  const fight = !!g.fighters;
  const home = fight ? g.fighters.first : g.teams?.home;
  const away = fight ? g.fighters.second : g.teams?.away;
  if (!home?.name || !away?.name) return null;
  const st = String(g.status?.short || g.status?.long || "").trim();
  const state = DONE.test(st) ? "done" : UP.test(st) ? "up" : OFF.test(st) ? "off" : "live";
  const start = g.date || (g.timestamp ? new Date(g.timestamp * 1000).toISOString() : null);
  const base = String(LABEL[st.toUpperCase()] || g.status?.long || st);
  const label = state === "live" ? (g.status?.timer ? `${base} ${g.status.timer}'` : base) : state === "off" ? "Reporté" : "";
  return {
    id: String(g.id), state, label, start,
    comp: (fight ? g.slug || g.category : g.league?.name) || "Autres",
    home: { name: home.name, crest: home.logo || null, win: fight ? !!home.winner : false },
    away: { name: away.name, crest: away.logo || null, win: fight ? !!away.winner : false },
    h: fight ? null : num(g.scores?.home), a: fight ? null : num(g.scores?.away),
  };
}

async function one(s, date) {
  afGuard();
  const res = await fetch(`https://${s.host}/${s.path}?date=${date}&timezone=Europe/Paris`, { headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY }, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  const errs = Object.values(j.errors || {});
  if (errs.length) { afFail(String(errs[0])); throw new Error(String(errs[0]).slice(0, 120)); }
  return (j.response || []).map(norm).filter((m) => m && s.leagues.test(m.comp)).sort((x, y) => String(x.start).localeCompare(String(y.start)));
}

// Football (API-Sports) : tous les championnats et coupes courants, un seul appel pour la journée.
const FOOT_OK = /^(ligue 1|ligue 2|premier league|championship|league one|league two|la liga|primera división|segunda división|laliga.*|serie a|serie b|bundesliga|2\. bundesliga|3\. liga|eredivisie|eerste divisie|primeira liga|liga portugal.*|jupiler pro league|pro league|first division a|super lig|süper lig|1\. lig|premiership|scottish.*|super league.*|superliga|allsvenskan|eliteserien|ekstraklasa|liga profesional.*|primera division|serie a|brasileirão.*|mls|liga mx|saudi pro league|pro league|j1 league|a-league.*|k league 1|.*cup|copa.*|coupe.*|dfb pokal|coppa.*|trophée.*|uefa .*|conmebol .*|concacaf .*|caf .*|afc .*|world cup.*|fifa .*|euro championship.*|friendlies.*|.*qualification.*|.*nations league.*)$/i;
const FOOT_NO = /\bu-?\d{2}\b|women|féminin|feminin|femenin|reserve|youth|amateur|regional|primavera|futsal|esoccer|virtual|\bii\b|\bb$/i;
const FSTATE = { NS: "up", TBD: "up", FT: "done", AET: "done", PEN: "done", AWD: "done", WO: "done", PST: "off", CANC: "off", ABD: "off", SUSP: "off", INT: "off" };
const FLABEL = { HT: "Mi-temps", BT: "Pause", P: "Tirs au but", LIVE: "En cours" };

const TEAM_NO = /\bU-?\d{2}\b|\bII\b|\bIII\b|\bB$|\(W\)|\bW$|women/i;
const MAJOR = /^(France|England|Spain|Italy|Germany|Netherlands|Portugal|Belgium|Turkey|Scotland|Brazil|Argentina|USA|Mexico|Saudi-Arabia|Switzerland|Austria|Greece|Denmark|Sweden|Norway|Poland|Japan|Australia|South-Korea|Croatia|Czech-Republic|Russia|Ukraine|Colombia|Chile|Uruguay)$/i;
function normFoot(g) {
  const f = g.fixture, h = g.teams?.home, a = g.teams?.away, l = g.league;
  if (!f || !h?.name || !a?.name || !l?.name) return null;
  if (!FOOT_OK.test(l.name) || FOOT_NO.test(l.name) || TEAM_NO.test(h.name) || TEAM_NO.test(a.name) || /kings|premier league cup|youth|u21|u23|trophy|lower|cup of nations/i.test(l.name)) return null;
  if (!/^(World|Europe|South America|North America|Asia|Africa)$/i.test(l.country || "World") && !MAJOR.test(l.country || "")) return null;
  const st = String(f.status?.short || "");
  const state = FSTATE[st] || "live";
  const label = state === "live" ? (FLABEL[st] || (f.status?.elapsed != null ? `${f.status.elapsed}'` : "En cours")) : state === "off" ? "Reporté" : "";
  const gen = /^(premier league|super league.*|premiership|serie a|serie b|primera división|liga profesional.*|pro league|super lig|ligue 1)$/i.test(l.name) && l.country && l.country !== "World";
  return {
    id: `af${f.id}`, state, label, start: f.date,
    comp: gen && !/^(ligue 1|serie a)$/i.test(l.name) ? `${l.name} (${l.country})` : l.name === "Serie A" && l.country === "Brazil" ? "Brasileirão Série A" : l.name,
    home: { name: h.name, crest: h.logo || null }, away: { name: a.name, crest: a.logo || null },
    h: state === "up" || state === "off" ? null : num(g.goals?.home), a: state === "up" || state === "off" ? null : num(g.goals?.away),
  };
}

async function foot(date) {
  afGuard();
  const res = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}&timezone=Europe/Paris`, { headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY }, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  const errs = Object.values(j.errors || {});
  if (errs.length) { afFail(String(errs[0])); throw new Error(String(errs[0]).slice(0, 120)); }
  return (j.response || []).map(normFoot).filter(Boolean).sort((x, y) => String(x.start).localeCompare(String(y.start)));
}

const cachedFoot = unstable_cache(async (date) => ({ items: await foot(date) }), ["livefoot-v2"], { revalidate: 480 });

export async function getFootLive() {
  if (!afOn()) return { items: [], error: process.env.API_FOOTBALL_KEY ? "API-Football indisponible" : "no-key" };
  try { return { ...(await cachedFoot(todayKey())), error: null }; }
  catch (e) { return { items: [], error: e.message }; }
}

// Sources gratuites sans clé (ESPN, NHL, MLB) pour basket, hockey, baseball et foot US.
const FRN = (n) => (n === 1 ? "1re période" : n === 2 ? "2e période" : n === 3 ? "3e période" : "Prolong.");
const QRT = (n) => (n === 1 ? "1er quart" : n <= 4 ? n + "e quart" : "Prolong.");
const sc = (x) => (x === "" || x == null || !Number.isFinite(Number(x)) ? null : Number(x));
async function getJson(url) {
  return espnJson(url);
}

async function espn(path, comp) {
  const j = await getJson("https://site.api.espn.com/apis/site/v2/sports/" + path + "/scoreboard");
  return (j.events || []).map((e) => {
    const c = e.competitions?.[0];
    const cs = c?.competitors || [];
    const h = cs.find((x) => x.homeAway === "home"), a = cs.find((x) => x.homeAway === "away");
    if (!h?.team || !a?.team) return null;
    const t = e.status?.type || {};
    const state = t.state === "in" ? "live" : t.state === "post" ? "done" : /POSTPONED|CANCELED|SUSPENDED/.test(t.name || "") ? "off" : "up";
    const per = e.status?.period || 0, clock = e.status?.displayClock;
    const label = state === "live" ? (/HALFTIME/.test(t.name || "") ? "Mi-temps" : (QRT(per) + (clock ? " " + clock : ""))) : state === "off" ? "Reporté" : "";
    const nm = (x) => x.team.displayName || x.team.name;
    return {
      id: "es" + e.id, state, label, start: e.date, comp, tv: tvOf(c, e),
      home: { name: nm(h), crest: h.team.logo || null }, away: { name: nm(a), crest: a.team.logo || null },
      h: state === "up" || state === "off" ? null : sc(h.score), a: state === "up" || state === "off" ? null : sc(a.score),
    };
  }).filter(Boolean);
}

async function nhl() {
  const j = await getJson("https://api-web.nhle.com/v1/score/now");
  const nm = (t) => (t.placeName?.default && t.commonName?.default ? t.placeName.default + " " + t.commonName.default : t.name?.default || t.abbrev);
  return (j.games || []).map((g) => {
    if (!g.homeTeam || !g.awayTeam) return null;
    const gs = String(g.gameState || "");
    const state = /^(LIVE|CRIT)$/.test(gs) ? "live" : /^(FINAL|OFF)$/.test(gs) ? "done" : /POST|PPD/.test(gs) ? "off" : "up";
    const pn = g.periodDescriptor?.number || g.period || 0, pt = g.periodDescriptor?.periodType;
    const base = pt === "SO" ? "Tirs au but" : pt === "OT" ? "Prolong." : FRN(pn);
    const label = state === "live" ? (g.clock?.inIntermission ? "Pause" : base + (g.clock?.timeRemaining ? " " + g.clock.timeRemaining : "")) : state === "off" ? "Reporté" : "";
    const goals = (g.goals || []).map((x) => {
      const mm = String(x.timeInPeriod || "").split(":");
      const min = mm.length === 2 && x.period ? (Number(x.period) - 1) * 20 + Number(mm[0]) + 1 : null;
      const ab = typeof x.teamAbbrev === "object" ? x.teamAbbrev?.default : x.teamAbbrev;
      const nme = x.name?.default || [x.firstName?.default, x.lastName?.default].filter(Boolean).join(" ");
      return { min, name: nme, team: ab === g.homeTeam.abbrev ? "h" : "a", type: "" };
    }).filter((x) => x.name);
    return {
      id: "nh" + g.id, state, label, start: g.startTimeUTC, comp: "NHL", tv: (() => { const n = (g.tvBroadcasts || []).map((b) => b.network).filter((v, i, a) => v && a.indexOf(v) === i); return n.length ? "Diffusion (source NHL) : " + n.slice(0, 4).join(", ") : null; })(),
      home: { name: nm(g.homeTeam), crest: g.homeTeam.logo || null }, away: { name: nm(g.awayTeam), crest: g.awayTeam.logo || null },
      h: state === "up" || state === "off" ? null : sc(g.homeTeam.score), a: state === "up" || state === "off" ? null : sc(g.awayTeam.score),
      goals,
    };
  }).filter(Boolean);
}

async function mlb() {
  const d = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const j = await getJson("https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=linescore&date=" + d);
  const out = [];
  for (const day of j.dates || []) for (const g of day.games || []) {
    const h = g.teams?.home, a = g.teams?.away;
    if (!h?.team || !a?.team) continue;
    const ab = g.status?.abstractGameState, dt = String(g.status?.detailedState || "");
    const state = /Postponed|Cancel|Suspend/i.test(dt) ? "off" : ab === "Live" ? "live" : ab === "Final" ? "done" : "up";
    const ls = g.linescore || {};
    const label = state === "live" ? (ls.currentInning ? (ls.inningHalf === "Top" ? "Haut " : ls.inningHalf === "Bottom" ? "Bas " : "") + ls.currentInning + "e manche" : "En cours") : state === "off" ? "Reporté" : "";
    out.push({
      id: "ml" + g.gamePk, state, label, start: g.gameDate, comp: "MLB",
      home: { name: h.team.name, crest: null }, away: { name: a.team.name, crest: null },
      h: state === "up" || state === "off" ? null : sc(h.score), a: state === "up" || state === "off" ? null : sc(a.score),
    });
  }
  return out;
}

const many = (list) => async () => {
  const rs = await Promise.allSettled(list.map(([p, c]) => espn(p, c)));
  if (rs.every((r) => r.status === "rejected")) throw new Error(rs[0].reason?.message || "erreur");
  return rs.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
};
const hockeyAll = async () => {
  const rs = await Promise.allSettled([nhl(), espn("hockey/mens-college-hockey", "Hockey universitaire (NCAA)")]);
  if (rs.every((r) => r.status === "rejected")) throw new Error(rs[0].reason?.message || "erreur");
  return rs.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
};
const FREE = {
  basket: many([["basketball/nba", "NBA"], ["basketball/wnba", "WNBA"], ["basketball/mens-college-basketball", "Basket universitaire (NCAA)"], ["basketball/nba-development", "NBA G League"]]),
  nfl: many([["football/nfl", "NFL"], ["football/college-football", "Football US universitaire (NCAA)"]]),
  hockey: hockeyAll,
  baseball: mlb,
  // Rugby : ESPN (gratuit) à la place d'API-Sports (compte suspendu)
  rugby: many([["rugby/270559", "Top 14"], ["rugby/267979", "Premiership"], ["rugby/270557", "United Rugby Championship"], ["rugby/271937", "Champions Cup"], ["rugby/272073", "Challenge Cup"], ["rugby/289234", "Tests internationaux"], ["rugby/180659", "Tournoi des Six Nations"], ["rugby/244293", "Rugby Championship"], ["rugby/242041", "Super Rugby"]]),
};
const sortStart = (arr) => arr.sort((x, y) => String(x.start).localeCompare(String(y.start)));

// Sources gratuites : 20 s de cache, une erreur n'est pas mise en cache (la fonction lève).
// On garde les matchs en cours, ou commencés/prévus dans une fenêtre de 18 h (ESPN renvoie toute la semaine NFL).
const nearNow = (m) => m.state === "live" || Math.abs(new Date(m.start).getTime() - Date.now()) <= 18 * 3600 * 1000;
const cachedFree = unstable_cache(async (id) => ({ items: sortStart((await FREE[id]()).filter(nearNow)) }), ["livex-free-v3"], { revalidate: 20 });
// API-Sports (rugby, MMA) : 8 min de cache, erreurs mises en cache pour ménager le quota.
const cachedApi = unstable_cache(
  async (id, date) => {
    try { return { items: await one(OTHER.find((x) => x.id === id), date) }; }
    catch (e) { return { items: [], error: /suspend/i.test(e.message) ? "source gratuite indisponible pour ce sport" : e.message }; }
  },
  ["livex-api-v2"],
  { revalidate: 480 }
);

export async function getOtherLive() {
  const date = todayKey();
  const sports = {};
  await Promise.all(OTHER.map(async (s) => {
    try {
      if (FREE[s.id]) sports[s.id] = await cachedFree(s.id);
      else sports[s.id] = process.env.API_FOOTBALL_KEY ? await cachedApi(s.id, date) : { items: [], error: "clé manquante" };
    } catch (e) { sports[s.id] = { items: [], error: e.message }; }
  }));
  return { error: null, sports };
}

// Compétitions interrogées une à une (en plus du flux « toutes compétitions ») : limité aux plus suivies, car ESPN bloque
// (erreur 403) quand on lui envoie des dizaines de requêtes d'un coup.
export const TOP_SLUGS = ["uefa.champions", "uefa.europa", "uefa.europa.conf", "fra.1", "fra.2", "eng.1", "esp.1", "ita.1", "ger.1", "por.1", "ned.1", "bel.1", "tur.1", "sco.1", "eng.2", "sau.1", "usa.1", "bra.1", "arg.1", "mex.1", "uefa.nations", "fifa.friendly", "fifa.worldq.uefa", "eng.fa", "esp.copa_del_rey", "ger.dfb_pokal", "eng.league_cup"];
export const ESPN_LEAGUES = {
  "fra.1": "Ligue 1", "eng.1": "Premier League", "esp.1": "LaLiga", "ita.1": "Serie A", "ger.1": "Bundesliga",
  "uefa.nations": "Ligue des nations UEFA", "uefa.euroq": "Éliminatoires Euro", "fifa.friendly": "Matchs amicaux", "fifa.worldq.uefa": "Éliminatoires Coupe du monde",
  "uefa.europa": "Ligue Europa", "uefa.europa.conf": "Ligue Conférence", "concacaf.nations.league": "Ligue des nations CONCACAF",
  "conmebol.libertadores": "Copa Libertadores", "conmebol.sudamericana": "Copa Sudamericana", "fifa.worldq.conmebol": "Éliminatoires Coupe du monde (Amérique du Sud)",
  "fra.2": "Ligue 2", "eng.2": "Championship", "esp.2": "Segunda División", "ita.2": "Serie B", "ger.2": "2. Bundesliga",
  "bel.1": "Jupiler Pro League", "tur.1": "Süper Lig", "sco.1": "Scottish Premiership", "usa.1": "MLS", "mex.1": "Liga MX", "bra.1": "Brasileirão Série A", "arg.1": "Liga Profesional (Argentine)", "sau.1": "Saudi Pro League",
  "uefa.champions": "Ligue des champions", "eng.fa": "FA Cup", "eng.league_cup": "Coupe de la Ligue anglaise", "eng.3": "League One", "eng.4": "League Two", "esp.copa_del_rey": "Coupe du Roi", "ger.dfb_pokal": "Coupe d'Allemagne", "ger.3": "3. Liga", "ita.coppa_italia": "Coupe d'Italie", "fra.coupe_de_france": "Coupe de France",
  "ned.1": "Eredivisie", "ned.2": "Eerste Divisie", "por.1": "Liga Portugal", "por.2": "Liga Portugal 2", "sco.2": "Scottish Championship", "den.1": "Superliga (Danemark)", "swe.1": "Allsvenskan", "nor.1": "Eliteserien", "sui.1": "Super League (Suisse)", "aut.1": "Bundesliga (Autriche)", "gre.1": "Super League (Grèce)", "rus.1": "Premier League (Russie)", "pol.1": "Ekstraklasa", "cze.1": "Liga tchèque", "cro.1": "HNL (Croatie)", "rou.1": "SuperLiga (Roumanie)", "ukr.1": "Premier League (Ukraine)", "hun.1": "NB I (Hongrie)", "srb.1": "SuperLiga (Serbie)", "isr.1": "Ligat ha'Al (Israël)", "cyp.1": "Championnat de Chypre", "bul.1": "Parva Liga (Bulgarie)", "irl.1": "Premier Division (Irlande)",
  "col.1": "Liga BetPlay (Colombie)", "chi.1": "Primera División (Chili)", "uru.1": "Primera División (Uruguay)", "par.1": "Primera División (Paraguay)", "ecu.1": "LigaPro (Équateur)", "per.1": "Liga 1 (Pérou)", "bol.1": "Primera División (Bolivie)", "ven.1": "Primera División (Venezuela)",
  "jpn.1": "J1 League", "kor.1": "K League 1", "chn.1": "Super League (Chine)", "aus.1": "A-League", "ind.1": "Super League (Inde)", "qat.1": "Qatar Stars League", "egy.1": "Premier League (Égypte)", "rsa.1": "Premier Division (Afrique du Sud)",
  "concacaf.champions": "Ligue des champions CONCACAF", "concacaf.gold": "Gold Cup", "concacaf.leagues.cup": "Leagues Cup", "caf.nations": "Coupe d'Afrique des nations", "caf.nations_qual": "Éliminatoires CAN", "afc.champions": "Ligue des champions AFC", "afc.asian.cup": "Coupe d'Asie", "fifa.worldq.concacaf": "Éliminatoires Coupe du monde (CONCACAF)", "fifa.worldq.caf": "Éliminatoires Coupe du monde (Afrique)", "fifa.worldq.afc": "Éliminatoires Coupe du monde (Asie)", "uefa.super_cup": "Supercoupe d'Europe", "fifa.cwc": "Coupe du monde des clubs", "usa.open": "US Open Cup",
};
const ESPN_DONE_STATUS = /FULL_TIME|FINAL|END_|AFTER_/;
async function espnLeague(slug, date) {
  const isAll = slug === "all";
  const d1 = date.replace(/-/g, "");
  const pv = new Date(date + "T12:00:00Z"); pv.setUTCDate(pv.getUTCDate() - 1);
  const base = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
  const urls = isAll ? [base + "all/scoreboard?limit=1000&dates=" + pv.toISOString().slice(0, 10).replace(/-/g, "") + "-" + d1, base + "all/scoreboard?limit=500&dates=" + d1] : [base + slug + "/scoreboard?dates=" + d1];
  let j = null, lastErr = null;
  for (const u of urls) {
    try {
      j = await espnJson(u, { timeout: isAll ? 10000 : 6000, tries: 2 });
      if (!isAll || (j.events || []).length) break;
    } catch (e) { lastErr = e; }
  }
  if (!j) throw lastErr || new Error("erreur");
  const lmap = {};
  for (const l of j.leagues || []) { const k = String(l.id ?? String(l.uid || "").split("~l:")[1] ?? ""); if (k && (l.name || l.shortName)) lmap[k] = l.name || l.shortName; }
  const slugName = (s) => String(s || "Autres compétitions").replace(/^\d{4}(-\d{2})?-/, "").replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
  const generic = /^(regular season|.*\b(round|tour|phase|group|groupe|stage|matchday|week|leg)\b.*|autres comp.*)$/i;
  const nice = (e) => {
    if (!isAll) return ESPN_LEAGUES[slug];
    const lid = String(e.uid || "").match(/~l:(\d+)/)?.[1];
    const n = (lid && lmap[lid]) || e.league?.name || e.competitions?.[0]?.league?.name || e.season?.name || slugName(e.season?.slug);
    return generic.test(String(n || "").trim()) ? "Autres compétitions" : n;
  };
  return (j.events || []).map((e) => {
    const c = e.competitions?.[0];
    const cs = c?.competitors || [];
    const h = cs.find((x) => x.homeAway === "home"), a = cs.find((x) => x.homeAway === "away");
    if (!h?.team || !a?.team) return null;
    if (/\bU-?\d{2}\b|women|\(W\)/i.test(h.team.displayName + " " + a.team.displayName)) return null;
    if (isAll && /women|femen|f[eé]minin|liga-f|nwsl|youth|reserve|\bU-?\d{2}\b/i.test(String(e.season?.slug || "") + " " + nice(e))) return null;
    const t = e.status?.type || {};
    const state = t.state === "in" ? "live" : t.state === "post" ? "done" : /POSTPONED|CANCELED|SUSPENDED|ABANDONED/.test(t.name || "") ? "off" : "up";
    const clock = String(e.status?.displayClock || "").trim();
    const label = state === "live" ? (/HALFTIME/.test(t.name || "") ? "Mi-temps" : /PENALTY|SHOOTOUT/.test(t.name || "") ? "Tirs au but" : clock || "En cours") : state === "off" ? "Reporté" : "";
    const goals = (c.details || []).filter((d) => d.scoringPlay || /goal/i.test(d.type?.text || "")).map((d) => ({
      min: parseInt(String(d.clock?.displayValue || ""), 10) || null,
      name: d.athletesInvolved?.[0]?.displayName || d.athletesInvolved?.[0]?.shortName || "",
      team: String(d.team?.id) === String(h.team.id) ? "h" : "a",
      type: /own/i.test(d.type?.text || "") ? "OWN" : /penalty/i.test(d.type?.text || "") ? "PEN" : "",
    })).filter((g) => g.name);
    const cards = (c.details || []).filter((d) => d.yellowCard || d.redCard).map((d) => ({
      min: parseInt(String(d.clock?.displayValue || ""), 10) || null,
      name: d.athletesInvolved?.[0]?.displayName || "",
      team: String(d.team?.id) === String(h.team.id) ? "h" : "a",
      kind: d.redCard ? "red" : "yellow",
    })).filter((g) => g.name);
    return {
      id: "se" + e.id, slug: isAll ? null : slug, cards, venue: c.venue?.fullName || null, state, label, start: e.date, comp: nice(e), tv: tvOf(c, e),
      home: { name: h.team.displayName || h.team.name, crest: h.team.logo || null }, away: { name: a.team.displayName || a.team.name, crest: a.team.logo || null },
      h: state === "up" || state === "off" ? null : sc(h.score), a: state === "up" || state === "off" ? null : sc(a.score), goals,
    };
  }).filter(Boolean);
}
const parisDay = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
const dd = (a, date) => { const s = new Set(); return a.filter((m) => { if (s.has(m.id)) return false; if (!m.slug && m.state !== "live" && parisDay(m.start) !== date) return false; s.add(m.id); return true; }); };
const cachedEspnFoot = unstable_cache(
  async (date) => {
    const slugs = [...TOP_SLUGS.filter((k) => ESPN_LEAGUES[k]), "all"];
    const rs = await Promise.allSettled(slugs.map((s) => espnLeague(s, date)));
    if (rs.every((r) => r.status === "rejected")) throw new Error(rs[0].reason?.message || "erreur");
    return { items: dd(rs.flatMap((r) => (r.status === "fulfilled" ? r.value : [])), date).sort((x, y) => String(x.start).localeCompare(String(y.start))) };
  },
  ["livefoot-espn-v3"],
  { revalidate: 20 }
);
// Calendrier et résultats d'une date donnée (YYYY-MM-DD, heure de Paris) : toutes les compétitions ESPN, sans lien avec les cotes.
const cachedByDate = unstable_cache(
  async (date) => {
    const slugs = [...TOP_SLUGS.filter((k) => ESPN_LEAGUES[k]), "all"];
    const rs = await Promise.allSettled(slugs.map((s) => espnLeague(s, date)));
    const failed = rs.filter((r) => r.status === "rejected").length;
    if (failed === slugs.length) throw new Error(rs[0].reason?.message || "erreur");
    return { items: dd(rs.flatMap((r) => (r.status === "fulfilled" ? r.value : [])), date).sort((x, y) => String(x.start).localeCompare(String(y.start))), failed, total: slugs.length, at: Date.now() };
  },
  ["footdate-v3"],
  { revalidate: 300 }
);
// Une seule compétition pour une date (ex. prochaine journée de Ligue des champions), mise en cache 30 min.
const cachedLeagueDay = unstable_cache(async (slug, date) => ({ items: await espnLeague(slug, date) }), ["leagueday-v1"], { revalidate: 1800 });
export async function getLeagueDay(slug, date) {
  try { return await cachedLeagueDay(slug, date); } catch { return { items: [] }; }
}
export async function getFootByDate(date) {
  try {
    const d = await cachedByDate(date);
    const items = d.items; // journée ESPN (UTC) : l'heure affichée reste celle de Paris
    return { ...d, items, error: null };
  } catch (e) { return { items: [], failed: 0, total: 0, at: Date.now(), error: e.message }; }
}
export async function getFootEspn() {
  try { return { ...(await cachedEspnFoot(todayKey())), error: null }; }
  catch (e) { return { items: [], error: e.message }; }
}

// --- Diffusion (ESPN) et tennis (ESPN, sans clé) ---
function tvOf(c, e) {
  const names = [];
  for (const b of [...(c?.broadcasts || []), ...(e?.broadcasts || [])]) for (const n of b?.names || (b?.name ? [b.name] : [])) names.push(n);
  for (const g of c?.geoBroadcasts || []) { const n = g?.media?.shortName || g?.media?.name; if (n) names.push(n); }
  const u = names.filter((v, i, a) => v && a.indexOf(v) === i);
  return u.length ? "Diffusion (source ESPN) : " + u.slice(0, 4).join(", ") : null;
}

async function tennisTour(tour) {
  const j = await getJson("https://site.api.espn.com/apis/site/v2/sports/tennis/" + tour + "/scoreboard");
  const out = [];
  for (const ev of j.events || []) {
    const tName = ev.name || ev.shortName || tour.toUpperCase();
    const comps = ev.groupings?.length
      ? ev.groupings.filter((g) => !/double/i.test(String(g.grouping?.slug || "") + String(g.grouping?.displayName || ""))).flatMap((g) => g.competitions || [])
      : (ev.competitions || []);
    for (const c of comps) {
      if (/double/i.test(String(c.type?.text || "") + String(c.type?.slug || ""))) continue;
      const cs = (c.competitors || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
      if (cs.length < 2) continue;
      const [p1, p2] = cs;
      const n1 = p1.athlete?.displayName || p1.athlete?.fullName, n2 = p2.athlete?.displayName || p2.athlete?.fullName;
      if (!n1 || !n2 || /\//.test(n1 + n2)) continue;
      const t = c.status?.type || {};
      const state = t.state === "in" ? "live" : t.state === "post" ? "done" : /POSTPONED|CANCELED|SUSPENDED|ABANDONED|WALKOVER/.test(t.name || "") ? "off" : "up";
      const l1 = (p1.linescores || []).map((x) => Number(x.value)), l2 = (p2.linescores || []).map((x) => Number(x.value));
      const n = state === "up" || state === "off" ? 0 : Math.min(l1.length, l2.length);
      let w1 = 0, w2 = 0;
      for (let i = 0; i < n; i++) {
        if (state === "live" && i === n - 1) continue;
        if (l1[i] > l2[i]) w1++; else if (l2[i] > l1[i]) w2++;
      }
      const detail = n ? Array.from({ length: n }, (_, i) => l1[i] + "-" + l2[i]).join("   ") : null;
      out.push({
        id: "te" + (c.id || n1 + n2), state, label: state === "live" ? (n ? n + "e set" : "En cours") : state === "off" ? "Reporté" : "",
        start: c.date || c.startDate || ev.date, comp: tName, detail, tv: tvOf(c, ev),
        home: { name: n1, crest: p1.athlete?.flag?.href || null, win: !!p1.winner }, away: { name: n2, crest: p2.athlete?.flag?.href || null, win: !!p2.winner },
        h: state === "up" || state === "off" ? null : (n ? w1 : null), a: state === "up" || state === "off" ? null : (n ? w2 : null),
      });
    }
  }
  return out;
}
const cachedTennis = unstable_cache(
  async () => {
    const rs = await Promise.allSettled([tennisTour("atp"), tennisTour("wta")]);
    if (rs.every((r) => r.status === "rejected")) throw new Error(rs[0].reason?.message || "erreur");
    const all = rs.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    const near = all.filter((m) => m.state === "live" || Math.abs(new Date(m.start).getTime() - Date.now()) <= 20 * 3600 * 1000);
    return { items: near.sort((x, y) => String(x.start).localeCompare(String(y.start))) };
  },
  ["livetennis-v1"],
  { revalidate: 20 }
);
export async function getTennisLive() {
  try { return { ...(await cachedTennis()), error: null }; }
  catch (e) { return { items: [], error: e.message }; }
}
