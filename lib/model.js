// Modèle FightEdge : à partir des probabilités du marché (vainqueur + total), on estime les autres marchés
// (scores probables, les deux équipes marquent, double chance, nombre de sets...). Ce sont des estimations
// sans cote de bookmaker : on affiche la « cote juste » à comparer avec celle de votre opérateur.

const fact = (n) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
const pois = (k, l) => Math.exp(-l) * Math.pow(l, k) / fact(k);
const N = 9; // buts 0..8

// P(total >= k) pour une loi de Poisson de moyenne mu
const pAtLeast = (k, mu) => { let c = 0; for (let i = 0; i < k; i++) c += pois(i, mu); return 1 - c; };

// moyenne de buts totale telle que P(total > ligne) = pOver (ligne en .5)
function fitTotal(line, pOver) {
  const k = Math.ceil(line);
  let lo = 0.3, hi = 9;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (pAtLeast(k, mid) < pOver) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function grid(lh, la) {
  const g = [];
  for (let i = 0; i < N; i++) { g.push([]); for (let j = 0; j < N; j++) g[i].push(pois(i, lh) * pois(j, la)); }
  const s = g.flat().reduce((a, b) => a + b, 0);
  return g.map((r) => r.map((x) => x / s));
}
const sum = (g, f) => { let t = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (f(i, j)) t += g[i][j]; return t; };

export const fair = (p) => (p > 0.001 ? 1 / p : null);

// ---------- Football / hockey : modèle de Poisson ----------
export function goalsModel(m) {
  const H = m.outcomes.find((o) => o.name === m.home), A = m.outcomes.find((o) => o.name === m.away), D = m.outcomes.find((o) => o.name === "Match nul");
  if (!H || !A || H.probAdj == null || A.probAdj == null) return null;
  const hasDraw = !!D && D.probAdj != null;
  const t = (m.totals || []).slice().sort((a, b) => Math.abs(a.over.probAdj - 0.5) - Math.abs(b.over.probAdj - 0.5))[0];
  if (!t) return null;
  const mu = fitTotal(t.point, t.over.probAdj ?? t.over.prob);
  const pH = H.probAdj, pA = A.probAdj, pD = hasDraw ? D.probAdj : null;
  const tot = pH + pA + (pD || 0);
  let best = null;
  for (let r = 0.15; r <= 6; r *= 1.02) {
    const lh = (mu * r) / (1 + r), la = mu / (1 + r);
    const g = grid(lh, la);
    const ph = sum(g, (i, j) => i > j), pa = sum(g, (i, j) => i < j), pd = sum(g, (i, j) => i === j);
    const err = hasDraw ? (ph - pH / tot) ** 2 + (pd - pD / tot) ** 2 + (pa - pA / tot) ** 2 : (ph / (ph + pa) - pH / (pH + pA)) ** 2;
    if (!best || err < best.err) best = { err, lh, la, g };
  }
  const { lh, la, g } = best;
  const scores = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) scores.push({ h: i, a: j, p: g[i][j] });
  scores.sort((a, b) => b.p - a.p);
  const P = (f) => sum(g, f);
  const markets = [
    { group: "Les deux équipes marquent", items: [
      { label: "Oui", p: P((i, j) => i > 0 && j > 0) },
      { label: "Non", p: P((i, j) => i === 0 || j === 0) },
    ] },
    { group: "Double chance", items: [
      { label: `${m.home} ou nul`, p: P((i, j) => i >= j) },
      { label: `${m.away} ou nul`, p: P((i, j) => j >= i) },
      { label: `${m.home} ou ${m.away}`, p: P((i, j) => i !== j) },
    ] },
    { group: "Remboursé si match nul", items: [
      { label: m.home, p: P((i, j) => i > j) / (1 - P((i, j) => i === j)) },
      { label: m.away, p: P((i, j) => j > i) / (1 - P((i, j) => i === j)) },
    ] },
    { group: `${m.home} : buts marqués`, items: [
      { label: "Plus de 0,5", p: P((i) => i >= 1) }, { label: "Plus de 1,5", p: P((i) => i >= 2) }, { label: "Plus de 2,5", p: P((i) => i >= 3) },
    ] },
    { group: `${m.away} : buts marqués`, items: [
      { label: "Plus de 0,5", p: P((i, j) => j >= 1) }, { label: "Plus de 1,5", p: P((i, j) => j >= 2) }, { label: "Plus de 2,5", p: P((i, j) => j >= 3) },
    ] },
    { group: "Lignes de buts", items: [
      { label: "Plus de 1,5 but", p: P((i, j) => i + j >= 2) }, { label: "Plus de 2,5 buts", p: P((i, j) => i + j >= 3) }, { label: "Plus de 3,5 buts", p: P((i, j) => i + j >= 4) },
    ] },
    { group: "Nombre de buts", items: [
      { label: "0 ou 1 but", p: P((i, j) => i + j <= 1) }, { label: "2 ou 3 buts", p: P((i, j) => i + j >= 2 && i + j <= 3) }, { label: "4 buts ou plus", p: P((i, j) => i + j >= 4) },
    ] },
    { group: "Équipe qui garde sa cage inviolée", items: [
      { label: m.home, p: P((i, j) => j === 0) }, { label: m.away, p: P((i, j) => i === 0) },
    ] },
    { group: `${m.home} gagne et ...`, items: [
      { label: "moins de 3,5 buts", p: P((i, j) => i > j && i + j <= 3) }, { label: "plus de 2,5 buts", p: P((i, j) => i > j && i + j >= 3) },
    ] },
    { group: `${m.away} gagne et ...`, items: [
      { label: "moins de 3,5 buts", p: P((i, j) => j > i && i + j <= 3) }, { label: "plus de 2,5 buts", p: P((i, j) => j > i && i + j >= 3) },
    ] },
  ].map((x) => ({ ...x, items: x.items.map((it) => ({ ...it, fair: fair(it.p) })) }));
  return { kind: "goals", lh, la, mu, scores: scores.slice(0, 6).map((s) => ({ ...s, fair: fair(s.p) })), markets, pBtts: P((i, j) => i > 0 && j > 0), pDraw: P((i, j) => i === j), lines: [1.5, 2.5, 3.5, 4.5].map((k) => ({ point: k, over: P((i, j) => i + j > k) })) };
}

// ---------- Tennis : modèle en sets ----------
function winMatch(q, n) { // meilleur des n sets
  const need = (n + 1) / 2;
  let p = 0;
  for (let lose = 0; lose < need; lose++) {
    const c = fact(need - 1 + lose) / (fact(need - 1) * fact(lose));
    p += c * Math.pow(q, need) * Math.pow(1 - q, lose);
  }
  return p;
}
function fitSet(p, n) {
  let lo = 0.01, hi = 0.99;
  for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (winMatch(mid, n) < p) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

export function setsModel(m) {
  const H = m.outcomes.find((o) => o.name === m.home), A = m.outcomes.find((o) => o.name === m.away);
  if (!H || !A || H.probAdj == null || A.probAdj == null) return null;
  const pH = H.probAdj / (H.probAdj + A.probAdj);
  const t = (m.totals || []).slice().sort((a, b) => Math.abs(a.over.probAdj - 0.5) - Math.abs(b.over.probAdj - 0.5))[0];
  const n = t && t.point >= 29 ? 5 : 3; // un total de jeux élevé indique un format en 5 sets
  const q = fitSet(pH, n);
  const need = (n + 1) / 2;
  const scores = [];
  for (let lose = 0; lose < need; lose++) {
    const c = fact(need - 1 + lose) / (fact(need - 1) * fact(lose));
    scores.push({ label: `${m.home} gagne ${need}-${lose}`, p: c * Math.pow(q, need) * Math.pow(1 - q, lose), sets: need + lose, win: "h" });
    scores.push({ label: `${m.away} gagne ${need}-${lose}`, p: c * Math.pow(1 - q, need) * Math.pow(q, lose), sets: need + lose, win: "a" });
  }
  scores.sort((a, b) => b.p - a.p);
  const bySets = [];
  for (let s = need; s <= n; s++) bySets.push({ label: `${s} sets`, p: scores.filter((x) => x.sets === s).reduce((a, b) => a + b.p, 0) });
  const markets = [
    { group: "Nombre de sets", items: bySets },
    { group: "Score en sets", items: scores.slice(0, 4).map((s) => ({ label: s.label, p: s.p })) },
    { group: "Vainqueur du 1er set", items: [{ label: m.home, p: q }, { label: m.away, p: 1 - q }] },
  ].map((x) => ({ ...x, items: x.items.map((it) => ({ ...it, fair: fair(it.p) })) }));
  const pw = (a, b) => (a === need ? 1 : b === need ? 0 : q * pw(a + 1, b) + (1 - q) * pw(a, b + 1));
  const hAfterLoss = (1 - q) * pw(0, 1), aAfterLoss = q * (1 - pw(1, 0));
  markets.push({ group: "Retournement après un 1er set perdu", items: [{ label: m.home, p: hAfterLoss, fair: fair(hAfterLoss) }, { label: m.away, p: aAfterLoss, fair: fair(aAfterLoss) }] });
  return { kind: "sets", n, q, markets, hAfterLoss, aAfterLoss, pFive: n === 5 ? bySets[2]?.p : null, pDecider: bySets[bySets.length - 1].p };
}

// ---------- Basket, foot US, rugby... : score attendu à partir du handicap et du total ----------
export function pointsModel(m) {
  const t = (m.totals || []).slice().sort((a, b) => Math.abs(a.over.probAdj - 0.5) - Math.abs(b.over.probAdj - 0.5))[0];
  const s = (m.spreads || []).slice().sort((a, b) => Math.abs(a.home.prob - 0.5) - Math.abs(b.home.prob - 0.5))[0];
  if (!t || !s) return null;
  const total = t.point, margin = -s.point; // marge attendue de l'équipe à domicile (handicap équilibré)
  const h = (total + margin) / 2, a = (total - margin) / 2;
  return { kind: "points", total, margin, h, a };
}

export function modelOf(m) {
  if (m.sport === "football" || m.sport === "hockey") return goalsModel(m);
  if (m.sport === "tennis") return setsModel(m);
  if (["basketball", "americanfootball", "rugby", "baseball"].includes(m.sport)) return pointsModel(m);
  return null;
}
