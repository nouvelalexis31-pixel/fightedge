// Marchés supplémentaires par match (The Odds API, endpoint /events/{id}/odds) :
// les deux équipes marquent, nul remboursé, double chance, buteurs / marqueurs d'essais.
// Chaque marché coûte 1 crédit par match : on ne le demande que pour quelques matchs du jour, dans la limite du budget.
const EXTRA = {
  football: ["btts", "draw_no_bet", "double_chance", "player_goal_scorer_anytime"],
  rugby: ["player_try_scorer_anytime"],
};

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdOf = (a, m) => (a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length) : null);
const bestOf = (odds) => {
  let best = null;
  for (const [bk, p] of Object.entries(odds)) if (!best || p > best.odds) best = { book: bk, odds: p };
  return best;
};

// Une famille d'issues liées (ex. oui / non) : consensus sans marge des bookmakers hors France, cotes françaises.
function market(books, key, FR, defs, total = 1) {
  const probs = defs.map(() => []);
  let n = 0;
  const outs = (b) => b.markets?.find((x) => x.key === key)?.outcomes;
  for (const b of books) {
    if (FR[b.key]) continue;
    const o = outs(b);
    if (!o) continue;
    const ps = defs.map((d) => o.find((x) => d.test(String(x.name || "").toLowerCase()))?.price);
    if (ps.some((p) => !(p > 1))) continue;
    const inv = ps.map((p) => 1 / p);
    const k = total / inv.reduce((a, c) => a + c, 0);
    inv.forEach((v, i) => probs[i].push(v * k));
    n++;
  }
  const res = defs.map((d, i) => {
    const odds = {};
    for (const b of books) {
      if (!FR[b.key]) continue;
      const p = outs(b)?.find((x) => d.test(String(x.name || "").toLowerCase()))?.price;
      if (p > 1) odds[FR[b.key]] = p;
    }
    const best = bestOf(odds);
    const prob = n >= 3 ? mean(probs[i]) : null;
    return { name: d.label, odds, best, prob, ev: prob && best ? prob * best.odds - 1 : null, sd: prob ? sdOf(probs[i], prob) : null };
  });
  if (!res.some((r) => r.best)) return null;
  return { outcomes: res, n };
}

function scorers(books, FR) {
  const byPlayer = new Map();
  for (const b of books) {
    for (const mk of b.markets || []) {
      if (!/scorer_anytime$/.test(mk.key)) continue;
      for (const x of mk.outcomes || []) {
        const bad = /^(over|under|yes|no)$/i;
        const player = x.description && !bad.test(x.description) ? x.description : bad.test(x.name || "") ? null : x.name;
        if (!player || !(x.price > 1) || /^no$/i.test(x.name || "")) continue;
        const e = byPlayer.get(player) || { name: player, fr: {}, other: null };
        if (FR[b.key]) e.fr[FR[b.key]] = x.price;
        else if (!e.other || x.price > e.other.price) e.other = { book: b.title || b.key, price: x.price };
        byPlayer.set(player, e);
      }
    }
  }
  const all = [...byPlayer.values()];
  const withFr = all.filter((e) => Object.keys(e.fr).length);
  const lowest = (e) => Math.min(...Object.values(e.fr), e.other?.price ?? Infinity);
  if (withFr.length >= 3) return { list: withFr.map((e) => ({ ...e, best: bestOf(e.fr) })).sort((a, b) => a.best.odds - b.best.odds).slice(0, 14), onlyOthers: false };
  const others = all.filter((e) => e.other);
  if (others.length >= 3) return { list: others.sort((a, b) => lowest(a) - lowest(b)).slice(0, 12).map((e) => ({ ...e, best: null })), onlyOthers: true };
  return null;
}

export function buildExtras(m, books, FR, sportId) {
  const H = m.home.toLowerCase(), A = m.away.toLowerCase();
  const isD = (n) => /draw|nul|^x$/.test(n);
  const hasH = (n) => n.includes(H) || /\bhome\b/.test(n);
  const hasA = (n) => n.includes(A) || /\baway\b/.test(n);
  const out = { n: {} };
  const btts = market(books, "btts", FR, [{ label: "Oui", test: (n) => n === "yes" }, { label: "Non", test: (n) => n === "no" }]);
  if (btts) { out.btts = btts.outcomes; out.n.btts = btts.n; }
  const dnb = market(books, "draw_no_bet", FR, [{ label: m.home, test: (n) => n === H || n === "home" }, { label: m.away, test: (n) => n === A || n === "away" }]);
  if (dnb) { out.dnb = dnb.outcomes; out.n.dnb = dnb.n; }
  const dc = market(books, "double_chance", FR, [
    { label: `${m.home} ou nul`, test: (n) => hasH(n) && isD(n) && !hasA(n) },
    { label: `${m.away} ou nul`, test: (n) => hasA(n) && isD(n) && !hasH(n) },
    { label: `${m.home} ou ${m.away}`, test: (n) => hasH(n) && hasA(n) && !isD(n) },
  ], 2);
  if (dc) { out.dc = dc.outcomes; out.n.dc = dc.n; }
  const sc = scorers(books, FR);
  if (sc) { out.scorers = sc.list; out.scorersOnlyOthers = sc.onlyOthers; out.scorerKind = sportId === "rugby" ? "try" : "goal"; }
  return out.btts || out.dnb || out.dc || out.scorers ? out : null;
}

// Retourne { matches (avec .extras), stats }.
export async function loadExtras(matches, { api, FR, credits, prio, endOfDay, now }) {
  const stats = { asked: 0, ok: 0, spent: 0, btts: 0, dnb: 0, dc: 0, scorers: 0, frScorers: 0, errors: [] };
  const maxMatches = Math.max(0, Number(process.env.ODDS_EXTRA_MATCHES ?? 8));
  let budget = Math.min(Number(process.env.ODDS_EXTRA_CREDITS ?? 40), credits == null ? Infinity : Math.max(0, credits - 40));
  if (!maxMatches || budget < 1) return { matches, stats };
  const eod = endOfDay(now);
  let pool = matches.filter((m) => EXTRA[m.sport] && m.key && m.nBooks >= 3 && +new Date(m.start) <= eod);
  if (pool.length < 3) pool = matches.filter((m) => EXTRA[m.sport] && m.key && m.nBooks >= 3 && +new Date(m.start) <= now + 30 * 3600e3);
  pool = pool.sort((a, b) => prio(a.key) - prio(b.key) || a.start.localeCompare(b.start)).slice(0, maxMatches);

  const chosen = [];
  for (const m of pool) {
    const mk = EXTRA[m.sport];
    if (mk.length <= budget) { chosen.push({ m, mk }); budget -= mk.length; }
    else if (budget >= 1) { chosen.push({ m, mk: mk.slice(0, budget) }); budget = 0; }
  }
  const q = (m, ms) => `/sports/${m.key}/events/${m.id}/odds?regions=eu&markets=${ms.join(",")}&oddsFormat=decimal&dateFormat=iso`;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // appels en série (la limite de débit de l'API rejetait les requêtes parallèles en 429), un nouvel essai après pause
  const call = async (url) => {
    try { return await api(url); }
    catch (e) { if (e.status !== 429) throw e; await sleep(1500); return await api(url); }
  };
  const done = [];
  for (const { m, mk } of chosen) {
    stats.asked++;
    try {
      let rs = [];
      try { rs = [await call(q(m, mk))]; }
      catch (e) {
        if (e.status !== 422) throw e;
        for (const one of mk) { try { await sleep(300); rs.push(await call(q(m, [one]))); } catch { /* marché non proposé */ } }
      }
      const books = rs.flatMap((r) => r.data?.bookmakers || []);
      stats.spent += mk.length;
      done.push({ status: "fulfilled", value: { id: m.id, extras: buildExtras(m, books, FR, m.sport), remaining: rs.map((r) => r.remaining).filter((x) => x != null) } });
    } catch (e) {
      done.push({ status: "rejected", reason: e });
      if (e.status === 429) break;
    }
    await sleep(400);
  }
  const byId = new Map();
  let rem = credits;
  for (const d of done) {
    if (d.status === "rejected") { stats.errors.push(d.reason?.message || "erreur"); continue; }
    const { id, extras, remaining } = d.value;
    for (const r of remaining) rem = rem == null ? r : Math.min(rem, r);
    if (!extras) continue;
    stats.ok++;
    if (extras.btts) stats.btts++;
    if (extras.dnb) stats.dnb++;
    if (extras.dc) stats.dc++;
    if (extras.scorers) { stats.scorers++; if (!extras.scorersOnlyOthers) stats.frScorers++; }
    byId.set(id, extras);
  }
  stats.credits = rem;
  return { matches: matches.map((m) => (byId.has(m.id) ? { ...m, extras: byId.get(m.id) } : m)), stats };
}
