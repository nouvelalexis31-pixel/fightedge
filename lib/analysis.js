import { enough } from "./enough.js";
// Analyse : forme (football-data) + consensus du marché + meilleure cote FR -> pronos et analyses de match.
import { odd, pct, signed, pt, endOfDay } from "./format.js";
import { SPORTS } from "./odds.js";
import { modelOf, fair } from "./model.js";
import { canon } from "./fr.js";
import { setsLine } from "./setline.js";
import { footValueOk, LEARNED } from "./learned.js";
import { steamOf } from "./steam.js";
import { eloProb } from "./tennisElo.js";

const STOP = new Set("fc cf afc sc ac as ssc rc rcd ud cd sv vfl vfb fsv tsg sd fk de del la le the of club and calcio".split(" "));
const ALIAS = { munchen: "munich", milano: "milan", internazionale: "inter", lyonnais: "lyon", brestois: "brest", utd: "united" };
const tokens = (name) =>
  new Set(
    name
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/).filter((t) => t && !STOP.has(t) && !/^\d+$/.test(t))
      .map((t) => ALIAS[t] || t)
  );
const jac = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export const nameSim = (a, b) => jac(tokens(canon(a)), tokens(canon(b)));

export function indexTeams(teams) {
  return teams.map((t) => ({ t, sets: t.names.map(tokens) }));
}
export function findTeam(name, idx) {
  const s = tokens(name);
  let best = null, bs = 0, tie = false;
  for (const e of idx) {
    const sc = Math.max(...e.sets.map((x) => jac(s, x)));
    if (sc > bs) { bs = sc; best = e.t; tie = false; } else if (sc === bs && sc > 0) tie = true;
  }
  return bs >= 0.5 && !tie ? best : null;
}

const summary = (t) => {
  const r = t.results; const n = r.length;
  const pts = r.reduce((a, x) => a + (x.w === "V" ? 3 : x.w === "N" ? 1 : 0), 0);
  const gf = r.reduce((a, x) => a + x.gf, 0), ga = r.reduce((a, x) => a + x.ga, 0);
  const seq = [...r].reverse().map((x) => x.w);
  return { n, pts, ppg: n ? pts / n : 0, gf, ga, gpm: n ? (gf + ga) / n : 0, seq, letters: seq };
};

// Ajoute à chaque match : form (football) et, par issue, probAdj / evAdj (probabilité ajustée par la forme, max ±3 points).
export function enrich(matches, teams) {
  const idx = indexTeams(teams || []);
  return matches.map((m) => {
    let form = null, shift = 0;
    if (m.sport === "football" && idx.length) {
      const th = findTeam(m.home, idx), ta = findTeam(m.away, idx);
      if (th && ta) {
        const fh = summary(th), fa = summary(ta);
        if (fh.n >= 3 && fa.n >= 3) { form = { home: fh, away: fa, tempo: (fh.gpm + fa.gpm) / 2, standH: th.standing || null, standA: ta.standing || null, idH: th.id, idA: ta.id, l10H: th.last10 || th.results, l10A: ta.last10 || ta.results }; shift = 0.03 * ((fh.ppg - fa.ppg) / 3); }
      }
    }
    const adj = (o, delta) => {
      let p = o.prob;
      if (p != null) p = clamp(p + delta, 0.01, 0.97);
      return { ...o, probAdj: p, evAdj: p != null && o.best ? p * o.best.odds - 1 : null };
    };
    const outcomes = m.outcomes.map((o) => adj(o, form ? (o.name === m.home ? shift : o.name === m.away ? -shift : 0) : 0));
    const totals = (m.totals || []).map((t) => {
      const d = form ? 0.03 * clamp((form.tempo - t.point) / 1.5, -1, 1) : 0;
      return { ...t, over: adj(t.over, d), under: adj(t.under, -d) };
    });
    const spreads = (m.spreads || []).map((t) => ({ ...t, home: adj(t.home, 0), away: adj(t.away, 0) }));
    let extras = null;
    if (m.extras) {
      const ex = m.extras, sh = form ? shift : 0, bt = form ? 0.02 * clamp((form.tempo - 2.5) / 1, -1, 1) : 0;
      extras = { ...ex };
      if (ex.btts) extras.btts = ex.btts.map((o, i) => adj(o, i === 0 ? bt : -bt));
      if (ex.dnb) extras.dnb = ex.dnb.map((o, i) => adj(o, i === 0 ? sh : -sh));
      if (ex.dc) extras.dc = ex.dc.map((o, i) => adj(o, i === 0 ? sh * 0.5 : i === 1 ? -sh * 0.5 : 0));
    }
    const out = { ...m, form, shift, outcomes, totals, spreads, extras };
    out.model = modelOf(out);
    return out;
  });
}

// ---------- Candidats de pari d'un match ----------
export function unitOf(m) { return SPORTS[m.sport]?.unit || "points"; }
export function candidates(m) {
  const L = [];
  for (const o of m.outcomes) {
    if (!o.best || o.probAdj == null) continue;
    const label = o.name === "Match nul" ? "Match nul" : m.sport === "football" || m.sport === "basketball" ? `Victoire : ${o.name}` : `${o.name} vainqueur`;
    const ep = m.sport === "tennis" && o.name !== "Match nul" ? eloProb(o.name, o.name === m.home ? m.away : m.home) : null;
    L.push({ market: "h2h", marketLabel: o.name === "Match nul" ? "Résultat du match" : "Vainqueur", key: `h2h-${o.name}`, o, label, nBooks: m.nBooks, foot: m.sport === "football", steam: steamOf(m, o.name), elo: ep });
  }
  for (const t of m.totals || []) {
    for (const side of ["over", "under"]) {
      const o = t[side];
      if (!o.best || o.probAdj == null) continue;
      L.push({ market: "totals", marketLabel: `Nombre de ${unitOf(m)}`, key: `tot-${t.point}-${side}`, o, line: t, side, label: `${side === "over" ? "Plus" : "Moins"} de ${pt(t.point)} ${unitOf(m)}`, nBooks: t.nBooks });
    }
  }
  for (const t of m.spreads || []) {
    for (const side of ["home", "away"]) {
      const o = t[side];
      if (!o.best || o.probAdj == null) continue;
      const team = side === "home" ? m.home : m.away;
      const pts = side === "home" ? t.point : -t.point;
      L.push({ market: "spreads", marketLabel: "Handicap", key: `spr-${t.point}-${side}`, o, line: t, side, label: `${team} ${pts > 0 ? "+" : "−"}${pt(Math.abs(pts))}`, nBooks: t.nBooks });
    }
  }
  const ex = m.extras;
  if (ex?.btts) for (const o of ex.btts) if (o.best && o.probAdj != null) L.push({ market: "btts", marketLabel: "Les deux équipes marquent", key: `btts-${o.name}`, o, label: `Les deux équipes marquent : ${o.name}`, nBooks: ex.n.btts });
  if (ex?.dnb) for (const o of ex.dnb) if (o.best && o.probAdj != null) L.push({ market: "dnb", marketLabel: "Nul remboursé", key: `dnb-${o.name}`, o, label: `${o.name} (remboursé si nul)`, nBooks: ex.n.dnb });
  if (ex?.dc) for (const o of ex.dc) if (o.best && o.probAdj != null) L.push({ market: "dc", marketLabel: "Double chance", key: `dc-${o.name}`, o, label: `Double chance : ${o.name}`, nBooks: ex.n.dc });
  return L;
}

const sdWord = (sd) => (sd == null ? "" : sd < 0.02 ? "Les bookmakers sont très d'accord." : sd < 0.04 ? "Accord correct entre bookmakers." : "Avis partagés entre bookmakers : prudence.");

function stars(m, c, kind) {
  const o = c.o;
  let s = 2;
  if (c.nBooks >= 8) s++;
  if (c.nBooks < 5) s--;
  if (m.form && o.probAdj >= o.prob) s++;
  if (o.probAdj >= 0.5) s++;
  if (o.evAdj > 0.12) s--;
  if (o.probAdj < 0.35) s = Math.min(s, 3);
  if (kind === "bold") s = Math.min(s, 3);
  return clamp(s, 1, 5);
}

export function lines(m, c, kind) {
  const o = c.o, L = [];
  L.push({ label: "Ressenti du marché", text: `${c.nBooks} bookmaker${c.nBooks > 1 ? "s" : ""} (hors France) ${c.nBooks > 1 ? "donnent" : "donne"} ${pct(o.prob)} à cette issue, soit une cote juste d'environ ${odd(1 / o.prob)}. ${sdWord(o.sd)}`.trim() });
  if (o.evAdj >= 0.02) L.push({ label: "Cote", text: `${o.best.book} paie ${odd(o.best.odds)} : environ ${signed(o.evAdj)} d'avantage estimé par rapport à la cote juste.` });
  else if (o.evAdj >= -0.02) L.push({ label: "Cote", text: `${o.best.book} paie ${odd(o.best.odds)}, proche de la cote juste : pas d'avantage de prix.` });
  else L.push({ label: "Cote", text: `${o.best.book} paie ${odd(o.best.odds)}, un peu sous la cote juste (${signed(o.evAdj)}) : pas de plus-value, à réserver à une petite mise.` });
  if (c.market === "spreads") {
    const pts = c.side === "home" ? c.line.point : -c.line.point, need = Math.ceil(Math.abs(pts)), u = unitOf(m).replace(/s$/, "");
    L.push({ label: "Handicap", text: pts < 0 ? `${c.side === "home" ? m.home : m.away} doit gagner avec ${need} ${u}${need > 1 ? "s" : ""} d'écart ou plus.` : `${c.side === "home" ? m.home : m.away} réussit si elle gagne, fait match nul ou perd de moins de ${need} ${u}${need > 1 ? "s" : ""}.` });
  }
  if (c.market === "btts") L.push({ label: "Le pari", text: c.o.name === "Oui" ? "Il suffit que chaque équipe marque au moins un but, quel que soit le score final." : "Gagnant si au moins une des deux équipes ne marque pas (0-0 ou victoire sur blanc)." });
  if (c.market === "dnb") L.push({ label: "Le pari", text: `Si ${c.o.name} gagne, le pari est gagné ; si le match est nul, la mise est remboursée ; sinon il est perdu. Cote plus basse que la victoire sèche, mais risque réduit.` });
  if (c.market === "dc") L.push({ label: "Le pari", text: `Couvre deux des trois issues possibles : ${c.o.name}. Plus de chances de réussite, avec une cote plus basse.` });
  if (o.evAdj > 0 && o.best?.odds > 1) {
    const f = Math.min(0.03, (o.evAdj / (o.best.odds - 1)) / 4);
    if (f >= 0.002) L.push({ label: "Mise conseillée", text: `${(f * 100).toFixed(1).replace(".", ",")} % de votre bankroll (critère de Kelly divisé par 4, plafonné à 3 %) : sur 100 € de bankroll, ${(f * 100).toFixed(2).replace(".", ",")} €. Gain moyen attendu : ${signed(o.evAdj)} de la mise sur le long terme.` });
  }
  if (kind === "mid") L.push({ label: "Pourquoi cette cote", text: `Cote ${odd(o.best.odds)} dans la zone 1,50–2,50 : un bon compromis entre rendement et chances de réussite (environ ${Math.round(o.probAdj * 100)} fois sur 100).` });
  if (kind === "bold") L.push({ label: "Risque", text: `Cote élevée (${odd(o.best.odds)}) : ce pari passe environ ${Math.round(o.probAdj * 100)} fois sur 100 : probable pour une cote aussi haute, mais mise réduite conseillée.` });
  if (m.form) {
    const f = (n, x) => `${n} : ${x.seq.join("-")} (${x.pts} pt${x.pts > 1 ? "s" : ""} en ${x.n} matchs), ${x.gf} but${x.gf > 1 ? "s" : ""} marqué${x.gf > 1 ? "s" : ""}, ${x.ga} encaissé${x.ga > 1 ? "s" : ""}`;
    L.push({ label: "Forme récente", text: `${f(m.home, m.form.home)}. ${f(m.away, m.form.away)}.`, form: { home: { letters: m.form.home.seq }, away: { letters: m.form.away.seq } } });
    if (c.market === "totals") L.push({ label: "Rythme", text: `Ces équipes jouent des matchs à environ ${pt(m.form.tempo.toFixed(1))} buts en moyenne, pour une ligne à ${pt(c.line.point)}.` });
    const d = o.probAdj - o.prob;
    if (Math.abs(d) >= 0.002) L.push({ label: "Ajustement", text: `La forme ${d > 0 ? "renforce" : "tempère"} cette issue : ${d > 0 ? "+" : "−"}${Math.abs(d * 100).toFixed(1).replace(".", ",")} pt sur sa probabilité.` });
  } else {
    L.push({ label: "Forme récente", text: m.sport === "football" ? "Non disponible pour ce match : analyse fondée sur le marché uniquement." : "Non disponible pour ce sport : analyse fondée sur le marché uniquement." });
  }
  return L;
}

// Type d'un pari : plus-value > cote équilibrée (1,50–2,50) > audacieux (> 2,50) > favori solide.
export const MIN_ODDS = 1.5; // en dessous, le gain est trop faible pour les pronos du jour
export function classify(c) {
  const o = c.o, od = o.best.odds;
  // Plus-value : l'avantage doit dépasser le désaccord entre bookmakers (sinon c'est du bruit, pas un vrai avantage).
  const thr = Math.max(0.02, 0.7 * (o.sd || 0) * od);
  // Appris sur l'historique : une cote qui monte nettement (le marché se détourne) ne se joue pas.
  if (c.steam && c.steam.d <= -0.03) return null;
  // Appris sur l'historique (foot) : la plus-value n'a été rentable que sur les cotes 1,30–2,20 ; au-delà elle perd de l'argent.
  // Tennis : on ne joue pas un joueur que notre classement Elo (appris sur 47 000 matchs) juge nettement moins fort que le marché.
  if (c.elo && c.elo.p < o.probAdj - 0.12) return null;
  const valueZone = (!c.foot || footValueOk(od)) && (!c.elo || c.elo.p >= o.probAdj - 0.05);
  if (o.evAdj >= thr && o.probAdj >= 0.25 && od >= MIN_ODDS && valueZone) return "value";
  if (c.steam && c.steam.d >= 0.03 && od >= MIN_ODDS && od <= 3.5 && o.evAdj >= -0.04) return "value";
  if (od >= 1.5 && od <= 2.5 && o.probAdj >= 0.4 && o.evAdj >= -0.12) return "mid";
  if (od > 2.5 && o.probAdj >= 0.33 && o.evAdj >= -0.06) return "bold";
  if (o.probAdj >= 0.42 && o.evAdj >= -0.1) return "safe";
  return null;
}

export const mk = (m, c, kind) => {
  const o = c.o;
  const suspicious = o.evAdj > 0.12;
  const f = m.form ? 0.01 : 0;
  const score = kind === "value"
    ? Math.min(o.evAdj, 0.12) * Math.sqrt(o.probAdj) * Math.min(1, c.nBooks / 8) * (m.form ? 1.1 : 1) * (suspicious ? 0.6 : 1)
    : kind === "mid" ? o.evAdj * 2 + o.probAdj * 0.5 + f
    : kind === "bold" ? o.evAdj + 0.05 * Math.log(o.best.odds) + f
    : o.probAdj + 2 * o.evAdj;
  // bonus « cote qui baisse » (+6 % sur 4 saisons d'historique)
  const sBoost = c.steam && c.steam.d >= 0.03 ? 1.25 : 1;
  return { id: `${m.id}:${c.key}`, match: m, cand: c, outcome: o, kind, label: c.label, marketLabel: c.marketLabel, suspicious, stars: stars(m, c, kind), lines: lines(m, c, kind), score: score * sBoost, steam: c.steam || null };
};

// Tous les paris d'un match, classés (pour la page d'analyse).
export function matchPicks(m) {
  return candidates(m)
    .map((c) => mk(m, c, classify(c) || "safe"))
    .sort((a, b) => (PRIO[a.kind] - PRIO[b.kind]) || b.score - a.score);
}

// Fenêtres de sélection : aujourd'hui, puis demain, puis 3 jours si les matchs du jour ne suffisent pas.
const windows = (now) => { const e = endOfDay(now); return [e, e + 24 * 3600e3, e + 8 * 24 * 3600e3]; };

const PRIO = { value: 0, mid: 1, bold: 2, safe: 3 };
const QUOTA = { value: 6, mid: 8, bold: 3 };
const CAP = { h2h: 3, totals: 5, spreads: 4, btts: 4, dnb: 3, dc: 3 };
const MARKET_ORDER = ["btts", "dnb", "totals", "spreads", "dc", "h2h"];
const MAX_PICKS = 18;

// Meilleur pari par marché (vainqueur / totaux) pour chaque match : jusqu'à 2 paris par match, sur des marchés différents.
function pickPool(m) {
  const best = {};
  for (const c of candidates(m)) {
    const k = classify(c);
    if (!k || k === "safe" || c.o.best.odds < MIN_ODDS) continue;
    const p = mk(m, c, k);
    const cur = best[c.market];
    if (!cur || PRIO[k] < PRIO[cur.kind] || (k === cur.kind && p.score > cur.score)) best[c.market] = p;
  }
  return Object.values(best);
}

// 6 à 12 pronos : plus-values, cotes équilibrées (1,50–2,50), audacieux puis favoris solides.
// Fenêtre élargie (30 h, 72 h, 7 jours) tant qu'il y en a moins de 6.
export function dailyPicks(matches, now = Date.now()) {
  let best = [];
  let scope = "today";
  for (const [wi, end] of windows(now).entries()) {
    const pool = matches.filter((m) => { const t = +new Date(m.start); return enough(m) && t > now && t <= end; });
    scope = ["today", "tomorrow", "later"][wi];
    const byKind = { value: [], mid: [], bold: [] };
    for (const m of pool) for (const p of pickPool(m)) byKind[p.kind].push(p);
    for (const k in byKind) byKind[k].sort((a, b) => b.score - a.score);
    const per = new Map();
    const picks = [];
    const used = new Set();
    const pm = {}, ps = {}, pl = {};
    const take = (list, n) => {
      for (const p of list) {
        if (n <= 0 || picks.length >= MAX_PICKS) break;
        if (used.has(p.id)) continue;
        if ((per.get(p.match.id) || 0) >= 2) continue;
        if ((pm[p.cand.market] || 0) >= (CAP[p.cand.market] || 2)) continue;
        if ((ps[p.match.sport] || 0) >= 5 || (pl[p.match.league] || 0) >= 3) continue;
        used.add(p.id); per.set(p.match.id, (per.get(p.match.id) || 0) + 1); pm[p.cand.market] = (pm[p.cand.market] || 0) + 1; ps[p.match.sport] = (ps[p.match.sport] || 0) + 1; pl[p.match.league] = (pl[p.match.league] || 0) + 1; picks.push(p); n--;
      }
    };
    // 1) un pari de chaque type de marché (variété), 2) quotas par catégorie
    const flat = ["value", "mid", "bold"].flatMap((k) => byKind[k]).filter((p) => p.outcome.evAdj >= -0.03).sort((a, b) => b.score - a.score);
    for (const sp of [...new Set(flat.map((p) => p.match.sport))]) take(flat.filter((p) => p.match.sport === sp), 1);
    for (const mk of MARKET_ORDER) take(flat.filter((p) => p.cand.market === mk), 1);
    take(flat.filter((p) => p.outcome.best.odds >= 1.9 && p.outcome.best.odds <= 2.4), 7);
    for (const k of ["value", "mid", "bold"]) take(byKind[k], QUOTA[k]);
    if (picks.length < 8) for (const k of ["mid", "value", "bold"]) take(byKind[k], 8 - picks.length);
    if (picks.length > best.length) { best = picks; best.scope = scope; }
    if (best.length >= 6) break;
  }
  if (!best.length) {
    // Filet de sécurité : l'utilisateur a toujours au moins un prono IA (le plus probable, avec une vraie cote).
    const end = now + 10 * 24 * 3600e3, L = [];
    for (const m of matches) {
      const t = +new Date(m.start);
      if (!enough(m) || t <= now || t > end) continue;
      const c = candidates(m).filter((c) => c.o.best && c.o.best.odds >= 1.3 && c.o.probAdj >= 0.35).map((c) => mk(m, c, classify(c) || "safe")).sort((a, b) => b.score - a.score)[0];
      if (c) L.push(c);
    }
    L.sort((a, b) => b.score - a.score);
    best = L.slice(0, 3);
    best.scope = "later";
  }
  return best;
}

// ---------- Combinés ----------
// Un combiné se place chez un seul opérateur : la cote totale est le produit des cotes de ce même opérateur.
const BOOKS = ["Betclic", "Winamax", "Unibet", "PMU"];
function comboOf(legs) {
  let top = null;
  for (const b of BOOKS) {
    if (!legs.every((l) => typeof l.outcome.odds[b] === "number")) continue;
    const odds = legs.reduce((x, l) => x * l.outcome.odds[b], 1);
    if (!top || odds > top.odds) top = { book: b, odds };
  }
  if (!top) return null;
  const perBook = {};
  for (const b of BOOKS) perBook[b] = legs.every((l) => typeof l.outcome.odds[b] === "number") ? legs.reduce((x, l) => x * l.outcome.odds[b], 1) : null;
  const prob = legs.reduce((x, l) => x * l.outcome.probAdj, 1);
  return { legs, book: top.book, odds: top.odds, perBook, prob, ev: prob * top.odds - 1 };
}

const TIERS = [
  { key: "sure", label: "Combiné sûr", size: 2, min: 1.9, max: 3.3, minProb: 0.28, pick: (a, b) => b.prob - a.prob },
  { key: "balanced", label: "Combiné équilibré", size: 3, min: 3.0, max: 6.5, minProb: 0.14, pick: (a, b) => b.ev - a.ev },
];

function subsets(arr, k, start = 0, cur = [], out = []) {
  if (cur.length === k) { out.push([...cur]); return out; }
  for (let i = start; i < arr.length; i++) { cur.push(arr[i]); subsets(arr, k, i + 1, cur, out); cur.pop(); }
  return out;
}

export function dailyCombos(matches, now = Date.now()) {
  for (const [wi, end] of windows(now).entries()) {
    const pool = matches.filter((m) => { const t = +new Date(m.start); return enough(m) && t > now && t <= end; });
    // un pari par match : probable, cote entre 1,40 et 2,20
    const legs = [];
    for (const m of pool) {
      const c = candidates(m)
        .filter((c) => c.o.best.odds >= 1.4 && c.o.best.odds <= 2.2 && c.o.probAdj >= 0.45 && c.o.evAdj >= -0.08)
        .map((c) => mk(m, c, classify(c) || "safe"))
        .sort((a, b) => (b.outcome.probAdj + 2 * b.outcome.evAdj) - (a.outcome.probAdj + 2 * a.outcome.evAdj))[0];
      if (c) legs.push(c);
    }
    legs.sort((a, b) => (b.outcome.probAdj + 2 * b.outcome.evAdj) - (a.outcome.probAdj + 2 * a.outcome.evAdj));
    const top = legs.slice(0, 10);
    const res = [];
    for (const t of TIERS) {
      if (top.length < t.size) continue;
      const cands = subsets(top, t.size).map(comboOf).filter((c) => c && c.odds >= t.min && c.odds <= t.max && c.prob >= t.minProb).sort(t.pick);
      if (cands[0]) res.push({ ...cands[0], tier: t.key, label: t.label, stars: cands[0].prob >= 0.4 ? 4 : cands[0].prob >= 0.22 ? 3 : cands[0].prob >= 0.1 ? 2 : 1 });
    }
    if (wi === 2 && !res.length) {
      const L = [];
      for (const m of pool) {
        const c = candidates(m).filter((c) => c.o.best && c.o.best.odds >= 1.25 && c.o.best.odds <= 3 && c.o.probAdj >= 0.35 && c.o.evAdj >= -0.15).map((c) => mk(m, c, classify(c) || "safe")).sort((a, b) => b.outcome.probAdj - a.outcome.probAdj)[0];
        if (c) L.push(c);
      }
      L.sort((a, b) => b.outcome.probAdj - a.outcome.probAdj);
      for (const size of [2, 3]) {
        const best = subsets(L.slice(0, 8), size).map(comboOf).filter((c) => c && c.odds >= 1.5).sort((a, b) => b.prob - a.prob)[0];
        if (best) res.push({ ...best, tier: size === 2 ? "sure" : "balanced", label: size === 2 ? "Combiné prudent" : "Combiné équilibré", stars: best.prob >= 0.4 ? 4 : best.prob >= 0.22 ? 3 : best.prob >= 0.1 ? 2 : 1 });
      }
    }
    if (res.length >= 2 || wi === 2) { res.scope = ["today", "tomorrow", "later"][wi]; return res; }
  }
  return [];
}

// ---------- Analyse rédigée d'un match ----------
const ord = (n) => (n === 1 ? "1er" : `${n}e`);
const P0 = (p) => `${Math.round(p * 100)} %`;
const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;

export function analyse(m) {
  const sections = [];
  const all = matchPicks(m).filter((x) => x.outcome.best.odds >= 1.45);
  // Paris conseillés : le meilleur de chaque marché (vainqueur, total, handicap), puis des compléments.
  const bets = [];
  for (const mk of ["h2h", "totals", "spreads", "btts", "dnb", "dc"]) {
    const p = all.filter((x) => x.cand.market === mk).sort((a, b) => (PRIO[a.kind] - PRIO[b.kind]) || b.score - a.score)[0];
    if (p) bets.push(p);
  }
  for (const p of all) { if (bets.length >= 6) break; if (!bets.includes(p) && p.kind !== "bold" && p.outcome.probAdj >= 0.4) bets.push(p); }
  bets.sort((a, b) => (PRIO[a.kind] - PRIO[b.kind]) || b.score - a.score);

  const outs = m.outcomes.filter((o) => o.probAdj != null).slice().sort((a, b) => b.probAdj - a.probAdj);
  const fav = outs[0], dog = outs.filter((o) => o.name !== "Match nul").slice(-1)[0];
  const model = m.model;
  const draw = m.outcomes.find((o) => o.name === "Match nul");

  // 1. Rapport de force
  if (fav) {
    const named = fav.name === "Match nul" ? outs[1] : fav;
    const d = named.probAdj;
    const level = d >= 0.65 ? "grand favori" : d >= 0.5 ? "favori" : d >= 0.42 ? "léger favori" : null;
    const parts = m.outcomes.filter((o) => o.probAdj != null).map((o) => `${P0(o.probAdj)} ${o.name === "Match nul" ? "pour le nul" : "pour " + o.name}`).join(", ");
    sections.push({ title: "Rapport de force", text: `${level ? `${named.name} est ${level} de la rencontre` : "Match très ouvert, sans véritable favori"} : le marché donne ${parts}.${draw && draw.probAdj >= 0.29 ? " La probabilité du nul est élevée : le scénario d'un match serré est à surveiller." : ""}` });
  }

  // 2. Scénario du match
  if (model?.kind === "goals") {
    const s = model.scores[0];
    const tempo = model.mu < 2.3 ? "plutôt fermé" : model.mu > 3 ? "très ouvert" : model.mu > 2.7 ? "plutôt ouvert" : "d'intensité moyenne";
    sections.push({ title: "Scénario probable", text: `Nous attendons un match ${tempo} (${model.mu.toFixed(1).replace(".", ",")} buts au total : ${model.lh.toFixed(1).replace(".", ",")} pour ${m.home}, ${model.la.toFixed(1).replace(".", ",")} pour ${m.away}). Le score exact le plus probable est ${s.h}-${s.a} (${P0(s.p)}). Les deux équipes marquent dans ${P0(model.pBtts)} des cas.` });
  } else if (model?.kind === "sets") {
    const best = model.markets[0].items.slice().sort((a, b) => b.p - a.p)[0];
    sections.push({ title: "Scénario probable", text: `Match prévu en ${model.n} sets maximum (format déduit du total de jeux). Le scénario le plus probable est ${best.label} (${P0(best.p)}), avec ${P0(model.pDecider)} de chances d'aller au set décisif.` });
  } else if (model?.kind === "points") {
    const w = model.margin >= 0 ? m.home : m.away;
    sections.push({ title: "Scénario probable", text: `Score attendu : ${m.home} ${Math.round(model.h)} – ${Math.round(model.a)} ${m.away} (total ${String(model.total).replace(".", ",")}). ${Math.abs(model.margin) < 2 ? "Match équilibré, décidé dans les dernières minutes." : `${w} doit l'emporter d'environ ${Math.round(Math.abs(model.margin))} points.`}` });
  }

  // 3. Forme et classement (football)
  if (m.form) {
    const f = m.form, h = f.home, a = f.away;
    const att = (x) => (x.gf / x.n).toFixed(1).replace(".", ","), def = (x) => (x.ga / x.n).toFixed(1).replace(".", ",");
    const better = h.ppg > a.ppg + 0.4 ? m.home : a.ppg > h.ppg + 0.4 ? m.away : null;
    sections.push({ title: "Forme récente", text: `${m.home} : ${h.seq.join("-")} (${plural(h.pts, "point")} sur ${h.n * 3}), ${att(h)} but marqué et ${def(h)} encaissé par match. ${m.away} : ${a.seq.join("-")} (${plural(a.pts, "point")} sur ${a.n * 3}), ${att(a)} marqué et ${def(a)} encaissé. ${better ? `${better} arrive dans une meilleure dynamique.` : "Les deux équipes affichent une dynamique comparable."}` });
    if (f.standH && f.standA && f.standH.comp === f.standA.comp) {
      const sh = f.standH, sa = f.standA, g = (s) => (s.gf - s.ga > 0 ? "+" : "") + (s.gf - s.ga);
      sections.push({ title: "Classement", text: `${m.home} est ${ord(sh.pos)} (${sh.pts} pts en ${sh.p} matchs, différence de buts ${g(sh)}) et reçoit ${m.away}, ${ord(sa.pos)} (${sa.pts} pts en ${sa.p} matchs, ${g(sa)}).` });
    }
    const gp = (x) => x.gf / x.n;
    if (model?.kind === "goals") {
      const lowDef = def(h) !== undefined && h.ga / h.n <= 0.8 && a.ga / a.n <= 0.8;
      sections.push({ title: "Attaque et défense", text: `${gp(h) >= 2 ? `${m.home} marque beaucoup à domicile et à l'extérieur` : `${m.home} marque peu`} ; ${gp(a) >= 2 ? `${m.away} aussi a la gâchette facile` : `${m.away} est moins prolifique`}. ${lowDef ? "Les deux défenses sont solides : tendance au match fermé." : h.ga / h.n >= 1.6 || a.ga / a.n >= 1.6 ? "Au moins une défense est fragile : de quoi alimenter les paris sur les buts." : ""}`.trim() });
    }
  }

  // 3b. Marchés des buts / jeux, écart attendu et buteurs
  {
    const u = unitOf(m);
    const tots = (m.totals || []).filter((t) => t.over?.probAdj != null && t.under?.probAdj != null);
    if (tots.length) {
      const main = tots.slice().sort((a, b) => Math.abs(a.over.probAdj - 0.5) - Math.abs(b.over.probAdj - 0.5))[0];
      const ov = main.over, un = main.under;
      const co = (o) => (o.best ? ` (cote ${odd(o.best.odds)})` : "");
      const side = ov.probAdj >= 0.5 ? "Plus" : "Moins", lean = ov.probAdj >= 0.5 ? ov : un;
      sections.push({ title: `Nombre de ${u}`, text: `Le marché place la ligne centrale à ${pt(main.point)} ${u} : plus de ${pt(main.point)} à ${P0(ov.probAdj)}${co(ov)}, moins de ${pt(main.point)} à ${P0(un.probAdj)}${co(un)}. ${lean.probAdj >= 0.56 ? `${side} de ${pt(main.point)} ${u} est l'issue la plus probable.` : "Ligne très serrée : pas d'issue nettement plus probable."}` });
    }
    const sps = (m.spreads || []).filter((t) => t.home?.probAdj != null && t.away?.probAdj != null && Math.abs(t.home.probAdj - 0.5) <= 0.12);
    if (sps.length) {
      const mid = sps.slice().sort((a, b) => Math.abs(a.home.probAdj - 0.5) - Math.abs(b.home.probAdj - 0.5))[0];
      const favHome = mid.point < 0, margin = Math.abs(mid.point), fav = favHome ? m.home : m.away;
      const fo = favHome ? mid.home : mid.away;
      sections.push({ title: "Écart attendu", text: `Le marché voit ${fav} l'emporter avec environ ${pt(margin)} ${u} d'écart : le handicap ${fav} −${pt(margin)} passe dans ${P0(fo.probAdj)} des cas${fo.best ? ` (cote ${odd(fo.best.odds)})` : ""}. ${margin >= 6 ? "Un net favori : la question est surtout l'ampleur de la victoire." : "Écart modeste : match plutôt serré."}` });
    }
    const sc = m.extras?.scorers;
    if (sc?.length && !m.extras.scorersOnlyOthers) {
      sections.push({ title: m.extras.scorerKind === "try" ? "Marqueurs d'essais probables" : "Buteurs probables", text: `D'après les cotes françaises, les plus probables sont : ${sc.slice(0, 3).map((e) => `${e.name} (${odd(e.best.odds)})`).join(", ")}. Plus la cote est basse, plus le marché le voit marquer.` });
    }
  }

  // 3c. Lecture détaillée (buts, scores, tennis)
  if (model?.kind === "goals") {
    const lg = model.markets.find((g) => g.group === "Lignes de buts");
    if (lg) sections.push({ title: "Lignes de buts", text: lg.items.map((i) => `${i.label} : ${P0(i.p)} (cote juste ${odd(1 / i.p)})`).join(" · ") + ". " + (lg.items[1].p >= 0.58 ? "Le plus de 2,5 buts est favorisé." : lg.items[1].p <= 0.42 ? "Le moins de 2,5 buts est favorisé." : "La ligne de 2,5 buts est très équilibrée.") });
    sections.push({ title: "Scores les plus probables", text: model.scores.slice(0, 4).map((s) => `${s.h}-${s.a} (${P0(s.p)})`).join(", ") + ". Chaque score exact reste peu probable : ils servent surtout à repérer la tendance (victoire courte, match fermé ou ouvert)." });
    const dc = model.markets.find((g) => g.group === "Double chance");
    if (dc) { const b = dc.items.slice(0, 2).sort((x, y) => y.p - x.p)[0]; sections.push({ title: "Option prudente", text: `${b.label} : ${P0(b.p)} de réussite (cote juste ${odd(1 / b.p)}). Une option pour réduire le risque si la victoire sèche semble incertaine.` }); }
  }
  if (model?.kind === "sets") {
    const g = (n) => model.markets.find((x) => x.group === n)?.items || [];
    const fa = m.outcomes.filter((o) => o.probAdj != null).sort((a, b) => b.probAdj - a.probAdj)[0];
    const straight = g("Nombre de sets")[0];
    const set1 = g("Vainqueur du 1er set")[0];
    const comeback = g("Retournement après un 1er set perdu");
    sections.push({ title: "Déroulement probable", text: `Chaque set : ${m.home} ${P0(model.q)}, ${m.away} ${P0(1 - model.q)}. ${(() => { const l = setsLine(model)?.[0]; return l ? `${l.label} : ${P0(l.p)}` : `Victoire en ${straight.label.replace(" sets", "")} sets : ${P0(straight.p)}`; })()}, set décisif : ${P0(model.pDecider)}. Premier set : ${set1.p >= 0.5 ? m.home : m.away} favori (${P0(Math.max(set1.p, 1 - set1.p))}).` });
    if (comeback.length) sections.push({ title: "Scénario de retournement", text: `Après un premier set perdu, ${m.home} gagne quand même le match dans ${P0(comeback[0].p)} des cas, ${m.away} dans ${P0(comeback[1].p)}. ${fa && fa.name !== "Match nul" ? `Un favori comme ${fa.name} peut se permettre de lâcher une manche, pas un outsider.` : ""}`.trim() });
  }

  // 4. Notre avis
  const top = bets[0];
  const alt = bets.slice(1, 3);
  if (top) {
    const fmt = (p) => `${p.label} (${p.marketLabel.toLowerCase()}, cote ${odd(p.outcome.best.odds)}, ${P0(p.outcome.probAdj)} de réussite)`;
    sections.push({ title: "Notre avis", text: `Le pari qui ressort : ${fmt(top)}${top.kind === "value" ? ", avec une cote supérieure à la cote juste" : ""}.${alt.length ? ` En complément : ${alt.map(fmt).join(" ; ")}.` : ""}` });
  }
  const headline = top ? `Notre pari : ${top.label}` : "Pas de pari à cote intéressante sur ce match";
  return { headline, sections, bets };
}

// Buteurs / marqueurs d'essais probables (cotes françaises réelles, probabilité estimée d'après les autres bookmakers).
export function scorerPicks(matches, now = Date.now()) {
  const out = [];
  for (const m of matches) {
    const t = +new Date(m.start), sc = m.extras?.scorers;
    if (!sc?.length || m.extras.scorersOnlyOthers || t <= now || t > now + 30 * 3600e3) continue;
    const c = sc.map((e) => {
      const ref = e.other?.price ?? e.best.odds;
      const prob = Math.min(0.75, 0.93 / ref);
      return { m, name: e.name, fr: e.fr, best: e.best, prob, ev: prob * e.best.odds - 1, kind: m.extras.scorerKind };
    }).filter((x) => x.prob >= 0.2 && x.ev >= -0.12).sort((a, b) => b.prob - a.prob).slice(0, 4);
    out.push(...c);
  }
  return out.sort((a, b) => b.prob - a.prob).slice(0, 12);
}
