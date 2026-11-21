import { oddsKeys } from "./odds.js";
// Résultats officiels des matchs (ESPN, sans clé) pour régler automatiquement les pronostics ; repli sur The Odds API (scores) pour quelques cas.
import { espnJson } from "./espnfetch.js";
import { ESPN_LEAGUES } from "@/lib/livex";
import { nameSim } from "@/lib/analysis";
import { canon } from "@/lib/fr";

const BASE = "https://site.api.espn.com/apis/site/v2/sports/";
const SOCCER = [...Object.keys(ESPN_LEAGUES), "fra.1", "eng.1", "esp.1", "ger.1", "ita.1"].filter((v, i, a) => a.indexOf(v) === i);
const OTHER = {
  basketball: ["basketball/nba", "basketball/wnba", "basketball/mens-college-basketball"],
  hockey: ["hockey/nhl", "hockey/mens-college-hockey"],
  americanfootball: ["football/nfl", "football/college-football"],
  baseball: ["baseball/mlb"],
};
const num = (x) => (x === "" || x == null || !Number.isFinite(Number(x)) ? null : Number(x));
const ymd = (t) => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");

async function getJson(url) {
  return espnJson(url, { timeout: 7000 });
}
async function pool(tasks, n = 16) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < tasks.length) { const k = i++; try { out[k] = await tasks[k](); } catch { out[k] = null; } } }));
  return out;
}

function evGame(e, sport) {
  const c = e.competitions?.[0];
  const cs = c?.competitors || [];
  const h = cs.find((x) => x.homeAway === "home"), a = cs.find((x) => x.homeAway === "away");
  if (!h?.team || !a?.team) return null;
  const t = e.status?.type || {};
  const txt = [t.name, t.detail, t.description, t.shortDetail].join(" ");
  const scorers = (c.details || []).filter((d) => d.scoringPlay || /goal/i.test(d.type?.text || "")).filter((d) => !/own/i.test(d.type?.text || "")).map((d) => d.athletesInvolved?.[0]?.displayName).filter(Boolean);
  return {
    sport, start: e.date, final: t.state === "post" && !/POSTPONED|CANCELED|SUSPENDED|ABANDONED/.test(t.name || ""),
    home: h.team.displayName || h.team.name, away: a.team.displayName || a.team.name,
    hs: num(h.score), as: num(a.score), aet: /AET|PEN|EXTRA|SHOOTOUT|AFTER/i.test(txt), scorers: sport === "football" ? (c.details ? scorers : null) : null,
  };
}

async function scoreboard(path, date, sport) {
  const j = await getJson(BASE + path + "/scoreboard?dates=" + date);
  return (j.events || []).map((e) => evGame(e, sport)).filter(Boolean);
}

async function tennisDay(tour, date) {
  const j = await getJson(BASE + "tennis/" + tour + "/scoreboard?dates=" + date);
  const out = [];
  for (const ev of j.events || []) {
    const comps = ev.groupings?.length
      ? ev.groupings.filter((g) => !/double/i.test(String(g.grouping?.slug || "") + String(g.grouping?.displayName || ""))).flatMap((g) => g.competitions || [])
      : ev.competitions || [];
    for (const c of comps) {
      if (/double/i.test(String(c.type?.text || "") + String(c.type?.slug || ""))) continue;
      const cs = (c.competitors || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
      if (cs.length < 2) continue;
      const [p1, p2] = cs;
      const n1 = p1.athlete?.displayName || p1.athlete?.fullName, n2 = p2.athlete?.displayName || p2.athlete?.fullName;
      if (!n1 || !n2 || /\//.test(n1 + n2)) continue;
      const t = c.status?.type || {};
      const txt = [t.name, t.detail, t.description].join(" ");
      const l1 = (p1.linescores || []).map((x) => Number(x.value)), l2 = (p2.linescores || []).map((x) => Number(x.value));
      const n = Math.min(l1.length, l2.length);
      const sets = Array.from({ length: n }, (_, i) => ({ h: l1[i], a: l2[i] })).filter((s) => Number.isFinite(s.h) && Number.isFinite(s.a));
      let w1 = 0, w2 = 0;
      for (const s of sets) { if (s.h > s.a) w1++; else if (s.a > s.h) w2++; }
      const win1 = !!p1.winner, win2 = !!p2.winner;
      out.push({
        sport: "tennis", start: c.date || c.startDate || ev.date, final: t.state === "post" && (win1 || win2 || /WALKOVER/i.test(txt)),
        home: n1, away: n2, hs: win1 && w1 <= w2 ? w2 + 1 : w1, as: win2 && w2 <= w1 ? w1 + 1 : w2, sets,
        winner: win1 ? "home" : win2 ? "away" : null, walkover: /WALKOVER/i.test(txt), retired: /RETIRED|RETIREMENT|DEFAULT/i.test(txt),
      });
    }
  }
  return out;
}

export async function fetchGames(recs) {
  const need = {};
  for (const r of recs) {
    const t = +new Date(r.start);
    const dates = new Set([ymd(t - 12 * 3600e3), ymd(t), ymd(t + 12 * 3600e3)]);
    need[r.sport] = need[r.sport] || new Set();
    dates.forEach((d) => need[r.sport].add(d));
  }
  const tasks = [];
  for (const [sport, dates] of Object.entries(need)) {
    for (const d of dates) {
      if (sport === "football") for (const s of SOCCER) tasks.push(() => scoreboard("soccer/" + s, d, "football"));
      else if (sport === "tennis") for (const tour of ["atp", "wta"]) tasks.push(() => tennisDay(tour, d));
      else for (const p of OTHER[sport] || []) tasks.push(() => scoreboard(p, d, sport));
    }
  }
  const res = await pool(tasks);
  const seen = new Set(), out = [];
  for (const g of res.flat().filter(Boolean)) { const k = g.sport + g.home + g.away + g.start; if (!seen.has(k)) { seen.add(k); out.push(g); } }
  return out;
}

const norm = (x) => String(canon(x) || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const sim = (a, b) => { const na = norm(a), nb = norm(b); const loose = na.length >= 3 && nb.length >= 3 && (na.includes(nb) || nb.includes(na)) ? 0.8 : 0; return Math.max(nameSim(a, b), loose); };

export function findGame(rec, games) {
  const t = +new Date(rec.start);
  let best = null, bs = 0;
  for (const g of games) {
    if (g.sport !== rec.sport) continue;
    const dt = Math.abs(+new Date(g.start) - t);
    if (dt > 30 * 3600e3) continue;
    for (const swap of rec.sport === "tennis" ? [false, true] : [false]) {
      const sh = sim(rec.home, swap ? g.away : g.home), sa = sim(rec.away, swap ? g.home : g.away);
      const near = dt <= 45 * 60 * 1000;
      const s = Math.min(sh, sa) >= 0.45 ? Math.min(sh, sa) : near && Math.max(sh, sa) >= 0.5 && Math.min(sh, sa) >= 0.2 ? 0.45 : 0;
      if (s > bs) { bs = s; best = { g, swap }; }
    }
  }
  if (!best || bs < 0.45) return null;
  const { g, swap } = best;
  if (!swap) return g;
  return { ...g, home: g.away, away: g.home, hs: g.as, as: g.hs, sets: g.sets?.map((s) => ({ h: s.a, a: s.h })), winner: g.winner === "home" ? "away" : g.winner === "away" ? "home" : null };
}

// Repli : scores The Odds API (2 crédits par sport, limité à quelques appels par exécution).
export async function oddsScores(sk) {
  for (const key of oddsKeys()) {
    try {
      const r = await fetch(`https://api.the-odds-api.com/v4/sports/${sk}/scores/?daysFrom=3&apiKey=${key}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const j = await r.json();
      return Object.fromEntries((j || []).filter((e) => e.completed && e.scores).map((e) => {
        const hs = num(e.scores.find((s) => s.name === e.home_team)?.score), as = num(e.scores.find((s) => s.name === e.away_team)?.score);
        return [e.id, { hs, as, final: true, aet: false, sets: null, scorers: null }];
      }));
    } catch {}
  }
  return {};
}
