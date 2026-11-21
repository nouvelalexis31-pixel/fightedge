// « Pourquoi ce choix ? » : justification lisible d'un prono, construite uniquement sur des données réelles
// (forme récente, domicile / extérieur, jours de repos, classement, avis des bookmakers, prix).
import { odd, pct, signed } from "./format.js";

const f1 = (x) => Number(x).toFixed(1).replace(".", ",");
const ptsOf = (rs) => rs.reduce((s, r) => s + (r.w === "V" ? 3 : r.w === "N" ? 1 : 0), 0);
const wins = (rs) => rs.filter((r) => r.w === "V").length;
const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;
const DAY = 86400e3;

// Côté du pari : "h" (équipe à domicile), "a" (à l'extérieur) ou null (nul, buts…).
export function sideOf(m, c) {
  const n = String(c.o?.name || c.label || "");
  const hasH = n.includes(m.home), hasA = n.includes(m.away);
  if (c.market === "spreads") return c.side === "home" ? "h" : "a";
  if (["h2h", "dnb"].includes(c.market)) return n === m.home ? "h" : n === m.away ? "a" : null;
  if (c.market === "dc") return hasH && !hasA ? "h" : hasA && !hasH ? "a" : null;
  return null;
}

function formFacts(m) {
  const f = m.form;
  if (!f?.home || !f?.away) return null;
  const L = (rs) => (rs || []).slice(0, 5);
  const h5 = L(f.l10H), a5 = L(f.l10A);
  const homeAtHome = (f.l10H || []).filter((r) => r.home).slice(0, 5), awayAway = (f.l10A || []).filter((r) => !r.home).slice(0, 5);
  const lastDate = (rs) => (rs || []).map((r) => r.date).filter(Boolean).sort().pop();
  const t0 = +new Date(m.start);
  const rest = (rs) => { const d = lastDate(rs); return d ? Math.floor((t0 - +new Date(d)) / DAY) : null; };
  return {
    h: { name: m.home, s: f.home, last5: h5, venue: homeAtHome, rest: rest(f.l10H), st: f.standH },
    a: { name: m.away, s: f.away, last5: a5, venue: awayAway, rest: rest(f.l10A), st: f.standA },
  };
}

/** Phrases de justification pour un candidat de pari (lib/analysis candidates) */
export function whyLines(m, c) {
  const o = c.o, out = [];
  const side = sideOf(m, c);
  const F = m.sport === "football" ? formFacts(m) : null;
  const me = side && F ? F[side] : null, op = side && F ? F[side === "h" ? "a" : "h"] : null;

  // 1) Ce que disent les bookmakers, et pourquoi
  const because = [];
  if (me && op) {
    const pm = ptsOf(me.last5), po = ptsOf(op.last5);
    if (pm >= po + 3) because.push(`${me.name} est plus en forme (${plural(wins(me.last5), "victoire")} sur ses ${me.last5.length} derniers matchs contre ${wins(op.last5)} pour ${op.name})`);
    if (me.st && op.st && me.st.comp === op.st.comp && me.st.pos + 3 <= op.st.pos) because.push(`est mieux classé (${me.st.pos}e contre ${op.st.pos}e)`);
    if (side === "h" && me.venue.length >= 3 && ptsOf(me.venue) / me.venue.length >= 2) because.push(`est solide à domicile (${ptsOf(me.venue)} pts sur ${me.venue.length * 3} lors de ses derniers matchs à la maison)`);
    if (side === "a" && op.venue.length >= 3 && ptsOf(op.venue) / op.venue.length <= 1) because.push(`${op.name} peine à domicile (${ptsOf(op.venue)} pts sur ${op.venue.length * 3})`);
  }
  const nb = c.nBooks || m.nBooks;
  if (o.prob != null && nb) {
    const fav = side && ["h2h", "dnb"].includes(c.market) && o.prob >= 0.45;
    const head = fav
      ? `La plupart des bookmakers (${nb} analysés) donnent ${side === "h" ? m.home : m.away} gagnant, à ${pct(o.prob)}`
      : `Le consensus de ${nb} bookmaker${nb > 1 ? "s" : ""} estime cette issue à ${pct(o.prob)}`;
    out.push(head + (because.length ? `, car ${because.join(", ")}.` : "."));
  } else if (because.length) out.push(`${because.join(", ")}.`.replace(/^./, (x) => x.toUpperCase()));

  // 1 bis) Mouvement de cote et leçons de l'historique (4 saisons, 12 000 matchs testés)
  if (c.steam) {
    const f2 = (x) => (x ? Number(x).toFixed(2).replace(".", ",") : "?");
    out.push(c.steam.d > 0
      ? `La cote a baissé de ${f2(c.steam.from)} à ${f2(c.steam.to)} ces dernières heures : le marché a intégré une information (composition, blessure, suspension). Sur notre historique, suivre ce type de mouvement a été rentable (+6 % sur près de 2 000 paris).`
      : `Attention : la cote est passée de ${f2(c.steam.from)} à ${f2(c.steam.to)}, le marché se détourne de cette issue.`);
  }
  if (c.elo) {
    const { A, B, p } = c.elo, n0 = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const agree = Math.abs(p - (o.probAdj ?? o.prob)) <= 0.07;
    out.push(`Classement Elo FightEdge (appris sur 47 000 matchs) : ${A.name} ${n0(A.elo)} contre ${B.name} ${n0(B.elo)}, soit ${pct(p)} pour ${A.name}. Forme : ${Math.round(A.form * 10)} victoires sur ses 10 derniers matchs (${Math.round(A.dom * 100)} % des jeux gagnés), contre ${Math.round(B.form * 10)} pour ${B.name} (${Math.round(B.dom * 100)} %). ${agree ? "Notre classement confirme les bookmakers." : p > (o.probAdj ?? o.prob) ? "Notre classement est encore plus confiant que les bookmakers." : "Notre classement est un peu moins confiant que les bookmakers : mise prudente."}`);
  }
  if (m.sport === "football" && c.market === "h2h" && o.best?.odds) {
    const od = o.best.odds;
    if (od > 3.5) out.push("Historique : les « gros coups » à plus de 3,50 ont perdu près de 30 % des mises sur nos 4 saisons de test. Petite mise uniquement.");
    else if (od > 2.2) out.push("Historique : entre 2,20 et 3,50, même avec un avantage apparent, ces paris ont perdu de l'argent sur nos tests ; prudence sur la mise.");
  }

  // 2) Forme récente comparée
  if (F) {
    const H = F.h, A = F.a;
    const d = ptsOf(H.last5) - ptsOf(A.last5);
    const line = (x) => `${x.name} ${x.last5.map((r) => r.w).reverse().join("-")} (${ptsOf(x.last5)} pts, ${f1(x.last5.reduce((s, r) => s + r.gf, 0) / Math.max(1, x.last5.length))} but${x.last5.length ? "s" : ""} marqués par match)`;
    if (H.last5.length >= 3 && A.last5.length >= 3) out.push(`Forme sur les 5 derniers matchs : ${line(H)} ; ${line(A)}. ${Math.abs(d) >= 4 ? `${d > 0 ? H.name : A.name} arrive nettement plus en forme.` : Math.abs(d) <= 1 ? "Dynamiques comparables." : `Léger avantage de forme pour ${d > 0 ? H.name : A.name}.`}`);
    // domicile / extérieur
    if (H.venue.length >= 3 && A.venue.length >= 3) out.push(`À domicile, ${H.name} a pris ${ptsOf(H.venue)} pts sur ${H.venue.length * 3} ; à l'extérieur, ${A.name} en a pris ${ptsOf(A.venue)} sur ${A.venue.length * 3}.`);
    // jours de repos
    if (H.rest != null && A.rest != null && H.rest >= 0 && A.rest >= 0 && H.rest < 30 && A.rest < 30) {
      const gap = H.rest - A.rest;
      out.push(`Repos depuis le dernier match de championnat : ${plural(H.rest, "jour")} pour ${H.name}, ${plural(A.rest, "jour")} pour ${A.name}${Math.abs(gap) >= 2 ? ` : avantage fraîcheur pour ${gap > 0 ? H.name : A.name}` : ""}.`);
    }
    // buts : spécifique aux paris sur le nombre de buts / les deux marquent
    if (["totals", "btts"].includes(c.market)) {
      const tot = (x) => x.last5.reduce((s, r) => s + r.gf + r.ga, 0) / Math.max(1, x.last5.length);
      const bt = (x) => x.last5.filter((r) => r.gf > 0 && r.ga > 0).length;
      out.push(`Les matchs récents de ${H.name} comptent ${f1(tot(H))} buts en moyenne, ceux de ${A.name} ${f1(tot(A))}${c.market === "btts" ? ` ; les deux équipes ont marqué dans ${bt(H)} des 5 derniers matchs de ${H.name} et ${bt(A)} de ceux de ${A.name}` : c.line ? ` (ligne à ${String(c.line.point).replace(".", ",")})` : ""}.`);
    }
  }

  // 3) Le prix
  if (o.probAdj != null && o.best?.odds) {
    const e = o.probAdj * o.best.odds - 1;
    out.push(`Notre estimation : ${pct(o.probAdj)}, soit une cote juste de ${odd(1 / o.probAdj)}. ${o.best.book} paie ${odd(o.best.odds)}${e >= 0.02 ? `, au-dessus de la cote juste (avantage ${signed(e)})` : e >= -0.02 ? ", au prix juste" : ", un peu sous la cote juste"}.`);
  }
  return out;
}
