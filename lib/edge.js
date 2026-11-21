// Moteur de pronos FightEdge (football).
// 1) Forces d'attaque / défense de chaque équipe à partir de leurs vrais résultats récents (pondérés : les plus récents
//    comptent davantage, corrigés du terrain), rapprochées de la moyenne pour ne pas sur-réagir à 3 ou 4 matchs.
// 2) Buts attendus, puis loi de Poisson corrigée Dixon-Coles (les petits scores 0-0, 1-0, 1-1 sont mieux estimés).
// 3) Quand le marché existe (cotes), le modèle est calibré dessus : le consensus des bookmakers reste la meilleure
//    information disponible, le modèle sert à l'affiner et à couvrir les marchés que les bookmakers ne cotent pas.
// 4) Chaque marché reçoit une probabilité, une cote juste, et quand une vraie cote existe : avantage (EV) et mise Kelly.

const HOME_F = 1.12, AWAY_F = 0.9; // effet terrain moyen en football
const BASE = 1.35; // buts par équipe et par match (moyenne des grands championnats)
const RHO = -0.08; // correction Dixon-Coles
const N = 10; // scores 0..9
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

const pois = (k, l) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };
const tau = (i, j, lh, la) => (i === 0 && j === 0 ? 1 - lh * la * RHO : i === 0 && j === 1 ? 1 + lh * RHO : i === 1 && j === 0 ? 1 + la * RHO : i === 1 && j === 1 ? 1 - RHO : 1);

export function scoreGrid(lh, la, dc = true) {
  const g = [];
  let s = 0;
  for (let i = 0; i < N; i++) { g.push([]); for (let j = 0; j < N; j++) { const p = pois(i, lh) * pois(j, la) * (dc ? Math.max(0, tau(i, j, lh, la)) : 1); g[i].push(p); s += p; } }
  return g.map((r) => r.map((x) => x / s));
}
const sumG = (g, f) => { let t = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (f(i, j)) t += g[i][j]; return t; };

// Taux neutres (hors effet terrain) d'une équipe, pondérés par la récence et rapprochés de la moyenne.
function rates(games, K = 3) {
  let w = 0, f = 0, a = 0;
  (games || []).slice(0, 15).forEach((g, i) => {
    const wi = Math.pow(0.5, i / 6);
    f += wi * (g.gf / (g.home ? HOME_F : AWAY_F));
    a += wi * (g.ga / (g.home ? AWAY_F : HOME_F));
    w += wi;
  });
  return { att: (f + K * BASE) / (w + K), def: (a + K * BASE) / (w + K), n: (games || []).length };
}

// Buts attendus d'après les données des équipes seules.
export function modelGoals({ gamesH, gamesA, standH, standA }) {
  if (!(gamesH?.length >= 3 && gamesA?.length >= 3)) return null;
  const H = rates(gamesH), A = rates(gamesA);
  let lh = (H.att * A.def) / BASE * HOME_F, la = (A.att * H.def) / BASE * AWAY_F;
  // Niveau de l'adversaire : le classement (points par match) corrige un calendrier facile ou difficile.
  if (standH?.p >= 4 && standA?.p >= 4) {
    const r = clamp(standH.pts / standH.p - standA.pts / standA.p, -2, 2);
    lh *= Math.exp(0.07 * r); la *= Math.exp(-0.07 * r);
  }
  return { lh: clamp(lh, 0.2, 4.5), la: clamp(la, 0.15, 4), nH: H.n, nA: A.n };
}

// Buts attendus qui reproduisent les probabilités du marché (1N2 + ligne de buts si disponible).
export function marketGoals({ pH, pD, pA, line, pOver }) {
  if (!(pH > 0 && pA > 0)) return null;
  const hasD = pD > 0, tot = pH + pA + (hasD ? pD : 0);
  const muList = [];
  if (line != null && pOver > 0 && pOver < 1) {
    // total de buts tel que P(total > ligne) = pOver
    let lo = 0.4, hi = 7;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; const g = scoreGrid(mid / 2, mid / 2); if (sumG(g, (x, y) => x + y > line) < pOver) lo = mid; else hi = mid; }
    muList.push((lo + hi) / 2);
  } else for (let mu = 1.8; mu <= 3.6; mu += 0.15) muList.push(mu);
  let best = null;
  for (const mu of muList) for (let r = 0.15; r <= 7; r *= 1.03) {
    const lh = (mu * r) / (1 + r), la = mu / (1 + r), g = scoreGrid(lh, la);
    const ph = sumG(g, (i, j) => i > j), pa = sumG(g, (i, j) => i < j), pd = sumG(g, (i, j) => i === j);
    const err = hasD ? (ph - pH / tot) ** 2 + (pd - pD / tot) ** 2 + (pa - pA / tot) ** 2 : (ph / (ph + pa) - pH / (pH + pA)) ** 2;
    if (!best || err < best.err) best = { err, lh, la };
  }
  return best;
}

// Mélange log-linéaire des buts attendus (poids w pour le marché).
const mix = (m, x, w) => (m && x ? Math.exp(w * Math.log(m) + (1 - w) * Math.log(x)) : m || x);

// ---------- Marchés ----------
function buildMarkets(lh, la, home, away) {
  const g = scoreGrid(lh, la);
  const P = (f) => sumG(g, f);
  // mi-temps : environ 45 % des buts en 1re période
  const h1 = scoreGrid(lh * 0.45, la * 0.45, false), h2 = scoreGrid(lh * 0.55, la * 0.55, false);
  const sgn = (x) => (x > 0 ? "1" : x < 0 ? "2" : "N");
  const htft = {}; let more1 = 0, more2 = 0, eq = 0;
  for (let a = 0; a < 7; a++) for (let b = 0; b < 7; b++) for (let c = 0; c < 7; c++) for (let d = 0; d < 7; d++) {
    const p = h1[a][b] * h2[c][d];
    const k = sgn(a - b) + "/" + sgn(a + c - b - d);
    htft[k] = (htft[k] || 0) + p;
    if (a + b > c + d) more1 += p; else if (a + b < c + d) more2 += p; else eq += p;
  }
  const H1 = (f) => sumG(h1, f);
  const it = (key, label, p) => ({ key, label, p });
  const scores = [];
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) scores.push({ h: i, a: j, p: g[i][j] });
  scores.sort((x, y) => y.p - x.p);
  const htLab = { "1": home, N: "Nul", "2": away };
  const groups = [
    { id: "1x2", group: "Résultat du match (1N2)", items: [it("1x2:h", home, P((i, j) => i > j)), it("1x2:d", "Match nul", P((i, j) => i === j)), it("1x2:a", away, P((i, j) => i < j))] },
    { id: "dc", group: "Double chance", items: [it("dc:1X", `${home} ou nul`, P((i, j) => i >= j)), it("dc:X2", `${away} ou nul`, P((i, j) => j >= i)), it("dc:12", `${home} ou ${away}`, P((i, j) => i !== j))] },
    { id: "dnb", group: "Remboursé si match nul", items: [it("dnb:h", home, P((i, j) => i > j) / (1 - P((i, j) => i === j))), it("dnb:a", away, P((i, j) => j > i) / (1 - P((i, j) => i === j)))] },
    { id: "tot", group: "Nombre de buts", items: [0.5, 1.5, 2.5, 3.5, 4.5].flatMap((k) => [it(`tot:${k}:over`, `Plus de ${String(k).replace(".", ",")}`, P((i, j) => i + j > k)), it(`tot:${k}:under`, `Moins de ${String(k).replace(".", ",")}`, P((i, j) => i + j < k))]) },
    { id: "btts", group: "Les deux équipes marquent", items: [it("btts:yes", "Oui", P((i, j) => i > 0 && j > 0)), it("btts:no", "Non", P((i, j) => i === 0 || j === 0))] },
    { id: "tth", group: `Buts de ${home}`, items: [0.5, 1.5, 2.5].map((k) => it(`tt:h:${k}`, `Plus de ${String(k).replace(".", ",")}`, P((i) => i > k))) },
    { id: "tta", group: `Buts de ${away}`, items: [0.5, 1.5, 2.5].map((k) => it(`tt:a:${k}`, `Plus de ${String(k).replace(".", ",")}`, P((i, j) => j > k))) },
    { id: "bttsx", group: "Combinés buts", items: [it("combo:btts-o25", "Les 2 marquent + plus de 2,5", P((i, j) => i > 0 && j > 0 && i + j >= 3)), it("combo:nobtts-u25", "Pas les 2 + moins de 2,5", P((i, j) => (i === 0 || j === 0) && i + j <= 2)), it("combo:1-o15", `${home} gagne + plus de 1,5`, P((i, j) => i > j && i + j >= 2)), it("combo:2-o15", `${away} gagne + plus de 1,5`, P((i, j) => j > i && i + j >= 2))] },
    { id: "resbtts", group: "Résultat + les deux marquent", items: [it("rb:h-yes", `${home} et oui`, P((i, j) => i > j && j > 0)), it("rb:d-yes", "Nul et oui", P((i, j) => i === j && i > 0)), it("rb:a-yes", `${away} et oui`, P((i, j) => j > i && i > 0)), it("rb:h-no", `${home} et non`, P((i, j) => i > j && j === 0)), it("rb:a-no", `${away} et non`, P((i, j) => j > i && i === 0))] },
    { id: "wtn", group: "Gagne sans encaisser", items: [it("wtn:h", home, P((i, j) => i > j && j === 0)), it("wtn:a", away, P((i, j) => j > i && i === 0))] },
    { id: "cs", group: "Cage inviolée", items: [it("cs:h", home, P((i, j) => j === 0)), it("cs:a", away, P((i) => i === 0))] },
    { id: "ah", group: "Handicap", items: [it("ah:h:-1.5", `${home} −1,5`, P((i, j) => i - j >= 2)), it("ah:a:+1.5", `${away} +1,5`, P((i, j) => i - j <= 1)), it("ah:a:-1.5", `${away} −1,5`, P((i, j) => j - i >= 2)), it("ah:h:+1.5", `${home} +1,5`, P((i, j) => j - i <= 1))] },
    { id: "margin", group: "Écart de victoire", items: [it("mg:h1", `${home} par 1 but`, P((i, j) => i - j === 1)), it("mg:h2", `${home} par 2 buts`, P((i, j) => i - j === 2)), it("mg:h3", `${home} par 3 ou +`, P((i, j) => i - j >= 3)), it("mg:a1", `${away} par 1 but`, P((i, j) => j - i === 1)), it("mg:a2", `${away} par 2 buts`, P((i, j) => j - i === 2)), it("mg:a3", `${away} par 3 ou +`, P((i, j) => j - i >= 3))] },
    { id: "ht", group: "Mi-temps (1N2)", items: [it("ht:h", home, H1((i, j) => i > j)), it("ht:d", "Nul", H1((i, j) => i === j)), it("ht:a", away, H1((i, j) => i < j))] },
    { id: "ht-tot", group: "Buts en 1re mi-temps", items: [it("htt:0.5:over", "Plus de 0,5", H1((i, j) => i + j >= 1)), it("htt:1.5:over", "Plus de 1,5", H1((i, j) => i + j >= 2)), it("htt:0.5:under", "Aucun but", H1((i, j) => i + j === 0))] },
    { id: "half", group: "Mi-temps la plus prolifique", items: [it("half:1", "1re mi-temps", more1), it("half:2", "2e mi-temps", more2), it("half:eq", "Autant de buts", eq)] },
    { id: "htft", group: "Mi-temps / fin de match", items: Object.entries(htft).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, p]) => { const [a, b] = k.split("/"); return it(`htft:${k}`, `${htLab[a]} / ${htLab[b]}`, p); }) },
    { id: "parity", group: "Total pair ou impair", items: [it("par:even", "Pair (0, 2, 4…)", P((i, j) => (i + j) % 2 === 0)), it("par:odd", "Impair", P((i, j) => (i + j) % 2 === 1))] },
    { id: "cs-exact", group: "Score exact", items: scores.slice(0, 8).map((s) => it(`cs:${s.h}-${s.a}`, `${s.h} – ${s.a}`, s.p)) },
  ];
  for (const gr of groups) for (const x of gr.items) x.fair = x.p > 0.001 ? 1 / x.p : null;
  return { groups, scores, grid: g };
}

const GROUP_RISK = { "cs-exact": 3, htft: 3, margin: 2, resbtts: 2, bttsx: 1, wtn: 1, half: 9, parity: 9, "ht-tot": 1 };

// Sélection des pronos : plus-values réelles d'abord, puis sûrs / équilibrés / audacieux, sur des marchés variés.
function selectPicks(groups, quality) {
  const all = groups.flatMap((g) => g.items.map((x) => ({ ...x, gid: g.id, group: g.group })));
  const used = new Set(), out = [];
  const add = (x, kind) => { if (!x || used.has(x.gid) || out.some((o) => o.key === x.key)) return false; used.add(x.gid); out.push({ ...x, kind }); return true; };
  // pronos trop évidents (cote juste < 1,20) : sans intérêt pour la rentabilité
  const TRIVIAL = new Set(["tot:4.5:under", "tot:0.5:over", "htt:0.5:over", "ah:h:+1.5", "ah:a:+1.5"]);
  // une vraie cote nettement sous la cote juste = perte assurée sur la durée : on ne la met pas en avant
  const ok = (x) => (GROUP_RISK[x.gid] ?? 0) < 9 && x.p < 0.84 && !(TRIVIAL.has(x.key) && x.p > 0.78) && !(x.offer && x.ev < -0.04);
  const vals = all.filter((x) => ok(x) && x.offer && x.value).sort((a, b) => b.ev * Math.sqrt(b.p) - a.ev * Math.sqrt(a.p));
  for (const x of vals) { if (out.length >= 2) break; add(x, "value"); }
  const safe = all.filter((x) => ok(x) && x.p >= 0.7 && (GROUP_RISK[x.gid] ?? 0) <= 1).sort((a, b) => b.p - a.p);
  let k = 0; for (const x of safe) { if (k >= 2) break; if (add(x, "safe")) k++; }
  const mid = all.filter((x) => ok(x) && x.p >= 0.5 && x.p < 0.7 && (GROUP_RISK[x.gid] ?? 0) <= 1).sort((a, b) => b.p - a.p);
  k = 0; for (const x of mid) { if (k >= 2) break; if (add(x, "mid")) k++; }
  const bold = all.filter((x) => ok(x) && x.p >= 0.3 && x.p < 0.5 && (GROUP_RISK[x.gid] ?? 0) <= 2).sort((a, b) => b.p - a.p);
  k = 0; for (const x of bold) { if (k >= 2) break; if (add(x, "bold")) k++; }
  const sc = all.find((x) => x.gid === "cs-exact");
  if (sc) out.push({ ...sc, kind: "score" });
  return out.map((x) => ({ ...x, stars: starsOf(x, quality) }));
}

function starsOf(x, q) {
  let s = 1 + 4 * q; // qualité des données : 1 à 5
  if (x.kind === "bold" || x.kind === "score") s = Math.min(s, 3);
  if (x.kind === "value" && x.ev > 0.15) s -= 1; // avantage trop beau : souvent une erreur de cote
  if (x.p >= 0.7) s += 0.5;
  return clamp(Math.round(s), 1, 5);
}

// Mise Kelly fractionnée (1/4), plafonnée à 3 % de la bankroll.
export const kelly = (p, odds) => { if (!(odds > 1) || !(p > 0)) return 0; const f = (p * odds - 1) / (odds - 1); return f > 0 ? Math.min(0.03, f / 4) : 0; };

/**
 * Analyse complète.
 * @param {object} o
 *   home, away : noms ; gamesH, gamesA : historiques (lib/teamform) ; standH, standA : { pts, p } ;
 *   market : { pH, pD, pA, line, pOver, nBooks } (probabilités sans marge) ;
 *   offer(key) -> { odds, book, fr } | null : vraie cote disponible pour un marché ;
 *   consensus(key) -> probabilité du consensus des bookmakers pour ce marché (si cotée) | null.
 */
export function edgeAnalysis(o) {
  const mdl = modelGoals(o);
  const mkt = o.market ? marketGoals(o.market) : null;
  if (!mdl && !mkt) return null;
  // Poids du marché : très fort quand plusieurs bookmakers, moindre avec une seule source.
  const wm = mkt ? (mdl ? ((o.market.nBooks || 1) >= 3 ? 0.75 : 0.6) : 1) : 0;
  const lh = mix(mkt?.lh, mdl?.lh, wm), la = mix(mkt?.la, mdl?.la, wm);
  const { groups, scores } = buildMarkets(lh, la, o.home, o.away);
  // Probabilité finale : consensus des bookmakers quand le marché est coté, affiné par le modèle.
  for (const g of groups) for (const x of g.items) {
    const c = o.consensus?.(x.key);
    if (c != null && c > 0 && c < 1) { x.model = x.p; x.p = 0.7 * c + 0.3 * x.p; x.fair = 1 / x.p; x.cons = c; }
    const off = o.offer?.(x.key);
    if (off?.odds > 1) {
      x.offer = off;
      x.ev = x.p * off.odds - 1;
      // seuil exigeant : l'avantage doit dépasser l'incertitude du modèle (plus grande sur les grosses cotes)
      const thr = Math.max(0.03, 0.02 + 0.015 * off.odds);
      // historique foot : plus-value rentable seulement sur les cotes 1,30–2,20
      x.value = x.ev >= thr && x.p >= 0.25 && off.odds >= 1.3 && off.odds <= 2.2;
      x.kelly = x.value ? kelly(x.p, off.odds) : 0;
    }
  }
  const nData = (mdl ? Math.min(1, (mdl.nH + mdl.nA) / 20) : 0);
  const quality = clamp(0.15 + 0.45 * nData + (mkt ? ((o.market.nBooks || 1) >= 3 ? 0.4 : 0.25) : 0) + (o.standH && o.standA ? 0.1 : 0), 0, 1);
  const picks = selectPicks(groups, quality);
  const src = mkt && mdl ? `cotes du marché (${Math.round(wm * 100)} %) + historique réel des équipes (${Math.round((1 - wm) * 100)} %)` : mkt ? "cotes du marché uniquement (historique des équipes indisponible)" : "historique réel des équipes (pas de cotes disponibles)";
  const g1 = groups.find((g) => g.id === "1x2").items;
  return {
    lh, la, mu: lh + la, model: mdl, market: mkt, wm, quality, level: quality >= 0.75 ? "élevée" : quality >= 0.5 ? "correcte" : quality >= 0.3 ? "moyenne" : "faible",
    probs: { h: g1[0].p, d: g1[1].p, a: g1[2].p }, groups, scores, picks, source: src,
  };
}
