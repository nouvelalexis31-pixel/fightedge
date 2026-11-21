// Fiche complète d'un match de football (ESPN, sans clé) : score en direct, événements, statistiques, forme, classement,
// face-à-face, compositions, cotes américaines converties, et analyse FightEdge calculée sur ces seules données réelles.
import { espnJson } from "./espnfetch.js";
import { unstable_cache } from "next/cache";

const URL_ = "https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=";
const num = (x) => { const n = Number(String(x ?? "").replace(/[^0-9.+-]/g, "")); return String(x ?? "").trim() === "" || !Number.isFinite(n) ? null : n; };
const dec = (ml) => { const n = /even/i.test(String(ml)) ? 100 : num(ml); if (n == null || n === 0) return null; return n > 0 ? 1 + n / 100 : 1 + 100 / -n; };
const arr = (x) => (Array.isArray(x) ? x : []);

async function raw(id) {
  return espnJson(URL_ + encodeURIComponent(id));
}
const cached = unstable_cache(async (id) => raw(id), ["espnsum-raw-v1"], { revalidate: 30 });

const logoOf = (t) => t?.logo || t?.logos?.find((l) => /default/.test((l.rel || []).join()))?.href || t?.logos?.[0]?.href || null;
const stat = (list, name) => num(arr(list).find((s) => s.name === name)?.displayValue ?? arr(list).find((s) => s.name === name)?.value);

function formOf(j, tid) {
  const g = arr(j.lastFiveGames).find((x) => String(x.team?.id) === String(tid));
  const evs = arr(g?.events).slice().sort((a, b) => String(b.gameDate).localeCompare(String(a.gameDate))).slice(0, 5).reverse();
  if (!evs.length) return null;
  const rows = evs.map((e) => {
    const home = String(e.homeTeamId) === String(tid);
    const gf = num(home ? e.homeTeamScore : e.awayTeamScore), ga = num(home ? e.awayTeamScore : e.homeTeamScore);
    if (gf == null || ga == null) return null;
    return { id: e.id, date: e.gameDate, opp: e.opponent?.displayName || "?", home, gf, ga, l: gf > ga ? "V" : gf < ga ? "D" : "N", comp: e.leagueAbbreviation || "" };
  }).filter(Boolean);
  if (!rows.length) return null;
  return { rows, letters: rows.map((r) => r.l), n: rows.length, pts: rows.reduce((s, r) => s + (r.l === "V" ? 3 : r.l === "N" ? 1 : 0), 0), gf: rows.reduce((s, r) => s + r.gf, 0), ga: rows.reduce((s, r) => s + r.ga, 0) };
}

function standOf(j, tid) {
  for (const g of arr(j.standings?.groups)) {
    const entries = arr(g.standings?.entries);
    const hit = entries.find((x) => String(x.id) === String(tid));
    if (!hit) continue;
    const st = hit.stats;
    const p = stat(st, "gamesPlayed");
    if (!p) return null;
    return { name: g.header || g.name || "", rank: stat(st, "rank"), of: entries.length, pts: stat(st, "points"), p, w: stat(st, "wins"), d: stat(st, "ties"), l: stat(st, "losses"), gd: stat(st, "pointDifferential") };
  }
  return null;
}

// Classement complet du groupe des deux équipes (ou du premier groupe), pour le tableau « façon Flashscore ».
function tableOf(j, hid, aid) {
  const groups = arr(j.standings?.groups);
  const g = groups.find((x) => arr(x.standings?.entries).some((e) => String(e.id) === String(hid) || String(e.id) === String(aid))) || groups[0];
  const es = arr(g?.standings?.entries);
  if (es.length < 3) return null;
  const rows = es.map((e) => ({ id: String(e.id), name: e.team || "?", logo: e.logo?.[0]?.href || null, rank: stat(e.stats, "rank"), p: stat(e.stats, "gamesPlayed"), w: stat(e.stats, "wins"), d: stat(e.stats, "ties"), l: stat(e.stats, "losses"), gd: stat(e.stats, "pointDifferential"), pts: stat(e.stats, "points") }))
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || (b.pts ?? 0) - (a.pts ?? 0));
  return { name: g.header || g.name || "", rows };
}

function oddsOf(j, hid, aid) {
  const o = arr(j.odds)[0] || arr(j.pickcenter)[0];
  if (!o) return null;
  const ml = (side) => o[side + "TeamOdds"]?.moneyLine ?? o.moneyline?.[side]?.close?.odds ?? o.moneyline?.[side]?.open?.odds;
  let h = dec(ml("home")), a = dec(ml("away")), d = dec(o.drawOdds?.moneyLine ?? o.moneyline?.draw?.close?.odds ?? o.moneyline?.draw?.open?.odds);
  const ou = num(o.overUnder) != null ? { line: num(o.overUnder), over: dec(o.overOdds), under: dec(o.underOdds) } : null;
  if (!(h && a) && !ou) return null;
  let p = null;
  if (h && a) {
    const ih = 1 / h, ia = 1 / a, id = d ? 1 / d : 0, s = ih + ia + id;
    p = { h: ih / s, d: id / s, a: ia / s, margin: s - 1 };
  }
  return { provider: o.provider?.name || "ESPN", h, d, a, p, ou };
}

function eventsOf(j, hid) {
  const out = [];
  for (const k of arr(j.keyEvents)) {
    const ty = String(k.type?.type || "");
    const kind = /own-goal/.test(ty) ? "csc" : /penalty.*(scored|goal)|goal/.test(ty) && !/disallow|no-goal/.test(ty) ? "goal" : /red-card/.test(ty) ? "red" : /yellow-card/.test(ty) ? "yellow" : /substitution/.test(ty) ? "sub" : null;
    if (!kind) continue;
    const ps = arr(k.participants).map((p) => p.athlete?.displayName).filter(Boolean);
    const min = String(k.clock?.displayValue || "").trim();
    out.push({ min, sec: num(k.clock?.value) ?? 0, kind, pen: /penalty/.test(ty), side: String(k.team?.id) === String(hid) ? "h" : "a", a: ps[0] || "", b: ps[1] || "", text: k.shortText || k.text || "" });
  }
  return out.sort((x, y) => x.sec - y.sec);
}

const LAB = [["possessionPct", "Possession", "%"], ["totalShots", "Tirs"], ["shotsOnTarget", "Tirs cadrés"], ["wonCorners", "Corners"], ["foulsCommitted", "Fautes"], ["yellowCards", "Cartons jaunes"], ["redCards", "Cartons rouges"], ["offsides", "Hors-jeu"], ["saves", "Arrêts"], ["accuratePasses", "Passes réussies"], ["blockedShots", "Tirs bloqués"]];
function statsOf(j, hid, aid) {
  const ts = arr(j.boxscore?.teams);
  const h = ts.find((t) => String(t.team?.id) === String(hid)) || ts.find((t) => t.homeAway === "home"), a = ts.find((t) => String(t.team?.id) === String(aid)) || ts.find((t) => t.homeAway === "away");
  if (!h || !a) return [];
  return LAB.map(([k, label, suf]) => { const x = stat(h.statistics, k), y = stat(a.statistics, k); return x == null && y == null ? null : { label, h: x, a: y, suf: suf || "" }; }).filter(Boolean);
}

function lineupsOf(j) {
  const rs = arr(j.rosters);
  if (!rs.length) return null;
  const side = (r) => {
    const all = arr(r?.roster);
    const st = all.filter((x) => x.starter).sort((p, q) => (num(p.formationPlace) ?? 99) - (num(q.formationPlace) ?? 99));
    if (st.length < 9) return null;
    const pl = (x) => ({ n: x.athlete?.displayName || x.athlete?.shortName || "?", j: x.jersey || "", pos: x.position?.abbreviation || "", in: !!x.subbedIn, out: !!x.subbedOut });
    return { formation: r.formation || "", starters: st.map(pl), subs: all.filter((x) => !x.starter).map(pl) };
  };
  const h = side(rs.find((r) => r.homeAway === "home") || rs[0]), a = side(rs.find((r) => r.homeAway === "away") || rs[1]);
  return h || a ? { h, a } : null;
}

function h2hOf(j, hid) {
  const s = arr(j.seasonseries)[0];
  if (!s) return null;
  const rows = arr(s.events).map((e) => {
    const c = arr(e.competitors), H = c.find((x) => x.homeAway === "home"), A = c.find((x) => x.homeAway === "away");
    if (!H || !A) return null;
    const hs = num(H.score), as = num(A.score);
    if (hs == null || as == null) return null;
    const ours = String(H.team?.id) === String(hid) ? "h" : "a";
    return { date: e.date, home: H.team?.displayName, away: A.team?.displayName, hs, as, ours };
  }).filter(Boolean);
  if (!rows.length) return null;
  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  for (const r of rows) { const f = r.ours === "h" ? r.hs : r.as, g = r.ours === "h" ? r.as : r.hs; gf += f; ga += g; if (f > g) w++; else if (f < g) l++; else d++; }
  return { rows, w, d, l, gf, ga, n: rows.length };
}

export function parse(j) {
  const hc = j.header?.competitions?.[0];
  const cs = arr(hc?.competitors);
  const H = cs.find((c) => c.homeAway === "home"), A = cs.find((c) => c.homeAway === "away");
  if (!H?.team || !A?.team) return null;
  const st = hc?.status?.type || j.header?.status?.type || {};
  const state = st.state === "in" ? "live" : st.state === "post" ? "done" : /POSTPONED|CANCELED|SUSPENDED|ABANDONED/.test(st.name || "") ? "off" : "up";
  const half = /HALFTIME/.test(st.name || "");
  const clock = String(hc?.status?.displayClock || "").trim();
  const label = state === "live" ? (half ? "Mi-temps" : /SHOOTOUT|PENALT/.test(st.name || "") ? "Tirs au but" : clock || "En cours") : state === "off" ? "Reporté" : state === "done" ? "Terminé" : "";
  const hid = H.team.id, aid = A.team.id;
  const names = [];
  for (const b of [...arr(j.broadcasts), ...arr(hc?.broadcasts)]) { const n = b?.media?.shortName || b?.media?.name || b?.name || arr(b?.names)[0]; if (n) names.push(n); }
  const v = j.gameInfo?.venue;
  const venue = v?.fullName ? v.fullName + (v.address?.city ? ", " + v.address.city : "") : null;
  const S = {
    league: j.header?.league?.name || j.header?.league?.shortName || "", round: hc?.notes?.[0]?.headline || "",
    start: hc?.date || j.header?.competitions?.[0]?.startDate || null, state, label, ref: arr(j.gameInfo?.officials)[0]?.displayName || null,
    venue, att: num(j.gameInfo?.attendance), tv: names.filter((x, i, a) => a.indexOf(x) === i).slice(0, 5),
    home: { id: hid, name: H.team.displayName || H.team.name, crest: logoOf(H.team), score: num(H.score) }, away: { id: aid, name: A.team.displayName || A.team.name, crest: logoOf(A.team), score: num(A.score) },
  };
  const tryit = (f) => { try { return f(); } catch { return null; } };
  S.form = { h: tryit(() => formOf(j, hid)), a: tryit(() => formOf(j, aid)) };
  S.stand = { h: tryit(() => standOf(j, hid)), a: tryit(() => standOf(j, aid)) };
  S.odds = tryit(() => oddsOf(j, hid, aid));
  S.events = tryit(() => eventsOf(j, hid)) || [];
  S.stats = state === "up" ? [] : tryit(() => statsOf(j, hid, aid)) || [];
  S.lineups = tryit(() => lineupsOf(j));
  S.h2h = tryit(() => h2hOf(j, hid));
  S.table = tryit(() => tableOf(j, hid, aid));
  S.leagueSlug = j.header?.league?.slug || null;
  return S;
}

export async function getSummary(id, { probable = true } = {}) {
  const m = String(id || "").replace(/^se/, "");
  if (!/^\d+$/.test(m)) return null;
  try { const S = parse(await cached(m)); if (probable) await withProbable(S); return S; } catch { return null; }
}
// Onze probable : quand la composition officielle n'est pas publiée, on reprend les titulaires du dernier match réel de l'équipe.
async function probOne(t, rows) {
  const last = arr(rows).filter((r) => r && r.id).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  if (!last) return null;
  const j = await cached(String(last.id));
  const r = arr(j.rosters).find((x) => String(x.team?.id) === String(t.id));
  const st = arr(r?.roster).filter((x) => x.starter).sort((p, q) => (num(p.formationPlace) ?? 99) - (num(q.formationPlace) ?? 99));
  if (st.length < 9) return null;
  const pl = (x) => ({ n: x.athlete?.displayName || x.athlete?.shortName || "?", j: x.jersey || "", pos: x.position?.abbreviation || "", in: false, out: false });
  return { formation: r.formation || "", starters: st.map(pl), subs: [], probable: true, from: { opp: last.opp, date: last.date } };
}
async function withProbable(S) {
  if (S.state !== "up") return;
  const L = S.lineups || { h: null, a: null };
  const [h, a] = await Promise.all([
    L.h ? L.h : probOne(S.home, S.form?.h?.rows || S.form?.h).catch(() => null),
    L.a ? L.a : probOne(S.away, S.form?.a?.rows || S.form?.a).catch(() => null),
  ]);
  if (h || a) S.lineups = { h, a };
}

// ---------- Analyse FightEdge : uniquement à partir des données ci-dessus ----------
const poisson = (mu, k) => { let p = Math.exp(-mu); for (let i = 1; i <= k; i++) p *= mu / i; return p; };
const f1 = (x) => Number(x).toFixed(1).replace(".", ",");
const P = (p) => Math.round(p * 100) + " %";
const o2 = (v) => Number(v).toFixed(2).replace(".", ",");
const ppg = (S, side) => {
  const f = S.form[side], s = S.stand[side];
  const a = f ? f.pts / f.n / 3 : null, b = s ? s.pts / s.p / 3 : null;
  return a != null && b != null ? 0.5 * a + 0.5 * b : a ?? b;
};

export function analyseSummary(S, E = null) {
  const reasons = [], risks = [];
  const n = [S.form.h && S.form.a, S.stand.h && S.stand.a, S.odds?.p, S.h2h].filter(Boolean).length;
  const nm = (side) => (side === "h" ? S.home.name : S.away.name);
  for (const side of ["h", "a"]) {
    const f = S.form[side], s = S.stand[side];
    if (f) reasons.push(`${nm(side)} : ${f.letters.join(" ")} sur ${f.n} derniers matchs (${f.pts} pts sur ${f.n * 3}), ${f1(f.gf / f.n)} buts marqués et ${f1(f.ga / f.n)} encaissés par match.`);
    if (s) reasons.push(`${nm(side)} est ${s.rank ?? "?"}${s.rank === 1 ? "er" : "e"} sur ${s.of} (${s.pts} pts en ${s.p} matchs, ${s.w}V ${s.d}N ${s.l}D, différence de buts ${s.gd > 0 ? "+" : ""}${s.gd ?? "?"}).`);
  }
  if (S.h2h) { const w = S.h2h.w, l = S.h2h.l, d = S.h2h.d, pl = (x) => (x > 1 ? "s" : ""); reasons.push(`Face-à-face récents (${S.h2h.n} match${S.h2h.n > 1 ? "s" : ""}) : ${S.home.name} ${w} victoire${pl(w)}, ${d} nul${pl(d)}, ${S.away.name} ${l} victoire${pl(l)}.`); }
  let probs = null, source = null;
  if (E?.probs) { probs = E.probs; source = E.source; }
  else if (S.odds?.p) { probs = { h: S.odds.p.h, d: S.odds.p.d, a: S.odds.p.a }; source = `cotes ${S.odds.provider} (convertie, marge retirée)`; }
  else {
    const a = ppg(S, "h"), b = ppg(S, "a");
    if (a != null && b != null) {
      const d = a - b + 0.08, pd = Math.min(0.3, Math.max(0.16, 0.3 - 0.25 * Math.abs(d))), L = 1 / (1 + Math.exp(-d * 3.2));
      probs = { h: (1 - pd) * L, d: pd, a: (1 - pd) * (1 - L) };
      source = "estimation FightEdge (forme + classement), pas des cotes";
    }
  }
  // Buts attendus
  let goals = null;
  const fh = S.form.h, fa = S.form.a;
  if (E) {
    const it = (k) => E.groups.flatMap((g) => g.items).find((x) => x.key === k)?.p ?? null;
    const s0 = E.scores[0];
    goals = { lh: E.lh, la: E.la, over25: it("tot:2.5:over"), btts: it("btts:yes"), score: { x: s0.h, y: s0.a, p: s0.p } };
  } else if (fh && fa && fh.n >= 3 && fa.n >= 3) {
    let lh = (fh.gf / fh.n + fa.ga / fa.n) / 2, la = (fa.gf / fa.n + fh.ga / fh.n) / 2;
    if (S.odds?.ou?.line && S.odds.ou.over && S.odds.ou.under) { const tot = S.odds.ou.line + (1 / S.odds.ou.over > 1 / S.odds.ou.under ? 0.2 : -0.2); const k = tot / Math.max(0.5, lh + la); lh *= k; la *= k; }
    let over25 = 0, btts = 0, best = null;
    for (let x = 0; x <= 8; x++) for (let y = 0; y <= 8; y++) {
      const p = poisson(lh, x) * poisson(la, y);
      if (x + y >= 3) over25 += p;
      if (x > 0 && y > 0) btts += p;
      if (!best || p > best.p) best = { x, y, p };
    }
    goals = { lh, la, over25, btts, score: best };
  }
  let pick = null;
  if (probs) {
    const arrp = [["h", probs.h, `Victoire ${S.home.name}`], ["d", probs.d, "Match nul"], ["a", probs.a, `Victoire ${S.away.name}`]].sort((x, y) => y[1] - x[1]);
    const [k, p, label] = arrp[0];
    pick = p >= 0.4 ? { label, p, text: `${label} (${P(p)})` } : { label: "Match ouvert", p, text: `Pas de favori net : ${P(arrp[0][1])} pour « ${arrp[0][2]} », ${P(arrp[1][1])} pour « ${arrp[1][2]} »` };
    if (p < 0.5 && k !== "d") pick.alt = `Double chance ${k === "h" ? S.home.name + " ou nul" : S.away.name + " ou nul"} : ${P(p + probs.d)}`;
  }
  if (!S.odds) risks.push("Aucune cote disponible pour ce match dans nos sources : les probabilités ne viennent pas du marché.");
  else risks.push("Cotes américaines (" + S.odds.provider + ") converties en décimal : non disponibles chez les opérateurs français, à utiliser comme repère de probabilité, pas comme cote jouable.");
  if (!S.lineups) risks.push("Compositions non publiées : blessures et absences non vérifiables.");
  if (n < 2) risks.push("Données limitées sur ce match : analyse peu fiable, à prendre avec prudence.");
  return { probs, source, goals, pick, reasons, risks, n, level: E ? E.level : n >= 3 ? "correcte" : n === 2 ? "moyenne" : "faible" };
}
