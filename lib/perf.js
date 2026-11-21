// Calculs de performance (fonctions pures) : bankroll virtuelle, ROI, calibration, bilans hebdomadaires, analyse des erreurs.
export const MIN_N = 20; // en dessous, aucune conclusion forte
const TZ = "Europe/Paris";
export const dayKey = (t) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
export const addDays = (k, n) => { const d = new Date(k + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const weekStart = (k) => { const d = new Date(k + "T12:00:00Z"); const wd = (d.getUTCDay() + 6) % 7; return addDays(k, -wd); };
export const monthKey = (k) => k.slice(0, 7);
const f1 = (x, d = 1) => Number(x).toFixed(d).replace(".", ",");
export const eur = (x, d = 2) => (x > 0 ? "+" : x < 0 ? "−" : "") + f1(Math.abs(x), d) + " €";
export const pc = (x, d = 0) => f1(x * 100, d) + " %";
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export const isSettled = (r) => r.status === "won" || r.status === "lost" || r.status === "void";
export const profitOf = (r, stake) => (r.odds == null ? null : r.status === "won" ? stake * (r.odds - 1) : r.status === "lost" ? -stake : r.status === "void" ? 0 : null);
export const STATUS = { won: "Gagné", lost: "Perdu", void: "Annulé", pending: "En attente" };

export function agg(list, stake) {
  const set = list.filter(isSettled);
  const won = set.filter((r) => r.status === "won").length, lost = set.filter((r) => r.status === "lost").length, voided = set.filter((r) => r.status === "void").length;
  const money = set.filter((r) => r.odds != null);
  const profit = money.reduce((a, r) => a + profitOf(r, stake), 0);
  const staked = money.filter((r) => r.status !== "void").length * stake;
  const wl = set.filter((r) => r.status !== "void" && r.prob != null);
  const avgProb = wl.length ? wl.reduce((a, r) => a + r.prob, 0) / wl.length : null;
  const hit = won + lost ? won / (won + lost) : null;
  const odds = set.filter((r) => r.odds != null);
  return {
    total: list.length, n: set.length, won, lost, voided, pending: list.length - set.length, hit, staked, profit, nMoney: money.length,
    roi: staked ? (profit / staked) * 100 : null, avgOdds: odds.length ? odds.reduce((a, r) => a + r.odds, 0) / odds.length : null,
    avgProb, gap: avgProb != null && hit != null ? avgProb - hit : null,
    brier: wl.length ? wl.reduce((a, r) => a + (r.prob - (r.status === "won" ? 1 : 0)) ** 2, 0) / wl.length : null,
  };
}

export const groupBy = (list, fn) => { const m = new Map(); for (const r of list) { const k = fn(r); if (k == null) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };

export function table(list, fn, stake, today = Date.now()) {
  const rows = [];
  for (const [k, items] of groupBy(list, fn)) {
    const a = agg(items, stake);
    const per = (days) => { const c = items.filter((r) => +new Date(r.start) >= today - days * 86400e3); const x = agg(c, stake); return { n: x.n, roi: x.roi, profit: x.profit }; };
    rows.push({ key: k, ...a, d7: per(7), d30: per(30), d90: per(90), low: a.n < MIN_N });
  }
  return rows.sort((a, b) => b.n - a.n);
}

// Évolution de la bankroll virtuelle (paris réglés avec une vraie cote).
export function bankroll(list, stake, bank0) {
  const money = list.filter((r) => isSettled(r) && r.odds != null).sort((a, b) => String(a.start).localeCompare(String(b.start)));
  let cum = 0, peak = 0, maxDD = 0;
  const pts = [{ t: money[0] ? +new Date(money[0].start) - 3600e3 : Date.now(), y: bank0, label: "Départ" }];
  for (const r of money) {
    cum += profitOf(r, stake);
    peak = Math.max(peak, cum);
    maxDD = Math.max(maxDD, peak - cum);
    pts.push({ t: +new Date(r.start), y: bank0 + cum, label: r.selection });
  }
  return { pts, cum, maxDD };
}

export function dayProfits(list, stake) {
  const m = {};
  for (const r of list) {
    if (!isSettled(r)) continue;
    const k = dayKey(r.start);
    m[k] = m[k] || { profit: 0, n: 0, won: 0, lost: 0 };
    m[k].n++;
    if (r.status === "won") m[k].won++;
    if (r.status === "lost") m[k].lost++;
    const p = profitOf(r, stake);
    if (p != null) m[k].profit += p;
  }
  return m;
}

export function calibration(list) {
  const edges = [0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.01];
  const set = list.filter((r) => (r.status === "won" || r.status === "lost") && r.prob != null);
  return edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1];
    const c = set.filter((r) => r.prob >= lo && r.prob < hi);
    return { lo, hi: Math.min(hi, 1), n: c.length, avgP: c.length ? c.reduce((a, r) => a + r.prob, 0) / c.length : null, hit: c.length ? c.filter((r) => r.status === "won").length / c.length : null };
  });
}

export function clvOf(list) {
  const c = list.filter((r) => isSettled(r) && r.odds != null && r.closeOdds);
  if (!c.length) return { n: 0, avg: null, pos: null };
  const v = c.map((r) => r.odds / r.closeOdds - 1);
  return { n: c.length, avg: v.reduce((a, b) => a + b, 0) / v.length, pos: v.filter((x) => x > 0).length / v.length };
}

export function weeksOf(list, stake) {
  const out = [];
  for (const [w, items] of groupBy(list, (r) => weekStart(dayKey(r.start)))) out.push({ week: w, ...agg(items, stake), items });
  return out.sort((a, b) => b.week.localeCompare(a.week));
}

// Score de fiabilité à long terme : jamais le seul taux de réussite ; composantes visibles.
export function reliability(list, stake) {
  const a = agg(list, stake);
  const comps = [];
  if (a.nMoney < 30) return { score: null, level: "Données insuffisantes", why: `${a.nMoney} pronostic(s) réglé(s) avec une vraie cote : il en faut au moins 30 pour mesurer la fiabilité.`, comps, n: a.nMoney };
  comps.push({ k: "ROI historique", w: 0.3, v: clamp(50 + a.roi * 2.5, 0, 100), d: `ROI ${f1(a.roi)} %` });
  const cal = calibration(list).filter((b) => b.n >= 5);
  if (cal.length) { const tot = cal.reduce((x, b) => x + b.n, 0); const ece = cal.reduce((x, b) => x + (b.n / tot) * Math.abs(b.avgP - b.hit), 0); comps.push({ k: "Calibration des probabilités", w: 0.2, v: clamp(100 - ece * 400, 0, 100), d: `écart moyen ${f1(ece * 100)} pts entre probabilité annoncée et réalité` }); }
  comps.push({ k: "Nombre de pronostics", w: 0.15, v: clamp((a.nMoney / 300) * 100, 0, 100), d: `${a.nMoney} réglés (300 = maximum)` });
  const wk = weeksOf(list, stake).filter((w) => w.nMoney >= 5);
  if (wk.length >= 3) comps.push({ k: "Stabilité (semaines positives)", w: 0.15, v: (wk.filter((w) => w.profit > 0).length / wk.length) * 100, d: `${wk.filter((w) => w.profit > 0).length} semaine(s) positive(s) sur ${wk.length}` });
  const mk = table(list, (r) => r.cat, stake).filter((t) => t.n >= 15);
  if (mk.length) comps.push({ k: "Performance par marché", w: 0.1, v: (mk.filter((t) => t.roi != null && t.roi >= -5).length / mk.length) * 100, d: `${mk.filter((t) => t.roi != null && t.roi >= -5).length} marché(s) sur ${mk.length} au-dessus de −5 % de ROI` });
  const clv = clvOf(list);
  if (clv.n >= 20) comps.push({ k: "Closing Line Value", w: 0.1, v: clamp(50 + clv.avg * 500, 0, 100), d: `CLV moyen ${f1(clv.avg * 100)} % sur ${clv.n} pronostics` });
  const W = comps.reduce((x, c) => x + c.w, 0);
  const score = Math.round(comps.reduce((x, c) => x + c.v * c.w, 0) / W);
  return { score, level: score >= 75 ? "Solide" : score >= 55 ? "Encourageant" : score >= 40 ? "Incertain" : "Insuffisant", why: "", comps, n: a.nMoney };
}

// ---------- Textes d'analyse (calculés à partir des données, sans invention) ----------
export const verdictOf = (net) => (net > 0 ? { k: "pos", label: "Semaine positive" } : net < 0 ? { k: "neg", label: "Semaine négative" } : { k: "eq", label: "Semaine à l'équilibre" });

const best = (rows, key = "profit") => rows.filter((r) => r.nMoney >= 3).sort((a, b) => b[key] - a[key])[0];
const worst = (rows, key = "profit") => rows.filter((r) => r.nMoney >= 3).sort((a, b) => a[key] - b[key])[0];

export function explain(list, stake, ctx = {}) {
  const a = agg(list, stake);
  const out = [];
  if (a.nMoney === 0) return ["Aucun pronostic réglé avec une vraie cote sur cette période : pas encore d'analyse possible."];
  const sp = table(list, (r) => (ctx.sportLabel ? ctx.sportLabel(r.sport) : r.sport), stake), mkt = table(list, (r) => r.cat, stake);
  const bs = best(sp), ws = worst(sp), bm = best(mkt), wm = worst(mkt);
  if (bs && bs.profit > 0) out.push(`Sport le plus rentable : ${bs.key} (${eur(bs.profit)} sur ${bs.nMoney} paris).`);
  if (ws && ws.profit < 0 && ws.key !== bs?.key) out.push(`Sport le moins rentable : ${ws.key} (${eur(ws.profit)} sur ${ws.nMoney} paris).`);
  if (bm && bm.profit > 0) out.push(`Marché le plus performant : ${bm.key} (${eur(bm.profit)}, réussite ${bm.hit != null ? pc(bm.hit) : "—"}).`);
  if (wm && wm.profit < 0 && wm.key !== bm?.key) out.push(`Marché le moins performant : ${wm.key} (${eur(wm.profit)}, réussite ${wm.hit != null ? pc(wm.hit) : "—"}).`);
  const vb = agg(list.filter((r) => r.value != null && r.value >= 0.03), stake), nv = agg(list.filter((r) => r.value == null || r.value < 0.03), stake);
  if (vb.nMoney >= 5) out.push(`Value bets (value ≥ 3 %) : ${eur(vb.profit)} sur ${vb.nMoney} paris (ROI ${f1(vb.roi)} %)${nv.nMoney >= 5 ? `, contre ${f1(nv.roi)} % pour les autres pronostics` : ""}. ${vb.profit > 0 ? "Les value bets ont généré de la rentabilité sur cette période." : "Les value bets n'ont pas encore généré de rentabilité sur cette période."}`);
  else out.push("Value bets : trop peu de paris réglés sur la période pour juger leur rentabilité.");
  if (a.gap != null && a.n >= 10) {
    const g = a.gap * 100;
    out.push(`Probabilités annoncées : ${pc(a.avgProb)} en moyenne pour ${pc(a.hit)} de réussite réelle — ${Math.abs(g) < 6 ? "cohérent" : g > 0 ? "le modèle a été trop optimiste" : "le modèle a été trop prudent"} (écart de ${f1(Math.abs(g))} pts).`);
  } else out.push("Probabilités annoncées : trop peu de paris réglés pour mesurer leur cohérence.");
  if (a.n < 30) out.push(`Échantillon de ${a.n} paris seulement : une part importante du résultat vient du hasard, aucune conclusion définitive ne peut en être tirée.`);
  return out;
}

// Pourquoi un pronostic a-t-il échoué ? Raisons déduites uniquement des données enregistrées.
export function lossReasons(r) {
  const out = [];
  const parts = String(r.score || "").split("-").map(Number);
  const tot = parts.length === 2 && parts.every(Number.isFinite) ? parts[0] + parts[1] : null;
  if (r.prob != null) out.push(r.prob >= 0.65 ? `Pari jugé très probable (${pc(r.prob)}) : l'issue contraire se produit tout de même environ ${Math.round((1 - r.prob) * 100)} fois sur 100.` : `Probabilité annoncée ${pc(r.prob)} : l'échec était un scénario courant (${Math.round((1 - r.prob) * 100)} %).`);
  if (r.value != null && r.value >= 0.1) out.push(`Value annoncée élevée (+${f1(r.value * 100)} %) : possible surestimation de la probabilité par rapport au marché.`);
  else if (r.value != null && r.value < 0.02) out.push("La cote n'offrait pas d'avantage de prix : pari sans value.");
  if (r.odds != null && r.odds < 1.4) out.push(`Cote basse (${f1(r.odds, 2)}) : une seule défaite efface plusieurs gains.`);
  const rl = r.rule || {};
  if (rl.t === "tot" && tot != null && rl.u !== "sets") out.push(rl.s === "over" ? `Rencontre moins prolifique que prévu : ${tot} ${rl.u} pour une ligne à ${f1(rl.p)}.` : `Rencontre plus ouverte que prévu : ${tot} ${rl.u} pour une ligne à ${f1(rl.p)}.`);
  if (rl.t === "h2h" && rl.s === "away" && (r.prob || 0) >= 0.5) out.push("Favori en déplacement battu : le modèle peut surestimer les équipes à l'extérieur.");
  if (rl.t === "h2h" && rl.s === "home" && (r.prob || 0) >= 0.6) out.push("Favori à domicile battu : l'avantage du terrain a été trop pesé.");
  if (rl.t === "scorer") out.push("Les buteurs restent un marché très aléatoire : même à 40 % de probabilité, l'échec est le cas le plus fréquent.");
  if (rl.t === "btts") out.push(rl.y ? "Au moins une équipe n'a pas marqué." : "Les deux équipes ont marqué.");
  if (r.rel != null && r.rel <= 2) out.push(`Fiabilité annoncée faible (${r.rel}/5) : le signal n'était pas solide.`);
  out.push("Blessures et compositions : non intégrées au modèle actuel, leur influence ne peut pas être mesurée.");
  return out;
}

// Erreurs récurrentes : catégories où la probabilité annoncée dépasse nettement la réalité (au moins 10 paris).
export function recurring(list) {
  const kinds = [
    ["Favoris à domicile", (r) => r.rule?.t === "h2h" && r.rule.s === "home" && r.prob >= 0.5],
    ["Favoris à l'extérieur", (r) => r.rule?.t === "h2h" && r.rule.s === "away" && r.prob >= 0.5],
    ["Paris « Plus de » (totaux)", (r) => r.rule?.t === "tot" && r.rule.s === "over"],
    ["Paris « Moins de » (totaux)", (r) => r.rule?.t === "tot" && r.rule.s === "under"],
    ["Buteurs", (r) => r.rule?.t === "scorer"],
    ["Les deux équipes marquent", (r) => r.rule?.t === "btts"],
    ["Handicaps", (r) => r.rule?.t === "spr"],
    ["Paris à forte value (≥ 10 %)", (r) => r.value != null && r.value >= 0.1],
    ["Cotes supérieures à 2,50", (r) => r.odds != null && r.odds > 2.5],
  ];
  const out = [];
  for (const [name, f] of kinds) {
    const c = list.filter((r) => (r.status === "won" || r.status === "lost") && r.prob != null && f(r));
    if (c.length < 10) continue;
    const hit = c.filter((r) => r.status === "won").length / c.length, p = c.reduce((a, r) => a + r.prob, 0) / c.length;
    if (p - hit >= 0.1) out.push({ name, n: c.length, p, hit, gap: p - hit });
  }
  return out.sort((a, b) => b.gap - a.gap);
}

export function weeklyReport(items, stake, ctx = {}) {
  const a = agg(items, stake);
  const v = verdictOf(a.profit);
  const money = items.filter((r) => isSettled(r) && r.odds != null);
  const wins = money.filter((r) => r.status === "won").sort((x, y) => (y.odds - 1) - (x.odds - 1)).slice(0, 5);
  const loses = money.filter((r) => r.status === "lost").sort((x, y) => (y.prob || 0) - (x.prob || 0)).slice(0, 5);
  const mk = table(items, (r) => r.cat, stake).filter((t) => t.nMoney >= 3);
  const good = mk.filter((t) => t.profit > 0).sort((x, y) => y.profit - x.profit).slice(0, 3);
  const watch = mk.filter((t) => t.profit < 0).sort((x, y) => x.profit - y.profit).slice(0, 3);
  const reco = [];
  for (const e of recurring(items).slice(0, 2)) reco.push(`${e.name} : probabilité annoncée ${pc(e.p)} pour ${pc(e.hit)} de réussite sur ${e.n} paris — revoir ce calcul avant d'en conclure quoi que ce soit.`);
  if (a.n < 30) reco.push("Ne modifier aucun paramètre du modèle à partir de si peu de paris : attendre un échantillon plus grand (au moins 30 paris réglés par catégorie).");
  else reco.push("Aucun changement automatique du modèle : toute évolution doit être validée sur des données indépendantes (voir « Amélioration continue »).");
  const concl = a.nMoney === 0
    ? "Aucun pronostic réglé avec une vraie cote sur cette période : pas de conclusion possible."
    : `FightEdge termine cette période avec un résultat théorique de ${eur(a.profit)} (mise de ${f1(stake, 0)} € par pari, ROI ${a.roi != null ? f1(a.roi) : "—"} %) sur ${a.nMoney} pronostics réglés, soit ${a.hit != null ? pc(a.hit) : "—"} de réussite. ${good[0] ? `Marché le plus performant : ${good[0].key} (${eur(good[0].profit)}). ` : ""}${watch[0] ? `Marché à surveiller : ${watch[0].key} (${eur(watch[0].profit)}). ` : ""}${a.n < 30 ? "L'échantillon reste petit : la part du hasard est importante." : ""}`.trim();
  return { a, v, wins, loses, good, watch, reco, concl, why: explain(items, stake, ctx) };
}
