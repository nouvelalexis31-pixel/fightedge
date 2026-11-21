// Assemble, pour une fiche match de football : historique des deux équipes, statistiques, séries, classement
// et le moteur de pronos FightEdge (lib/edge.js), branché sur les cotes disponibles.
import { getTeamGames, teamStats } from "./teamform.js";
import { edgeAnalysis } from "./edge.js";
import { devig } from "./odds.js";
import { fr } from "./fr.js";

const HALF = (k) => Math.abs((k * 2) % 2) === 1;

// Cotes ESPN (bookmaker américain, convertie en décimal) : repère de prix, non jouable en France.
function espnBridge(S) {
  const o = S.odds;
  if (!o) return { market: null, offer: null };
  let market = null;
  if (o.p) {
    let line = null, pOver = null;
    if (o.ou?.line != null && o.ou.over > 1 && o.ou.under > 1) { line = o.ou.line; pOver = devig([o.ou.over, o.ou.under])[0]; }
    market = { pH: o.p.h, pD: o.p.d, pA: o.p.a, line, pOver, nBooks: 1 };
  }
  const bk = o.provider || "ESPN";
  const offer = (key) => {
    const one = (v) => (v > 1 ? { odds: v, book: bk, fr: false } : null);
    if (key === "1x2:h") return one(o.h);
    if (key === "1x2:d") return one(o.d);
    if (key === "1x2:a") return one(o.a);
    const t = /^tot:([\d.]+):(over|under)$/.exec(key);
    if (t && o.ou && Number(t[1]) === o.ou.line && HALF(o.ou.line)) return one(t[2] === "over" ? o.ou.over : o.ou.under);
    return null;
  };
  return { market, offer };
}

// Cotes des opérateurs français + consensus sans marge des bookmakers étrangers (match de la base de cotes).
export function oddsBridge(m) {
  const O = (n) => m.outcomes.find((o) => o.name === n);
  const H = O(m.home), D = O("Match nul"), A = O(m.away);
  const ex = m.extras || {};
  const main = (m.totals || []).filter((t) => t.over?.probAdj != null).slice().sort((a, b) => Math.abs(a.over.probAdj - 0.5) - Math.abs(b.over.probAdj - 0.5))[0];
  const market = H?.probAdj != null && A?.probAdj != null ? { pH: H.probAdj, pD: D?.probAdj || 0, pA: A.probAdj, line: main?.point ?? null, pOver: main?.over.probAdj ?? null, nBooks: m.nBooks || 1 } : null;
  const sp = (pt) => (m.spreads || []).find((t) => t.point === pt);
  const out = (key) => {
    let r;
    if ((r = /^1x2:(h|d|a)$/.exec(key))) return { h: H, d: D, a: A }[r[1]];
    if ((r = /^tot:([\d.]+):(over|under)$/.exec(key))) return (m.totals || []).find((t) => t.point === Number(r[1]))?.[r[2]];
    if (key === "btts:yes") return ex.btts?.find((o) => o.name === "Oui");
    if (key === "btts:no") return ex.btts?.find((o) => o.name === "Non");
    if (key === "dc:1X") return ex.dc?.[0];
    if (key === "dc:X2") return ex.dc?.[1];
    if (key === "dc:12") return ex.dc?.[2];
    if (key === "dnb:h") return ex.dnb?.[0];
    if (key === "dnb:a") return ex.dnb?.[1];
    if (key === "ah:h:-1.5") return sp(-1.5)?.home;
    if (key === "ah:a:+1.5") return sp(-1.5)?.away;
    if (key === "ah:h:+1.5") return sp(1.5)?.home;
    if (key === "ah:a:-1.5") return sp(1.5)?.away;
    return null;
  };
  return {
    market,
    offer: (key) => { const o = out(key); return o?.best?.odds > 1 ? { odds: o.best.odds, book: o.best.book, fr: true } : null; },
    consensus: (key) => out(key)?.probAdj ?? null,
  };
}

/**
 * @param S fiche ESPN (lib/espnsum getSummary)
 * @param bridge résultat de oddsBridge(m) pour un match avec cotes françaises (sinon cotes ESPN)
 */
export async function matchCenter(S, bridge = null) {
  if (!S?.home?.id || !S?.away?.id) return null;
  const [gH, gA] = await Promise.all([getTeamGames(S.home.id), getTeamGames(S.away.id)]);
  // pour un match terminé, on ne garde que les matchs joués avant (pas de triche avec le résultat)
  const t0 = S.start ? +new Date(S.start) - 3600e3 : Infinity;
  const before = (g) => !(+new Date(g.date) >= t0);
  const gamesH = gH.filter(before), gamesA = gA.filter(before);
  const tH = teamStats(gamesH), tA = teamStats(gamesA);
  const b = bridge?.market ? bridge : espnBridge(S);
  let E = null;
  try {
    E = edgeAnalysis({ home: fr(S.home.name), away: fr(S.away.name), gamesH, gamesA, standH: S.stand?.h, standA: S.stand?.a, market: b.market, offer: b.offer, consensus: b.consensus });
  } catch { E = null; }
  return { tH, tA, E, frOdds: !!bridge?.market };
}
