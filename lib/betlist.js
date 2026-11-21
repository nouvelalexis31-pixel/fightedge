import { setsLine } from "./setline.js";
import { pt } from "@/lib/format";

const N = 9;
const fact = (n) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
const pois = (k, l) => Math.exp(-l) * Math.pow(l, k) / fact(k);
const grid = (lh, la) => {
  const g = []; let s = 0;
  for (let i = 0; i < N; i++) { g.push([]); for (let j = 0; j < N; j++) { const v = pois(i, lh) * pois(j, la); g[i].push(v); s += v; } }
  return g.map((r) => r.map((x) => x / s));
};
const prob = (g, f) => { let t = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (f(i, j)) t += g[i][j]; return t; };
const P0 = (p) => `${Math.round(p * 100)} %`;
const F1 = (x) => Number(x).toFixed(1).replace(".", ",");
const pp = (o) => (o?.probAdj ?? o?.prob ?? null);

function flames(p) { return p >= 0.75 ? 3 : p >= 0.62 ? 2 : p >= 0.5 ? 1 : 0; }

function finish(groups) {
  return groups.map((g) => {
    const items = g.items.sort((a, b) => b.p - a.p).map((it, i) => ({ ...it, fair: 1 / it.p, flames: Math.max(flames(it.p), g.flameTop && i === 0 && it.p >= 0.3 ? 1 : 0) }));
    if (!items.length) return null;
    const os = items.map((it) => it.best?.odds ?? it.fair);
    return { title: g.title, items, lo: Math.min(...os), hi: Math.max(...os) };
  }).filter(Boolean);
}

// ---------------- Football ----------------
function football(m, ex, h2h) {
  const mo = m.model;
  if (mo?.kind !== "goals") return null;
  const g = grid(mo.lh, mo.la);
  const H = m.home, A = m.away;
  const f = m.form;
  const rH = f?.l10H || [], rA = f?.l10A || [];
  const cnt = (r, fn) => r.filter(fn).length;
  const hasH = rH.length >= 5, hasA = rA.length >= 5;
  const oH = m.outcomes.find((o) => o.name === H), oA = m.outcomes.find((o) => o.name === A), oD = m.outcomes.find((o) => o.name === "Match nul");
  const pHw = pp(oH), pAw = pp(oA), pDw = pp(oD);
  const standTxt = (side) => { const s = side === "h" ? f?.standH : f?.standA; return s ? `${s.pos}${s.pos === 1 ? "er" : "e"} sur ${s.of}` : null; };
  const book = (o) => o?.best || null;

  const cands = []; // {group, label, p, pred, best, why, pri}
  const add = (c) => cands.push(c);

  // --- Résultat
  const res = [
    { label: `${H} gagne`, p: pHw ?? prob(g, (i, j) => i > j), pred: (i, j) => i > j, best: book(oH), side: "h", o: oH },
    { label: "Match nul", p: pDw ?? prob(g, (i, j) => i === j), pred: (i, j) => i === j, best: book(oD), side: "d", o: oD },
    { label: `${A} gagne`, p: pAw ?? prob(g, (i, j) => i < j), pred: (i, j) => i < j, best: book(oA), side: "a", o: oA },
  ].filter((x) => x.p != null).sort((a, b) => b.p - a.p);
  const top = res[0];
  const winWhy = (side, p) => {
    const T = side === "h" ? H : A, r = side === "h" ? rH : rA, O = side === "h" ? A : H;
    const w = [`Les bookmakers lui donnent ${P0(p)} de chances de l'emporter.`];
    if (r.length >= 5) w.push(`${T} a gagné ${cnt(r, (x) => x.w === "V")} de ses ${r.length} derniers matchs.`);
    const st = standTxt(side), so = standTxt(side === "h" ? "a" : "h");
    if (st && so && f.standH.comp === f.standA.comp) w.push(`Au classement : ${T} ${st}, ${O} ${so}.`);
    return w.join(" ");
  };
  if (top.side === "d") {
    const w = [`Les bookmakers donnent ${P0(top.p)} au nul, le résultat le plus probable.`];
    if (hasH && hasA) w.push(`${cnt(rH, (x) => x.w === "N")} des ${rH.length} derniers matchs de ${H} et ${cnt(rA, (x) => x.w === "N")} des ${rA.length} de ${A} se sont terminés par un nul.`);
    add({ group: "Résultat", label: top.label, p: top.p, pred: top.pred, best: top.best, why: w.join(" "), pri: 3 });
  } else {
    add({ group: "Résultat", label: top.label, p: top.p, pred: top.pred, best: top.best, why: winWhy(top.side, top.p), pri: 3 });
    const dnb = (ex.dnb || []).find((x) => x.name === (top.side === "h" ? H : A));
    const pd = pDw ?? prob(g, (i, j) => i === j);
    add({ group: "Résultat", label: `${top.side === "h" ? H : A} gagne, remboursé si nul`, p: top.p / (1 - pd) > 0.97 ? 0.97 : top.p / (1 - pd), pred: top.pred, best: dnb?.best || null, why: `Même pari, mais la mise est remboursée en cas de nul (${P0(pd)} de chances de nul).`, pri: 2 });
  }
  const favSide = top.side === "d" ? (res[1].side) : top.side;
  const fav = favSide === "h" ? H : A;
  const favr = favSide === "h" ? rH : rA;

  // --- Double chance
  const dcb = (label) => (ex.dc || []).find((x) => x.name === label)?.best || null;
  const pdc = prob(g, favSide === "h" ? (i, j) => i >= j : (i, j) => j >= i);
  add({
    group: "Double chance", label: `${fav} ou nul`, p: pdc, pred: favSide === "h" ? (i, j) => i >= j : (i, j) => j >= i, best: dcb(`${fav} ou nul`),
    why: favr.length >= 5 ? (cnt(favr, (x) => x.w === "D") === 0 ? `${fav} est invaincu sur ses ${favr.length} derniers matchs.` : `${fav} n'a perdu que ${cnt(favr, (x) => x.w === "D")} de ses ${favr.length} derniers matchs.`) : `Notre modèle lui donne ${P0(pdc)} de chances de ne pas perdre.`, pri: 2,
  });
  const pdc2 = prob(g, (i, j) => i !== j);
  add({ group: "Double chance", label: `${H} ou ${A}`, p: pdc2, pred: (i, j) => i !== j, best: dcb(`${H} ou ${A}`), why: `Seulement ${P0(1 - pdc2)} de chances de nul d'après notre modèle${hasH && hasA ? ` ; ${cnt(rH, (x) => x.w === "N")} nuls sur les ${rH.length} derniers matchs de ${H}, ${cnt(rA, (x) => x.w === "N")} sur ${rA.length} pour ${A}` : ""}.`, pri: 1 });

  // --- Plus / Moins de buts
  const share = (r, k, over) => (r.length >= 5 ? cnt(r, (x) => (over ? x.gf + x.ga > k : x.gf + x.ga < k)) : null);
  const dirOver = prob(g, (i, j) => i + j > 2.5) >= 0.5;
  for (const k of [0.5, 1.5, 2.5, 3.5, 4.5]) {
    const po = prob(g, (i, j) => i + j > k);
    for (const over of [true, false]) {
      const p = over ? po : 1 - po;
      if (p < 0.55 || p > 0.9) continue;
      if (over !== dirOver && p < 0.8) continue;
      const t = (m.totals || []).find((x) => x.point === k);
      const best = t ? (over ? t.over.best : t.under.best) : null;
      const why = [];
      const sH = share(rH, k, over), sA = share(rA, k, over);
      if (sH != null && sA != null) why.push(`${H} a vu ${over ? "plus" : "moins"} de ${pt(k)} buts dans ${sH} de ses ${rH.length} derniers matchs, ${A} dans ${sA} de ses ${rA.length}.`);
      why.push(`Notre modèle attend ${F1(mo.mu)} buts (${F1(mo.lh)} pour ${H}, ${F1(mo.la)} pour ${A}).`);
      add({ group: "Plus / Moins de buts", label: `${over ? "Plus" : "Moins"} de ${pt(k)} buts`, p, pred: over ? (i, j) => i + j > k : (i, j) => i + j < k, best, why: why.join(" "), pri: 1 });
    }
  }

  // --- Les deux équipes marquent
  const pb = prob(g, (i, j) => i > 0 && j > 0);
  {
    const yes = pb >= 0.5;
    const p = yes ? pb : 1 - pb;
    const b = (ex.btts || []).find((x) => x.name === (yes ? "Oui" : "Non"))?.best || null;
    const w = [];
    if (hasH && hasA) {
      const bh = cnt(rH, (x) => x.gf > 0 && x.ga > 0), ba = cnt(rA, (x) => x.gf > 0 && x.ga > 0);
      w.push(yes ? `Les deux équipes ont marqué dans ${bh} des ${rH.length} derniers matchs de ${H} et ${ba} des ${rA.length} de ${A}.` : `Les deux équipes n'ont marqué que dans ${bh} des ${rH.length} derniers matchs de ${H} et ${ba} des ${rA.length} de ${A}.`);
    }
    w.push(`Notre modèle : ${P0(p)} de chances.`);
    add({ group: "Les deux équipes marquent", label: yes ? "Les deux équipes marquent" : "Une équipe ne marque pas", p, pred: yes ? (i, j) => i > 0 && j > 0 : (i, j) => i === 0 || j === 0, best: b, why: w.join(" "), pri: 1 });
  }

  // --- Buts par équipe
  for (const [side, T, r, key] of [["h", H, rH, "gf"], ["a", A, rA, "gf"]]) {
    const sc = side === "h" ? (i) => i : (i, j) => j;
    const conc = side === "h" ? (i, j) => j : (i) => i;
    const p1 = prob(g, (i, j) => sc(i, j) >= 1), p2 = prob(g, (i, j) => sc(i, j) >= 2);
    const cs = prob(g, (i, j) => conc(i, j) === 0);
    if (p1 >= 0.62) add({ group: "Buts par équipe", label: `${T} marque au moins un but`, p: p1, pred: (i, j) => sc(i, j) >= 1, best: null, why: r.length >= 5 ? `${T} a marqué dans ${cnt(r, (x) => x.gf > 0)} de ses ${r.length} derniers matchs.` : `Notre modèle lui donne ${P0(p1)} de chances de marquer.`, pri: 1 });
    if (p2 >= 0.5) add({ group: "Buts par équipe", label: `${T} marque plus de 1,5 but`, p: p2, pred: (i, j) => sc(i, j) >= 2, best: null, why: r.length >= 5 ? `${T} a marqué 2 buts ou plus dans ${cnt(r, (x) => x.gf >= 2)} de ses ${r.length} derniers matchs.` : `Notre modèle attend ${F1(side === "h" ? mo.lh : mo.la)} but pour ${T}.`, pri: 1 });
    if (cs >= 0.4) {
      const O = side === "h" ? A : H, ro = side === "h" ? rA : rH;
      add({ group: "Buts par équipe", label: `${O} ne marque pas`, p: cs, pred: (i, j) => conc(i, j) === 0, best: null, why: ro.length >= 5 ? `${O} n'a pas marqué dans ${cnt(ro, (x) => x.gf === 0)} de ses ${ro.length} derniers matchs.` : `Notre modèle : ${P0(cs)} de chances.`, pri: 0 });
    }
  }

  // --- Résultat + buts
  for (const k of [2.5, 3.5]) {
    const pw = favSide === "h" ? (i, j) => i > j : (i, j) => j > i;
    const pu = prob(g, (i, j) => pw(i, j) && i + j < k), po = prob(g, (i, j) => pw(i, j) && i + j > k);
    if (pu >= 0.4) add({ group: "Résultat + buts", label: `${fav} gagne et moins de ${pt(k)} buts`, p: pu, pred: (i, j) => pw(i, j) && i + j < k, best: null, why: `Combiné estimé par notre modèle : ${P0(pu)} de chances.`, pri: 0 });
    if (po >= 0.4) add({ group: "Résultat + buts", label: `${fav} gagne et plus de ${pt(k)} buts`, p: po, pred: (i, j) => pw(i, j) && i + j > k, best: null, why: `Combiné estimé par notre modèle : ${P0(po)} de chances.`, pri: 0 });
  }

  return { cands, g };
}

// compatibilité : on garde un pari seulement si, avec chaque pari déjà retenu, ils peuvent se produire ensemble
function pick(cands, g) {
  const sorted = cands.slice().sort((a, b) => b.pri - a.pri || b.p - a.p);
  const kept = [];
  for (const c of sorted) {
    let ok = true;
    for (const b of kept) {
      const j = prob(g, (i, k) => c.pred(i, k) && b.pred(i, k));
      if (j / Math.min(c.p, b.p) < 0.5) { ok = false; break; }
    }
    if (ok) kept.push(c);
  }
  return kept;
}

// ---------------- Autres sports ----------------
function generic(m) {
  const items = [];
  const out = m.outcomes.filter((o) => pp(o) != null).sort((a, b) => pp(b) - pp(a));
  if (!out.length) return null;
  const top = out[0];
  const fav = top.name === "Match nul" ? out[1] : top;
  const res = [{ title: "Résultat", items: [{ label: top.name === "Match nul" ? "Match nul" : `${top.name} gagne`, p: pp(top), best: top.best || null, why: `Les bookmakers lui donnent ${P0(pp(top))} de chances.` }] }];
  const isHome = fav && fav.name === m.home;
  const mo = m.model;
  const groups = [...res];
  const favName = fav?.name;
  let setsPicked = null;
  if (mo?.kind === "sets") {
    const mk = (n) => mo.markets.find((x) => x.group === n);
    const ns = mk("Nombre de sets")?.items.slice().sort((a, b) => b.p - a.p)[0];
    if (ns && ns.p >= 0.4) setsPicked = parseInt(ns.label, 10);
    const sl = (setsLine(mo) || []).filter((x) => x.p >= 0.5);
    if (sl.length) groups.push({ title: "Nombre de sets", items: sl.map((x) => ({ label: x.label, p: x.p, best: null, why: `Notre modèle (${P0(x.p)}) : ${x.hint}, d'après l'écart de niveau entre les deux joueurs${mo.pDecider ? ` ; ${P0(mo.pDecider)} de chances d'aller au set décisif` : ""}.` })) });
    const sc = (mk("Score en sets")?.items || []).filter((x) => favName && x.label.startsWith(favName) && (!setsPicked || Number(x.label.match(/(\d)-(\d)/)?.[1]) + Number(x.label.match(/(\d)-(\d)/)?.[2]) === setsPicked) && x.p >= 0.15);
    if (sc.length) groups.push({ title: "Score en sets", items: sc.map((x) => ({ label: x.label, p: x.p, best: null, why: `Estimé par notre modèle : ${P0(x.p)} de chances.` })) });
    const fs = mk("Vainqueur du 1er set")?.items.find((x) => x.label === favName);
    if (fs && fs.p >= 0.55) groups.push({ title: "1er set", items: [{ label: `${favName} gagne le 1er set`, p: fs.p, best: null, why: `Le favori prend le 1er set dans ${P0(fs.p)} des cas d'après notre modèle.` }] });
  }
  const unit = m.sport === "tennis" ? "jeux" : m.sport === "basketball" ? "points" : m.sport === "baseball" ? "points" : m.sport === "hockey" ? "buts" : "points";
  const tl = [];
  for (const t of m.totals || []) {
    for (const over of [true, false]) {
      const s = over ? t.over : t.under;
      const p = pp(s), q = pp(over ? t.under : t.over);
      if (p == null || p < 0.5 || p > 0.9 || (q != null && (q > p || (q === p && !over)))) continue;
      tl.push({ label: `${over ? "Plus" : "Moins"} de ${pt(t.point)} ${unit}`, p, best: s.best || null, why: `Moyenne des bookmakers : ${P0(p)} sur cette ligne${s.sd != null && s.sd < 0.03 ? ", très consensuelle" : ""}.`, over, point: t.point });
    }
  }
  if (tl.length) groups.push({ title: m.sport === "tennis" ? "Total de jeux" : "Plus / Moins", items: tl });
  const sl = [];
  for (const s of m.spreads || []) {
    for (const side of ["home", "away"]) {
      const x = s[side]; const p = pp(x), q = pp(s[side === "home" ? "away" : "home"]);
      if (p == null || p < 0.5 || p > 0.9 || (q != null && (q > p || (q === p && side === "away")))) continue;
      const team = side === "home" ? m.home : m.away;
      const pointV = side === "home" ? s.point : -s.point;
      sl.push({ label: `${team} ${pointV > 0 ? "+" : "−"}${pt(Math.abs(pointV))} ${unit === "jeux" ? "jeux" : ""}`.trim(), p, best: x.best || null, why: `Moyenne des bookmakers : ${P0(p)} sur ce handicap.`, team, pointV });
    }
  }
  if (sl.length) groups.push({ title: "Handicap", items: sl });
  return { groups, favName };
}

function scorerGroup(m, ex, blocked) {
  const sc = (ex.scorers || []).filter((e) => e.best);
  if (!sc.length || ex.scorersOnlyOthers || blocked) return null;
  const odd = (x) => Number(x).toFixed(2).replace(".", ",");
  const verb = ex.scorerKind === "try" ? "marque un essai" : "marque";
  const items = sc.map((e) => {
    const ref = e.other?.price ?? e.best.odds;
    const p = Math.min(0.75, 0.93 / ref);
    return { label: `${e.name} ${verb}`, p, best: e.best, why: `Un des joueurs que les bookmakers voient le plus souvent marquer (cote ${odd(e.best.odds)} chez ${e.best.book}).` };
  }).filter((x) => x.p >= 0.18).sort((a, b) => b.p - a.p).slice(0, 4);
  return items.length ? { title: ex.scorerKind === "try" ? "Marqueurs d'essai à suivre" : "Buteurs à suivre", items, flameTop: true } : null;
}

export function betGroups(m, ex = {}, h2h = []) {
  try {
    if (m.sport === "football") {
      const r = football(m, ex, h2h);
      if (r) {
        const kept = pick(r.cands, r.g);
        const order = ["Résultat", "Double chance", "Plus / Moins de buts", "Les deux équipes marquent", "Buts par équipe", "Résultat + buts"];
        const gs = order.map((t) => ({ title: t, items: kept.filter((c) => c.group === t).map((c) => ({ label: c.label, p: c.p, best: c.best, why: c.why })) }));
        const sg = scorerGroup(m, ex, kept.some((c) => c.group === "Buts par équipe" && /ne marque pas$/.test(c.label)));
        if (sg) gs.splice(5, 0, sg);
        return finish(gs);
      }
    }
    const r = generic(m);
    if (!r) return [];
    // cohérence : pas de handicap contre le favori du résultat, une seule ligne ne peut pas être "plus" et "moins"
    for (const g of r.groups) {
      if (g.title === "Handicap" && r.favName) {
        g.items = g.items.filter((x) => (x.team === r.favName ? true : x.pointV > 0));
      }
    }
    const sg = scorerGroup(m, ex, false);
    if (sg) r.groups.push(sg);
    return finish(r.groups.filter((g) => g.items.length));
  } catch (e) {
    return [];
  }
}
