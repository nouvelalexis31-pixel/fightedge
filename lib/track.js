import { enough } from "./enough.js";
// Enregistrement horodaté des pronostics publiés, règlement automatique, historique. Ajout seulement : rien n'est jamais réécrit.
import { candidates, classify, mk, dailyPicks, scorerPicks } from "@/lib/analysis";
import { goalLinePick } from "@/lib/goalline";
import { primaryPick } from "@/lib/variety";
import { winnerPicks } from "@/components/WinnerPicks";
import { ruleFromCand, ruleFromLabel, ruleKey, settle } from "@/lib/rules";
import { fetchGames, findGame, oddsScores } from "@/lib/results";
import { putJson, listJson, storeOn } from "@/lib/store";

export const MODEL_VERSION = "v1";
const rid = () => Math.random().toString(36).slice(2, 8);
const stamp = (t = Date.now()) => new Date(t).toISOString().replace(/[:.]/g, "-");

const RESET_AT = +new Date("2026-11-17T23:20:00Z"); // bilan remis à zéro le 17/11/2026 à 00h20 (Paris)
function baseOf(m) {
  return { matchId: m.id, sk: m.sk || null, sport: m.sport, league: m.league, home: m.home, away: m.away, start: m.start, hl: m.logos?.homeCrest || null, al: m.logos?.awayCrest || null };
}
function candRecord(m, c, p, src) {
  const rule = ruleFromCand(m, c);
  const key = ruleKey(rule);
  if (!key || (rule.t === "h2h" && !rule.s) || (rule.t === "dnb" && !rule.s)) return null;
  const o = c.o;
  return { id: `${m.id}:${key}`, ...baseOf(m), market: c.market, selection: c.label, rule, odds: o.best.odds, book: o.best.book, prob: o.probAdj, probMarket: o.prob, value: o.evAdj, rel: p?.stars ?? null, kind: p?.kind ?? null, src, nBooks: c.nBooks, mv: MODEL_VERSION };
}

// Tous les pronostics actuellement publiés sur le site.
export function collectPicks(matches, now = Date.now()) {
  const out = new Map();
  const add = (r) => { if (r && !out.has(r.id)) out.set(r.id, r); };
  const soon = (m) => { const t = +new Date(m.start); return t > now && t <= now + 72 * 3600e3; };
  const ms = matches.filter(soon);
  for (const p of dailyPicks(matches, now)) if (soon(p.match)) add(candRecord(p.match, p.cand, p, "prono"));
  for (const w of winnerPicks(matches, now)) {
    const c = candidates(w.m).find((x) => x.market === "h2h" && x.o.name === w.o.name);
    if (c) add(candRecord(w.m, c, { stars: null, kind: classify(c) || "safe" }, "vainqueur"));
  }
  for (const m of ms) {
    const g = m.sport === "football" ? goalLinePick(m) : primaryPick(m);
    if (!g) continue;
    const rule = ruleFromLabel(m, g.label);
    const key = ruleKey(rule);
    if (!key) continue;
    add({ id: `${m.id}:${key}`, ...baseOf(m), market: "totals", selection: g.label, rule, odds: g.best?.odds ?? null, book: g.best?.book ?? null, prob: g.p, probMarket: null, value: g.best ? g.p * g.best.odds - 1 : null, rel: null, kind: null, src: "lignes", nBooks: m.nBooks, mv: MODEL_VERSION });
  }
  for (const s of scorerPicks(matches, now)) {
    if (!soon(s.m)) continue;
    const rule = { t: "scorer", name: s.name };
    add({ id: `${s.m.id}:${ruleKey(rule)}`, ...baseOf(s.m), market: "scorer", selection: `${s.name} marque`, rule, odds: s.best.odds, book: s.best.book, prob: s.prob, probMarket: null, value: s.ev, rel: null, kind: null, src: "buteur", nBooks: null, mv: MODEL_VERSION });
  }
  const vb = [];
  for (const m of ms) {
    if (!enough(m)) continue;
    for (const c of candidates(m)) {
      const o = c.o;
      if (!o.best || o.probAdj == null || o.probAdj < 0.2 || o.probAdj * o.best.odds - 1 < 0.03) continue;
      vb.push({ m, c, p: mk(m, c, "value") });
    }
  }
  vb.sort((a, b) => b.p.score - a.p.score);
  for (const v of vb.slice(0, 15)) add(candRecord(v.m, v.c, v.p, "value"));
  return [...out.values()];
}

// ---------- Lecture de l'historique ----------
export async function loadHistory() {
  if (!storeOn()) return { on: false, picks: [], results: {}, close: {}, tries: {} };
  const [pk, rs, cl] = await Promise.all([listJson("picks/"), listJson("results/"), listJson("close/")]);
  const picks = new Map(), results = {}, tries = {}, close = {};
  for (const f of pk) for (const r of f.data.picks || []) if (!picks.has(r.id) && +new Date(r.publishedAt || f.data.at) >= RESET_AT) picks.set(r.id, { ...r, publishedAt: r.publishedAt || f.data.at });
  for (const f of rs) for (const r of f.data.results || []) {
    if (r.status === "retry") { tries[r.id] = Math.max(tries[r.id] || 0, +new Date(r.at)); continue; }
    if (!results[r.id]) results[r.id] = r; // le premier règlement fait foi
  }
  for (const f of cl) for (const r of f.data.close || []) { const t = +new Date(r.at); if (!close[r.id] || t > close[r.id].t) close[r.id] = { odds: r.odds, t }; }
  return { on: true, picks: [...picks.values()], results, close, tries };
}

// Pronos enregistrés avec leur résultat éventuel.
export function merged(h) {
  return h.picks.map((p) => {
    const r = h.results[p.id];
    const c = h.close[p.id];
    const closeOdds = c && c.t < +new Date(p.start) ? c.odds : null;
    return { ...p, status: r ? r.status : "pending", score: r?.score || null, note: r?.note || null, settledAt: r?.settledAt || null, closeOdds };
  });
}

// ---------- Enregistrement ----------
export async function recordPicks(matches) {
  if (!storeOn()) return { saved: 0 };
  const h = await loadHistory();
  const known = new Set(h.picks.map((p) => p.id));
  const now = Date.now();
  const fresh = collectPicks(matches, now).filter((r) => !known.has(r.id)).map((r) => ({ ...r, publishedAt: new Date(now).toISOString() }));
  if (fresh.length) await putJson(`picks/${new Date(now).toISOString().slice(0, 10)}/${stamp(now)}-${rid()}.json`, { at: new Date(now).toISOString(), picks: fresh });
  // dernière cote observée avant le coup d'envoi (Closing Line Value indicative)
  const pending = h.picks.filter((p) => !h.results[p.id] && +new Date(p.start) > now);
  const snap = [];
  if (pending.length) {
    const byId = new Map(matches.map((m) => [m.id, m]));
    for (const p of pending) {
      const m = byId.get(p.matchId);
      if (!m) continue;
      const c = candidates(m).find((x) => { const r = ruleFromCand(m, x); return r && ruleKey(r) === ruleKey(p.rule); });
      if (c?.o?.best) snap.push({ id: p.id, odds: c.o.best.odds, at: new Date(now).toISOString() });
    }
    if (snap.length) await putJson(`close/${new Date(now).toISOString().slice(0, 10)}/${stamp(now)}-${rid()}.json`, { close: snap });
  }
  return { saved: fresh.length, snapshots: snap.length };
}

// ---------- Règlement ----------
const DONE_AFTER = 3.5 * 3600e3;
export async function settlePending({ force = false } = {}) {
  if (!storeOn()) return { settled: 0 };
  const h = await loadHistory();
  const now = Date.now();
  const todo = h.picks.filter((p) => !h.results[p.id] && now - +new Date(p.start) > DONE_AFTER && now - +new Date(p.start) < 21 * 86400e3 && (force || now - (h.tries[p.id] || 0) > 5 * 3600e3));
  if (!todo.length) return { settled: 0, pending: 0 };
  const games = await fetchGames(todo);
  const out = [], retry = [];
  const left = [];
  for (const p of todo) {
    const g = findGame(p, games);
    const res = g && g.final ? settle(p.rule, g, p.sport) : null;
    if (res) out.push({ id: p.id, status: res.status, note: res.note || null, score: g.sets?.length ? g.sets.map((s) => `${s.h}-${s.a}`).join(" ") : `${g.hs}-${g.as}`, settledAt: new Date(now).toISOString(), src: "espn" });
    else left.push(p);
  }
  // repli The Odds API : au plus 3 sports par exécution, uniquement pour les matchs terminés depuis plus de 20 h
  const bySk = {};
  for (const p of left) if (p.sk && now - +new Date(p.start) > 20 * 3600e3) (bySk[p.sk] = bySk[p.sk] || []).push(p);
  for (const sk of Object.keys(bySk).slice(0, 3)) {
    const sc = await oddsScores(sk);
    for (const p of bySk[sk]) {
      const g = sc[p.matchId];
      const res = g ? settle(p.rule, g, p.sport) : null;
      if (res) { out.push({ id: p.id, status: res.status, note: res.note || null, score: `${g.hs}-${g.as}`, settledAt: new Date(now).toISOString(), src: "odds-api" }); p.__done = true; }
    }
  }
  for (const p of left) if (!p.__done) retry.push({ id: p.id, status: "retry", at: new Date(now).toISOString() });
  const all = [...out, ...retry];
  if (all.length) await putJson(`results/${new Date(now).toISOString().slice(0, 10)}/${stamp(now)}-${rid()}.json`, { at: new Date(now).toISOString(), results: all });
  return { settled: out.length, unresolved: retry.length };
}

import { unstable_cache } from "next/cache";
export const history = unstable_cache(loadHistory, ["fe-history-v1"], { revalidate: 60 });
