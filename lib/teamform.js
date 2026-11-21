// Historique réel d'une équipe (ESPN, sans clé) : derniers matchs toutes compétitions, statistiques domicile / extérieur,
// séries en cours. Sert aux fiches « façon Flashscore » et au modèle de buts FightEdge (lib/edge.js).
import { espnJson } from "./espnfetch.js";
import { unstable_cache } from "next/cache";

const arr = (x) => (Array.isArray(x) ? x : []);
const num = (x) => { if (x && typeof x === "object") x = x.value ?? x.displayValue; const n = Number(x); return x == null || x === "" || !Number.isFinite(n) ? null : n; };

async function raw(tid) {
  return espnJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${encodeURIComponent(tid)}/schedule`);
}
const cached = unstable_cache(async (tid) => raw(tid), ["teamform-raw-v1"], { revalidate: 3 * 3600 });

export function parseGames(j, tid) {
  const out = [];
  for (const ev of arr(j?.events)) {
    const c = arr(ev.competitions)[0];
    if (!c || c.status?.type?.state !== "post") continue;
    const cs = arr(c.competitors);
    const me = cs.find((x) => String(x.team?.id ?? x.id) === String(tid)), op = cs.find((x) => String(x.team?.id ?? x.id) !== String(tid));
    if (!me || !op) continue;
    const gf = num(me.score), ga = num(op.score);
    if (gf == null || ga == null) continue;
    out.push({
      id: String(ev.id), date: ev.date || c.date, home: me.homeAway === "home", opp: op.team?.displayName || op.team?.name || "?", oppId: String(op.team?.id ?? ""),
      oppLogo: op.team?.logos?.[0]?.href || op.team?.logo || null, gf, ga, res: gf > ga ? "V" : gf < ga ? "D" : "N",
      comp: ev.league?.abbreviation || ev.seasonType?.abbreviation || ev.season?.displayName || "",
    });
  }
  // du plus récent au plus ancien, sans doublon
  const seen = new Set();
  return out.filter((g) => (seen.has(g.id) ? false : seen.add(g.id))).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export async function getTeamGames(tid) {
  if (!tid) return [];
  try { return parseGames(await cached(String(tid)), tid).slice(0, 25); } catch { return []; }
}

function split(games) {
  const n = games.length;
  if (!n) return null;
  const c = (f) => games.filter(f).length;
  const w = c((g) => g.res === "V"), d = c((g) => g.res === "N"), l = c((g) => g.res === "D");
  const gf = games.reduce((s, g) => s + g.gf, 0), ga = games.reduce((s, g) => s + g.ga, 0);
  return {
    n, w, d, l, gf, ga, pts: 3 * w + d, ppg: (3 * w + d) / n, gfpm: gf / n, gapm: ga / n, tpm: (gf + ga) / n,
    o15: c((g) => g.gf + g.ga >= 2) / n, o25: c((g) => g.gf + g.ga >= 3) / n, o35: c((g) => g.gf + g.ga >= 4) / n,
    btts: c((g) => g.gf > 0 && g.ga > 0) / n, cs: c((g) => g.ga === 0) / n, fts: c((g) => g.gf === 0) / n,
  };
}

// Séries en cours (à partir du match le plus récent).
function streaks(games) {
  const run = (f) => { let k = 0; for (const g of games) { if (!f(g)) break; k++; } return k; };
  const L = [
    ["Victoires d'affilée", run((g) => g.res === "V"), "good"],
    ["Matchs sans défaite", run((g) => g.res !== "D"), "good"],
    ["Défaites d'affilée", run((g) => g.res === "D"), "bad"],
    ["Matchs sans victoire", run((g) => g.res !== "V"), "bad"],
    ["Matchs en marquant", run((g) => g.gf > 0), "good"],
    ["Matchs sans marquer", run((g) => g.gf === 0), "bad"],
    ["Matchs sans encaisser", run((g) => g.ga === 0), "good"],
    ["Matchs en encaissant", run((g) => g.ga > 0), "bad"],
    ["Matchs à plus de 2,5 buts", run((g) => g.gf + g.ga >= 3), "neutral"],
    ["Matchs à moins de 2,5 buts", run((g) => g.gf + g.ga <= 2), "neutral"],
    ["Les deux équipes marquent", run((g) => g.gf > 0 && g.ga > 0), "neutral"],
  ];
  return L.map(([label, n, tone]) => ({ label, n, tone })).filter((s) => s.n >= 3).sort((a, b) => b.n - a.n);
}

export function teamStats(games) {
  if (!games?.length) return null;
  const last10 = games.slice(0, 10);
  return {
    games, last10, n: games.length,
    all: split(last10), home: split(games.filter((g) => g.home).slice(0, 10)), away: split(games.filter((g) => !g.home).slice(0, 10)),
    form: last10.slice(0, 5).map((g) => g.res).reverse(),
    streaks: streaks(games),
  };
}

export async function getTeamStats(tid) {
  return teamStats(await getTeamGames(tid));
}
