// football-data.org : résultats réels (forme, classement) et scores en direct. Clé gratuite : FOOTBALL_DATA_KEY.
import { afOn, afGuard, afFail } from "./afguard.js";
import { unstable_cache } from "next/cache";
import { nameSim } from "./analysis.js";

const BASE = "https://api.football-data.org/v4";
export const hasFd = () => !!process.env.FOOTBALL_DATA_KEY;
// Compétitions couvertes par l'offre gratuite.
const COMPS = ["FL1", "PL", "PD", "SA", "BL1", "CL", "DED", "PPL"];
const DOMESTIC_LAST = ["CL"]; // la Ligue des champions est traitée en premier pour que le classement du championnat l'emporte

async function fd(path) {
  const res = await fetch(BASE + path, { headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY } });
  if (!res.ok) {
    const c = res.status;
    throw new Error(c === 401 || c === 403 ? `Clé football-data refusée (${c})` : c === 429 ? "Limite football-data atteinte (429)" : `Erreur football-data ${c}`);
  }
  return res.json();
}

// --- Forme (5 derniers résultats) et classement calculé à partir des matchs terminés de la saison ---
const formCached = unstable_cache(
  async () => {
    const ordered = [...COMPS.filter((c) => DOMESTIC_LAST.includes(c)), ...COMPS.filter((c) => !DOMESTIC_LAST.includes(c))];
    let failed = 0, last = null;
    const all = await Promise.all(ordered.map((c) => fd(`/competitions/${c}/matches?status=FINISHED`).then((d) => ({ c, d })).catch((e) => { failed++; last = e; return { c, d: { matches: [] } }; })));
    if (failed > COMPS.length / 2) throw last; // trop d'échecs (ex. limite atteinte) : on ne met pas ce résultat en cache
    const seen = new Set();
    const teams = new Map();
    const get = (t) => {
      if (!teams.has(t.id)) teams.set(t.id, { id: t.id, names: [t.name, t.shortName].filter(Boolean), results: [], standing: null });
      return teams.get(t.id);
    };
    for (const { c, d } of all) {
      const table = new Map();
      for (const m of d.matches || []) {
        const h = m.score?.fullTime?.home, a = m.score?.fullTime?.away;
        if (h == null || a == null) continue;
        const row = (t) => { if (!table.has(t.id)) table.set(t.id, { id: t.id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }); return table.get(t.id); };
        const H = row(m.homeTeam), A = row(m.awayTeam);
        H.p++; A.p++; H.gf += h; H.ga += a; A.gf += a; A.ga += h;
        if (h > a) { H.w++; H.pts += 3; A.l++; } else if (h < a) { A.w++; A.pts += 3; H.l++; } else { H.d++; A.d++; H.pts++; A.pts++; }
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        get(m.homeTeam).results.push({ date: m.utcDate, w: h > a ? "V" : h < a ? "D" : "N", gf: h, ga: a, home: true });
        get(m.awayTeam).results.push({ date: m.utcDate, w: a > h ? "V" : a < h ? "D" : "N", gf: a, ga: h, home: false });
      }
      const rows = [...table.values()].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
      rows.forEach((r, i) => { const t = teams.get(r.id); if (t) t.standing = { comp: c, pos: i + 1, of: rows.length, ...r }; });
    }
    return [...teams.values()].map((t) => { const s = t.results.sort((x, y) => y.date.localeCompare(x.date)); return { ...t, results: s.slice(0, 5), last10: s.slice(0, 10) }; });
  },
  ["fd-form-v3"],
  { revalidate: 6 * 3600 }
);

export async function getFormInfo() {
  if (!hasFd()) return { teams: [], error: null };
  try {
    return { teams: await formCached(), error: null };
  } catch (e) {
    return { teams: [], error: e.message };
  }
}

// --- Scores du jour (en direct, terminés, à venir) ---
const shape = (m) => ({
  id: m.id,
  comp: m.competition?.name,
  emblem: m.competition?.emblem,
  status: m.status,
  minute: m.minute ?? null,
  start: m.utcDate,
  home: { name: m.homeTeam.shortName || m.homeTeam.name, crest: m.homeTeam.crest },
  away: { name: m.awayTeam.shortName || m.awayTeam.name, crest: m.awayTeam.crest },
  h: m.score?.fullTime?.home ?? null,
  a: m.score?.fullTime?.away ?? null,
  ht: m.score?.halfTime ? `${m.score.halfTime.home ?? "-"}-${m.score.halfTime.away ?? "-"}` : null,
});

const liveCached = unstable_cache(
  async () => {
    const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    const q = `dateFrom=${day(-1)}&dateTo=${day(1)}`;
    // Un seul appel pour toutes les compétitions ; repli compétition par compétition si besoin.
    try {
      const d = await fd(`/matches?competitions=${COMPS.join(",")}&${q}`);
      return (d.matches || []).map(shape);
    } catch (e1) {
      let lastErr = e1;
      const res = await Promise.all(COMPS.map((c) => fd(`/competitions/${c}/matches?${q}`).catch((e) => { lastErr = e; return null; })));
      if (res.every((r) => r === null)) throw lastErr;
      return res.flatMap((r) => r?.matches || []).map(shape);
    }
  },
  ["fd-live-v4"],
  { revalidate: 20 }
);

// Buteurs d'un match (football-data.org, détail du match), mis en cache 45 s.
const goalsCached = unstable_cache(
  async (id) => {
    const d = await fd(`/matches/${id}`);
    return (d.goals || []).map((g) => ({ min: g.minute != null ? g.minute + (g.injuryTime ? "+" + g.injuryTime : "") : null, name: g.scorer?.name || null, team: g.team?.id === d.homeTeam?.id ? "h" : "a", type: g.type || "" })).filter((g) => g.name);
  },
  ["fd-goals-v1"],
  { revalidate: 45 }
);
export async function getGoals(id) { try { return await goalsCached(id); } catch { return []; } }

export async function getLive() {
  if (!hasFd()) return { matches: [], error: "no-key" };
  try {
    return { matches: await liveCached(), error: null, at: new Date().toISOString() };
  } catch (e) {
    return { matches: [], error: e.message };
  }
}

// --- Compositions (publiées environ 1 h avant le coup d'envoi ; absentes de certaines offres football-data) ---
const fixturesCached = unstable_cache(
  async () => {
    const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    const d = await fd(`/matches?competitions=${COMPS.join(",")}&dateFrom=${day(-1)}&dateTo=${day(2)}`);
    return (d.matches || []).map((x) => ({ id: x.id, start: x.utcDate, h: [x.homeTeam.name, x.homeTeam.shortName].filter(Boolean), a: [x.awayTeam.name, x.awayTeam.shortName].filter(Boolean) }));
  },
  ["fd-fixtures-v1"],
  { revalidate: 900 }
);

const detailCached = unstable_cache(
  async (id) => {
    const d = await fd(`/matches/${id}`);
    const side = (t) => ({
      formation: t?.formation || null,
      coach: t?.coach?.name || null,
      lineup: (t?.lineup || []).map((p) => ({ name: p.name, pos: p.position || "", num: p.shirtNumber ?? null })),
      bench: (t?.bench || []).map((p) => ({ name: p.name, pos: p.position || "", num: p.shirtNumber ?? null })),
    });
    return { home: side(d.homeTeam), away: side(d.awayTeam) };
  },
  ["fd-detail-v1"],
  { revalidate: 600 }
);

async function getLineupFd(m) {
  if (!hasFd() || m.sport !== "football") return null;
  const t0 = +new Date(m.start);
  if (Math.abs(t0 - Date.now()) > 30 * 3600e3) return null;
  try {
    const fx = await fixturesCached();
    const sim = (names, n) => Math.max(...names.map((x) => nameSim(x, n)));
    let best = null, bs = 0;
    for (const f of fx) {
      if (Math.abs(+new Date(f.start) - t0) > 4 * 3600e3) continue;
      const sc = Math.min(sim(f.h, m.home), sim(f.a, m.away));
      if (sc > bs) { bs = sc; best = f; }
    }
    if (!best || bs < 0.5) return null;
    const d = await detailCached(best.id);
    if (d.home.lineup.length < 9 || d.away.lineup.length < 9) return null;
    return d;
  } catch { return null; }
}

// --- Compositions via API-Football (clé API_FOOTBALL_KEY) : prioritaire quand elle est présente ---
const AF = "https://v3.football.api-sports.io";
async function af(path) {
  afGuard();
  const res = await fetch(AF + path, { headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY } });
  if (!res.ok) { afFail("HTTP " + res.status); throw new Error("API-Football " + res.status); }
  const j = await res.json();
  const err = j.errors && (Array.isArray(j.errors) ? j.errors[0] : Object.values(j.errors)[0]);
  if (err) { const msg = typeof err === "string" ? err : JSON.stringify(err); afFail(msg); throw new Error("API-Football : " + msg); }
  return j.response || [];
}
const afFixtures = unstable_cache(
  async (date) => (await af("/fixtures?date=" + date)).map((x) => ({ id: x.fixture.id, start: x.fixture.date, h: [x.teams.home.name], a: [x.teams.away.name] })),
  ["af-fixtures-v1"],
  { revalidate: 3600 }
);
const AF_POS = { G: "Goalkeeper", D: "Defender", M: "Midfielder", F: "Attacker" };
const afDetail = unstable_cache(
  async (id, homeName) => {
    const r = await af("/fixtures/lineups?fixture=" + id);
    const pl = (x) => ({ name: x.player.name, pos: AF_POS[x.player.pos] || "", num: x.player.number ?? null });
    const side = (t) => ({ formation: t?.formation || null, coach: t?.coach?.name || null, lineup: (t?.startXI || []).map(pl), bench: (t?.substitutes || []).map(pl) });
    const h = r.find((t) => t.team?.name === homeName) || r[0];
    const o = r.find((t) => t !== h);
    return { home: side(h), away: side(o) };
  },
  ["af-detail-v1"],
  { revalidate: 600 }
);

export async function getLineup(m) {
  if (m.sport !== "football") return null;
  const t0 = +new Date(m.start);
  if (Math.abs(t0 - Date.now()) > 30 * 3600e3) return null;
  if (afOn()) {
    try {
      const fx = await afFixtures(new Date(t0).toISOString().slice(0, 10));
      const sim = (names, n) => Math.max(...names.map((x) => nameSim(x, n)));
      let best = null, bs = 0;
      for (const f of fx) {
        if (Math.abs(+new Date(f.start) - t0) > 4 * 3600e3) continue;
        const sc = Math.min(sim(f.h, m.home), sim(f.a, m.away));
        if (sc > bs) { bs = sc; best = f; }
      }
      if (best && bs >= 0.5) {
        const d = await afDetail(best.id, best.h[0]);
        if (d.home.lineup.length >= 9 && d.away.lineup.length >= 9) return d;
      }
    } catch (e) { afFail(e.message); if (afOn()) console.error("[lineup]", e.message); }
  }
  return getLineupFd(m);
}

// --- Confrontations directes (football-data.org), 12 h de cache ---
const h2hCached = unstable_cache(
  async (a, b) => {
    const d = await fd("/teams/" + a + "/matches?status=FINISHED&limit=100");
    return (d.matches || []).filter((m) => (m.homeTeam?.id === b || m.awayTeam?.id === b) && m.score?.fullTime?.home != null)
      .map((m) => ({ date: m.utcDate, comp: m.competition?.name, home: m.homeTeam.shortName || m.homeTeam.name, away: m.awayTeam.shortName || m.awayTeam.name, hid: m.homeTeam.id, h: m.score.fullTime.home, a: m.score.fullTime.away }))
      .sort((x, y) => y.date.localeCompare(x.date)).slice(0, 10);
  },
  ["fd-h2h-v1"],
  { revalidate: 12 * 3600 }
);
export async function getH2H(a, b) {
  if (!hasFd() || !a || !b) return [];
  try { return await h2hCached(a, b); } catch { return []; }
}

// --- Buteurs en forme : classements des buteurs (football-data.org, saison en cours) ---
const SC_COMPS = { FL1: "Ligue 1", PL: "Premier League", PD: "LaLiga", SA: "Serie A", BL1: "Bundesliga", CL: "Ligue des champions", DED: "Eredivisie", PPL: "Liga Portugal" };
export const SCORER_COMPS = SC_COMPS;
const scorersCached = unstable_cache(
  async () => {
    let failed = 0, last = null;
    const rs = await Promise.all(Object.keys(SC_COMPS).map((c) => fd(`/competitions/${c}/scorers?limit=30`).then((d) => ({ c, d })).catch((e) => { failed++; last = e; return { c, d: { scorers: [] } }; })));
    if (failed > 4) throw last;
    const out = [];
    for (const { c, d } of rs) for (const s of d.scorers || []) {
      const played = s.playedMatches || null, goals = s.goals || 0;
      out.push({
        id: s.player?.id, name: s.player?.name, team: s.team?.name, teamShort: s.team?.shortName, teamId: s.team?.id, crest: s.team?.crest || null,
        comp: c, compName: SC_COMPS[c], goals, assists: s.assists ?? null, pens: s.penalties ?? null, played,
        perMatch: played ? goals / played : null, pos: s.player?.section || null,
      });
    }
    return out;
  },
  ["fd-scorers-v1"],
  { revalidate: 6 * 3600 }
);
export async function getTopScorers() {
  if (!hasFd()) return { scorers: [], error: "Clé football-data absente" };
  try { return { scorers: await scorersCached(), error: null }; }
  catch (e) { return { scorers: [], error: e.message }; }
}
