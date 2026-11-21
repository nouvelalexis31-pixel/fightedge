// Données réelles : The Odds API (cotes Betclic, Winamax, Unibet + consensus du marché).
import { loadExtras } from "./extras.js";
import { endOfDay } from "./format.js";
import { saveSnapshot, latestSnapshot } from "./store.js";
import { loadPapi, papiOn } from "./oddspapi.js";
const BASE = "https://api.the-odds-api.com/v4";
export const FR = { betclic_fr: "Betclic", winamax_fr: "Winamax", unibet_fr: "Unibet", pmu_fr: "PMU" };
export const FR_KEYS = Object.keys(FR);

export const SPORTS = {
  football: { label: "Football", icon: "⚽", groups: ["Soccer"], unit: "buts" },
  tennis: { label: "Tennis", icon: "🎾", groups: ["Tennis"], unit: "jeux" },
  basketball: { label: "Basket", icon: "🏀", groups: ["Basketball"], unit: "points" },
  hockey: { label: "Hockey", icon: "🏒", groups: ["Ice Hockey"], unit: "buts" },
  americanfootball: { label: "Foot US", icon: "🏈", groups: ["American Football"], unit: "points" },
  rugby: { label: "Rugby", icon: "🏉", groups: ["Rugby Union", "Rugby League"], unit: "points" },
  baseball: { label: "Baseball", icon: "⚾", groups: ["Baseball"], unit: "points" },
  mma: { label: "MMA / UFC", icon: "🥋", groups: ["Mixed Martial Arts"], unit: "rounds" },
  boxing: { label: "Boxe", icon: "🥊", groups: ["Boxing"], unit: "rounds" },
};

// Ordre de priorité des compétitions (les autres suivent, par ordre alphabétique).
const PRIORITY = [
  "soccer_france_ligue_one", "soccer_epl", "soccer_spain_la_liga", "soccer_italy_serie_a", "soccer_germany_bundesliga",
  "soccer_uefa_champs_league", "soccer_uefa_europa_league", "soccer_uefa_europa_conf_league", "soccer_france_ligue_two",
  "soccer_efl_champ", "soccer_netherlands_eredivisie", "soccer_portugal_primeira_liga", "soccer_belgium_first_div",
  "soccer_turkey_super_league", "soccer_spain_segunda_division", "soccer_italy_serie_b", "soccer_germany_bundesliga2",
  "soccer_spl", "soccer_brazil_campeonato", "soccer_argentina_primera_division", "soccer_usa_mls", "soccer_mexico_ligamx",
  "basketball_nba", "basketball_euroleague", "icehockey_nhl", "americanfootball_nfl", "mma_mixed_martial_arts", "boxing_boxing",
];
const sportOfGroup = (g) => Object.entries(SPORTS).find(([, d]) => d.groups.includes(g))?.[0] || null;

const hours = () => Math.max(1, Number(process.env.ODDS_REFRESH_HOURS) || 6);
const maxSports = () => Math.max(1, Number(process.env.ODDS_MAX_SPORTS) || 30);
const windowH = () => Math.max(6, Number(process.env.ODDS_WINDOW_HOURS) || 48);

// Plusieurs clés gratuites possibles (ODDS_API_KEY, ODDS_API_KEY_2 … _5) : on utilise d'abord celle qui a le plus de crédits.
export const oddsKeys = () => [process.env.ODDS_API_KEY, ...[2, 3, 4, 5].map((i) => process.env["ODDS_API_KEY_" + i])].filter(Boolean);
async function api(path) {
  const keys = oddsKeys();
  if (globalThis.__kOrder?.length) keys.sort((a, b) => globalThis.__kOrder.indexOf(a) - globalThis.__kOrder.indexOf(b));
  const sep = path.includes("?") ? "&" : "?";
  let res;
  for (const key of keys) {
    for (let i = 0; i < 5; i++) {
      res = await fetch(`${BASE}${path}${sep}apiKey=${key}`, { next: { revalidate: hours() * 3600 } });
      if (res.status !== 429) break;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1) + Math.random() * 1000));
    }
    if (res.status !== 401 && res.status !== 429) break;
  }
  if (!res.ok) {
    const code = res.status;
    const e = new Error(code === 401 ? "Clé API refusée (401)" : code === 429 ? "Quota de l'API atteint (429)" : `Erreur API ${code}`);
    e.status = code;
    throw e;
  }
  const rem = Number(res.headers.get("x-requests-remaining"));
  return { data: await res.json(), remaining: Number.isFinite(rem) ? rem : null };
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
// Bookmakers « sharp » (marges faibles, cotes les plus justes) : leur avis pèse 3 fois plus dans le consensus.
const SHARP = new Set(["pinnacle", "betfair_ex_eu", "betfair_ex_uk", "betfair_ex_au", "matchbook", "smarkets", "betonlineag", "lowvig"]);
const wOf = (key) => (SHARP.has(key) ? 3 : 1);
const wmean = (a, w) => { let s = 0, t = 0; a.forEach((x, i) => { s += x * (w[i] ?? 1); t += w[i] ?? 1; }); return s / t; };
// Retrait de la marge par la méthode « puissance » : corrige le biais favori / outsider (les bookmakers
// gonflent surtout la marge sur les grosses cotes), plus juste que la simple normalisation proportionnelle.
export function devig(prices) {
  const inv = prices.map((p) => 1 / p), s = inv.reduce((a, b) => a + b, 0);
  if (!(s > 1)) return inv.map((x) => x / s);
  let lo = 1, hi = 4;
  for (let i = 0; i < 50; i++) { const k = (lo + hi) / 2; if (inv.reduce((a, x) => a + Math.pow(x, k), 0) > 1) lo = k; else hi = k; }
  const out = inv.map((x) => Math.pow(x, (lo + hi) / 2)), t = out.reduce((a, b) => a + b, 0);
  return out.map((x) => x / t);
}
const sdOf = (a, m) => (a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length) : null);
const bestOf = (odds) => {
  let best = null;
  for (const [bk, p] of Object.entries(odds)) if (!best || p > best.odds) best = { book: bk, odds: p };
  return best;
};

export function buildMatch(ev, sportId) {
  const books = ev.bookmakers || [];
  const mk = (b, key) => b.markets?.find((m) => m.key === key)?.outcomes;

  // ---- Vainqueur (h2h) : consensus sans marge des bookmakers hors France ----
  const names = [ev.home_team, ev.away_team, "Draw"].filter((n, i) => i < 2 || books.some((b) => mk(b, "h2h")?.some((o) => o.name === "Draw")));
  const arr = Object.fromEntries(names.map((n) => [n, []]));
  const ws = [];
  let nBooks = 0;
  for (const b of books) {
    if (FR[b.key]) continue;
    const o = mk(b, "h2h");
    if (!o || names.some((n) => !(o.find((x) => x.name === n)?.price > 1))) continue;
    const fair = devig(names.map((n) => o.find((x) => x.name === n).price));
    names.forEach((n, i) => arr[n].push(fair[i]));
    ws.push(wOf(b.key));
    nBooks++;
  }
  const outcomes = names.map((n) => {
    const odds = {};
    for (const b of books) {
      if (!FR[b.key]) continue;
      const p = mk(b, "h2h")?.find((x) => x.name === n)?.price;
      if (p > 1) odds[FR[b.key]] = p;
    }
    const best = bestOf(odds);
    const prob = nBooks >= (ev.minBooks || 3) ? wmean(arr[n], ws) : null;
    return { name: n === "Draw" ? "Match nul" : n, odds, best, prob, ev: prob && best ? prob * best.odds - 1 : null, sd: prob ? sdOf(arr[n], prob) : null };
  });

  // ---- Total (plus / moins de X buts, jeux, points) ----
  const pts = new Map();
  for (const b of books) {
    const o = mk(b, "totals");
    if (!o) continue;
    const byPoint = new Map();
    for (const x of o) {
      if (typeof x.point !== "number" || !(x.price > 1)) continue;
      const e = byPoint.get(x.point) || {};
      e[x.name] = x.price;
      byPoint.set(x.point, e);
    }
    for (const [pt, e] of byPoint) {
      if (!e.Over || !e.Under) continue;
      const rec = pts.get(pt) || { fr: {}, others: [] };
      if (FR[b.key]) rec.fr[FR[b.key]] = e;
      else rec.others.push({ ...e, w: wOf(b.key) });
      pts.set(pt, rec);
    }
  }
  let totals = [];
  for (const [point, rec] of pts) {
    if (rec.others.length < (ev.minBooks || 3) || !Object.keys(rec.fr).length) continue;
    const po = rec.others.map((e) => devig([e.Over, e.Under])[0]);
    const pOver = wmean(po, rec.others.map((e) => e.w));
    const side = (nm, p, ps) => {
      const odds = {};
      for (const [bk, e] of Object.entries(rec.fr)) odds[bk] = e[nm];
      const best = bestOf(odds);
      return { odds, best, prob: p, ev: best ? p * best.odds - 1 : null, sd: sdOf(ps, p) };
    };
    totals.push({ point, nBooks: rec.others.length, over: side("Over", pOver, po), under: side("Under", 1 - pOver, po.map((x) => 1 - x)) });
  }
  totals = totals.sort((a, b) => Math.abs(a.over.prob - 0.5) - Math.abs(b.over.prob - 0.5)).slice(0, 4).sort((a, b) => a.point - b.point);

  // ---- Handicap (lignes en .5 uniquement : pas de remboursement possible) ----
  const spm = new Map();
  for (const b of books) {
    const o = mk(b, "spreads");
    if (!o) continue;
    const h = o.find((x) => x.name === ev.home_team && typeof x.point === "number" && x.price > 1);
    const a = o.find((x) => x.name === ev.away_team && typeof x.point === "number" && x.price > 1);
    if (!h || !a || Math.abs(h.point + a.point) > 1e-9 || Math.abs(h.point * 2) % 2 !== 1) continue;
    const rec = spm.get(h.point) || { fr: {}, others: [] };
    const e = { home: h.price, away: a.price };
    if (FR[b.key]) rec.fr[FR[b.key]] = e; else rec.others.push({ ...e, w: wOf(b.key) });
    spm.set(h.point, rec);
  }
  let spreads = [];
  for (const [point, rec] of spm) {
    if (rec.others.length < (ev.minBooks || 3) || !Object.keys(rec.fr).length) continue;
    const po = rec.others.map((e) => devig([e.home, e.away])[0]);
    const pHome = wmean(po, rec.others.map((e) => e.w));
    const side = (nm, p, ps) => {
      const odds = {};
      for (const [bk, e] of Object.entries(rec.fr)) odds[bk] = e[nm];
      const best = bestOf(odds);
      return { odds, best, prob: p, ev: best ? p * best.odds - 1 : null, sd: sdOf(ps, p) };
    };
    spreads.push({ point, nBooks: rec.others.length, home: side("home", pHome, po), away: side("away", 1 - pHome, po.map((x) => 1 - x)) });
  }
  spreads = spreads.sort((a, b) => Math.abs(a.home.prob - 0.5) - Math.abs(b.home.prob - 0.5)).slice(0, 3).sort((a, b) => a.point - b.point);

  if (!outcomes.some((o) => o.best) && !totals.length && !spreads.length) return null;
  return {
    id: ev.id, sk: ev.sport_key, sport: sportId, league: ev.sport_title, start: ev.commence_time, home: ev.home_team, away: ev.away_team,
    outcomes, nBooks, minBooks: ev.minBooks || 3, totals, spreads, frBooks: [...new Set(outcomes.flatMap((o) => Object.keys(o.odds)))],
  };
}

// Marchés demandés : chaque marché coûte 1 crédit par appel.
const FULL = (id) => (id === "mma" || id === "boxing" ? ["h2h"] : ["h2h", "totals", "spreads"]);

const prio = (k) => { const i = PRIORITY.indexOf(k); if (i !== -1) return i; return /nations_league|qualif|world_cup|euro|friendl|international|libertadores|sudamericana|copa|cup/.test(k) ? 5.5 : 1000; };

async function loadFresh() {
  if (!process.env.ODDS_API_KEY) return { error: "no-key", matches: [] };
  try {
    // Crédits restants de chaque clé (la liste des sports ne coûte rien) : la plus fournie passe en premier.
    const probes = await Promise.all(oddsKeys().map(async (k) => {
      try { const r = await fetch(BASE + "/sports?apiKey=" + k, { next: { revalidate: 300 } }); const n = Number(r.headers.get("x-requests-remaining")); return { k, ok: r.ok, n: r.ok && Number.isFinite(n) ? n : r.ok ? Infinity : -1 }; }
      catch { return { k, ok: false, n: -1 }; }
    }));
    globalThis.__kOrder = probes.sort((a, b) => b.n - a.n).map((x) => x.k);
    const first = await api("/sports");
    let credits = first.remaining;
    const best = probes[0]?.n;
    if (best != null && best >= 0 && best !== Infinity) credits = credits == null ? best : Math.max(credits, best);
    if (credits != null && credits < 16) return { error: "Quota de l'API atteint : plus de crédits pour les cotes (ils reviennent au début du mois).", matches: [], credits };
    const active = first.data.filter((s) => s.active && !s.has_outrights);
    let jobs = active
      .map((s) => ({ id: sportOfGroup(s.group), key: s.key, title: s.title }))
      .filter((j) => j.id)
      .sort((a, b) => Object.keys(SPORTS).indexOf(a.id) - Object.keys(SPORTS).indexOf(b.id) || prio(a.key) - prio(b.key) || a.key.localeCompare(b.key));

    // Les événements ne coûtent aucun crédit : on ne demande les cotes qu'aux compétitions qui jouent bientôt.
    const now = Date.now(), limit = now + windowH() * 3600e3;
    const playing = await Promise.all(jobs.map(async (j) => {
      try {
        const ev = (await api(`/sports/${j.key}/events?dateFormat=iso`)).data;
        return ev.some((e) => { const t = +new Date(e.commence_time); return t > now && t <= limit; });
      } catch { return true; }
    }));
    jobs = jobs.filter((_, i) => playing[i]);
    // Priorité aux sports "à partir de" : intercaler pour ne pas laisser un sport sans compétition si on coupe.
    const byPrio = [...jobs].sort((a, b) => prio(a.key) - prio(b.key) || Object.keys(SPORTS).indexOf(a.id) - Object.keys(SPORTS).indexOf(b.id));
    const cut = byPrio.slice(0, maxSports());

    // Budget : on réduit les marchés quand les crédits restants sont bas.
    let budget = credits == null ? Infinity : Math.max(0, credits - 15);
    const plan = [];
    for (const j of cut) {
      const full = FULL(j.id);
      const opts = [full, full.slice(0, 2), ["h2h"]].filter((m, i, arr) => arr.findIndex((x) => x.length === m.length) === i);
      const pick = opts.find((m) => m.length <= budget);
      if (!pick) continue;
      budget -= pick.length;
      plan.push({ ...j, markets: pick });
    }

    const fetchOdds = async (j) => {
      const q = (m) => `/sports/${j.key}/odds?regions=eu&markets=${m.join(",")}&oddsFormat=decimal&dateFormat=iso`;
      let r;
      try { r = await api(q(j.markets)); }
      catch (e) {
        if (e.status !== 422) throw e;
        try { r = await api(q(j.markets.slice(0, 2))); } catch (e2) { if (e2.status === 422) r = await api(q(["h2h"])); else throw e2; }
      }
      if (r.remaining != null) credits = credits == null ? r.remaining : Math.min(credits, r.remaining);
      return r.data.map((e) => { const x = buildMatch(e, j.id); if (x) x.key = j.key; return x; });
    };
    const results = await Promise.allSettled(plan.map(fetchOdds));
    const matches = results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).filter((m) => m && new Date(m.start).getTime() > now).sort((a, b) => a.start.localeCompare(b.start));
    let extra = null, all = matches;
    try {
      const ex = await loadExtras(matches, { api, FR, credits, prio, endOfDay, now });
      all = ex.matches; extra = ex.stats;
      if (ex.stats.credits != null) credits = credits == null ? ex.stats.credits : Math.min(credits, ex.stats.credits);
    } catch (e) { extra = { errors: [e.message] }; }
    const failed = results.filter((r) => r.status === "rejected").map((r) => r.reason?.message);
    const error = matches.length === 0 && failed.length ? failed[0] : null;
    return { matches: all, extra, error, credits, skipped: jobs.length - plan.length, competitions: plan.length, fetchedAt: new Date().toISOString() };
  } catch (e) {
    return { error: e.message, matches: [] };
  }
}

// Source de secours (OddsPapi) : au plus un rafraîchissement par jour, le résultat est conservé comme relevé.
const DAY = 20 * 3600e3;
async function viaPapi(snap) {
  if (!papiOn()) return null;
  const age = snap?.source === "oddspapi" && snap?.fetchedAt ? Date.now() - +new Date(snap.fetchedAt) : Infinity;
  const ms = (snap?.matches || []).filter((m) => new Date(m.start).getTime() > Date.now());
  const complete = snap?.source === "oddspapi" && snap.papiV === 2 && !snap.partial;
  const due = snap?.papiV !== 2 ? true : !complete ? age > 3 * 3600e3 : age > 28 * 3600e3;
  // À l'affichage d'une page on ne lit que le relevé enregistré ; seul le cron (ou la route de rafraîchissement) interroge OddsPapi.
  if (!globalThis.__papiAllow || !due) return snap?.source === "oddspapi" && ms.length ? { ...snap, matches: ms } : null;
  if (globalThis.__papiLock && Date.now() - globalThis.__papiLock < 20 * 60e3) return snap?.source === "oddspapi" && ms.length ? { ...snap, matches: ms } : null;
  globalThis.__papiLock = Date.now();
  try {
    const r = await loadPapi();
    const matches = r.events.map((e) => { const m = buildMatch(e, "football"); if (m) { m.key = e.key; } return m; }).filter(Boolean).sort((a, b) => a.start.localeCompare(b.start));
    if (!matches.length) return snap?.source === "oddspapi" && ms.length ? { ...snap, matches: ms } : null;
    const fmt = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Europe/Paris" });
    const span = r.min ? `dernières mises à jour des cotes entre le ${fmt(r.min)} et le ${fmt(r.max)}` : "dates de mise à jour inconnues";
    const d = { matches, source: "oddspapi", papiV: 2, partial: r.errors.length > 0, fetchedAt: new Date().toISOString(), error: null, credits: null, competitions: new Set(matches.map((m) => m.key)).size, papiSpan: span, papiErrors: r.errors };
    await saveSnapshot(d, true).catch(() => {});
    return d;
  } catch { return snap?.source === "oddspapi" && ms.length ? { ...snap, matches: ms } : null; }
}

// Cotes en direct de la source ; si elle est indisponible (quota, panne), on utilise OddsPapi (Winamax), puis le dernier relevé valide, clairement signalé.
export async function loadAll() {
  const d = await loadFresh();
  if (d.matches?.length) { saveSnapshot(d).catch(() => {}); return d; }
  const snap = await latestSnapshot();
  const p = await viaPapi(snap);
  if (p?.matches?.length) return { ...p, stale: true, staleReason: `quota de la source principale atteint ; cotes Winamax relevées via OddsPapi (${p.papiSpan}). Le marché de référence est Pinnacle`, error: null };
  const now = Date.now();
  const ms = (snap?.matches || []).filter((m) => new Date(m.start).getTime() > now);
  if (ms.length) return { ...snap, matches: ms, stale: true, staleReason: d.error || "source indisponible", error: null };
  return d;
}
