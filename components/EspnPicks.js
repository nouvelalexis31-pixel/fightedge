import Link from "next/link";
import { after } from "next/server";
import { getFootByDate, getLeagueDay, TOP_SLUGS } from "@/lib/livex";
import { getSummary, analyseSummary } from "@/lib/espnsum";
import { loadEnriched } from "@/lib/data";
import { loadHistory } from "@/lib/track";
import { putJson, storeOn } from "@/lib/store";
import { ruleKey } from "@/lib/rules";
import { Badge } from "@/components/Team";
import Ring from "@/components/Ring";
import { fmtDateTime, todayKey, dayKey, fmtDayShort } from "@/lib/format";
import { frComp } from "@/lib/frcomp";
import { fr } from "@/lib/fr";
import { matchCenter } from "@/lib/matchcenter";

const P = (p) => Math.round(p * 100) + " %";
const o2 = (v) => (v ? Number(v).toFixed(2).replace(".", ",") : null);
const addD = (k, n) => { const d = new Date(k + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const nz = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(fc|cf|ac|as|sc|ss|us|rc|ud|cd|sv|afc|club|de|the)\b|[^a-z0-9]/g, "");
const near = (a, b) => { const x = nz(a), y = nz(b); return x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x) || x.slice(0, 5) === y.slice(0, 5)); };
const rid = () => Math.random().toString(36).slice(2, 8);

// Pronos tirés du calendrier ESPN (tous les matchs, y compris ceux sans cotes françaises) : uniquement des données réelles.
export default async function EspnPicks({ scopeNote }) {
  const t0 = todayKey();
  const days = [t0, addD(t0, 1), addD(t0, 2)];
  const [cals, data] = await Promise.all([
    Promise.all(days.map((d) => getFootByDate(d).catch(() => null))),
    loadEnriched().catch(() => ({ matches: [] })),
  ]);
  const oddsMs = (data.matches || []).filter((m) => m.sport === "football");
  // Prochaine journée de Ligue des champions (même au-delà des 3 jours) : pronos préparés à l'avance.
  let ucl = null;
  if (!cals.some((c) => (c?.items || []).some((m) => m.slug === "uefa.champions" && m.state === "up"))) {
    for (let k = 3; k <= 10 && !ucl; k++) {
      const d = addD(t0, k);
      const r = await getLeagueDay("uefa.champions", d);
      if ((r.items || []).some((m) => m.state === "up")) ucl = { d, items: r.items.map((m) => ({ ...m, slug: "uefa.champions" })) };
    }
    if (ucl) {
      days.push(ucl.d); cals.push({ items: ucl.items });
      // la journée se joue sur 2 soirs (mardi + mercredi)
      const d2 = addD(ucl.d, 1), r2 = await getLeagueDay("uefa.champions", d2);
      if ((r2.items || []).some((m) => m.state === "up")) { days.push(d2); cals.push({ items: r2.items.map((m) => ({ ...m, slug: "uefa.champions" })) }); ucl.d2 = d2; }
    }
  }
  const now = Date.now();
  const seen = new Set();
  const list = [];
  for (const c of cals) for (const m of c?.items || []) {
    if (seen.has(m.id) || m.state !== "up") continue;
    const t = +new Date(m.start);
    if (!(t > now) || !days.includes(dayKey(m.start))) continue;
    seen.add(m.id); list.push(m);
  }
  // Un quota par jour (aujourd'hui, demain, après-demain) : les matchs cotés en France et les grands championnats d'abord.
  const BIG = /ligue 1|ligue 2|premier league|laliga|la liga|serie a|bundesliga|champions|europa|conf[ée]rence|nations|coupe du monde|world cup|eredivisie|liga portugal|primeira|pro league|s[üu]per lig|championship|copa|libertadores|mls|liga mx|brasileir/i;
  const hasOdds = (m) => oddsMs.some((y) => near(y.home, m.home?.name) && near(y.away, m.away?.name));
  const TOP0 = new Set(["uefa.champions", "uefa.europa", "uefa.europa.conf", "fra.1", "eng.1", "esp.1", "ita.1", "ger.1"]);
  // Compétitions toujours proposées par Winamax, Betclic, Unibet et PMU (1N2, double chance, buts) : on donne le prono même
  // quand notre flux de cotes est vide (quota), avec la cote juste à comparer sur l'appli de l'opérateur.
  const FRL = new Set(TOP_SLUGS);
  const listed = (m) => hasOdds(m) || FRL.has(m.slug);
  const prio = (m) => (hasOdds(m) ? (TOP0.has(m.slug) ? 0 : 1) : FRL.has(m.slug) ? (TOP0.has(m.slug) ? 1 : 1.5) : 2);
  const PER_DAY = 24;
  const pool = days.flatMap((d) => list.filter((m) => dayKey(m.start) === d && listed(m) && !/women|féminin|femenin|frauen|\bu-?\d\d\b|youth|reserve/i.test(String(m.comp || "") + " " + m.home?.name + " " + m.away?.name)).sort((a, b) => prio(a) - prio(b) || String(a.start).localeCompare(String(b.start))).slice(0, PER_DAY));
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < pool.length) {
      const m = pool[i++];
      try {
        const S = await getSummary(m.id, { probable: false });
        if (!S) continue;
        const C = await matchCenter(S).catch(() => null);
        const A = analyseSummary(S, C?.E);
        if (/women|\bwsl\b|players cup|femin|femen|frauen|lionesses|lyonnes|ladies|\bu-?(1\d|2\d)\b|youth|reserve/i.test(String(S.league) + " " + S.home.name + " " + S.away.name + " " + String(m.comp))) continue;
        if (!A.pick || A.n < 2) continue;
        out.push({ m, S, A, E: C?.E || null });
      } catch {}
    }
  }));
  const cards0 = out.map(({ m, S, A, E }) => {
    const pk = A.pick;
    const main = pk.p >= 0.5 ? { label: pk.label, p: pk.p } : A.probs ? (() => {
      const e = [["h", A.probs.h], ["a", A.probs.a]].sort((x, y) => y[1] - x[1])[0];
      return { label: `Double chance : ${e[0] === "h" ? fr(S.home.name) : fr(S.away.name)} ou nul`, p: e[1] + A.probs.d, dc: e[0] };
    })() : null;
    if (!main) return null;
    const side = main.label === `Victoire ${S.home.name}` ? "h" : main.label === `Victoire ${S.away.name}` ? "a" : null;
    // cotes françaises (Winamax, Betclic…) du même match quand elles existent
    const t = +new Date(m.start);
    const x = oddsMs.find((y) => near(y.home, S.home.name) && near(y.away, S.away.name) && Math.abs(+new Date(y.start) - t) < 6 * 3600e3) || null;
    const oc = (n) => x?.outcomes?.find((o) => o.name === n)?.best || null;
    const fo = x ? { h: oc(x.home), d: oc("Match nul"), a: oc(x.away) } : null;
    const hasFr = !!(fo && (fo.h || fo.a));
    const us = S.odds || null;
    const cote = hasFr ? { h: fo.h?.odds, d: fo.d?.odds, a: fo.a?.odds, who: [fo.h, fo.d, fo.a].filter(Boolean).map((b) => b.book).filter((v, k, a) => a.indexOf(v) === k).join(" / "), fr: true } : us ? { h: us.h, d: us.d, a: us.a, who: us.provider, fr: false } : null;
    // cote française du pari principal (victoire ou double chance)
    const dcFr = main.dc && x?.extras?.dc ? x.extras.dc[main.dc === "h" ? 0 : 1]?.best?.odds : null;
    const pickOdd = cote?.fr ? (side ? cote[side] : dcFr) : null;
    let goal = null;
    if (A.goals) { if (A.goals.over25 >= 0.62) goal = { label: "Plus de 2,5 buts", p: A.goals.over25, s: "over" }; else if (A.goals.over25 <= 0.36) goal = { label: "Moins de 2,5 buts", p: 1 - A.goals.over25, s: "under" }; }
    if (goal && x?.totals) { const tl = x.totals.find((q) => q.point === 2.5); const b = tl && (goal.s === "over" ? tl.over : tl.under)?.best; if (b) goal.odd = b.odds; }
    const tone = (nm, f) => { if (!f || !f.n) return null; const v = f.letters.filter((z) => z === "V").length; const r = f.pts / (3 * f.n); return nm + " " + (r >= 0.6 ? "est en forme" : r <= 0.34 ? "est en méforme" : "a une forme moyenne") + " (" + v + " victoire" + (v > 1 ? "s" : "") + " sur ses " + f.n + " derniers matchs)"; };
    const wp = [];
    const th = tone(fr(S.home.name), S.form.h), ta = tone(fr(S.away.name), S.form.a);
    if (th && ta) wp.push(th + ", " + ta + ".");
    else if (th || ta) wp.push((th || ta) + ".");
    if (S.stand.h && S.stand.a && S.stand.h.rank && S.stand.a.rank) wp.push(fr(S.home.name) + " est " + S.stand.h.rank + "e au classement, " + fr(S.away.name) + " " + S.stand.a.rank + "e.");
    if (A.probs) { const mk = [["h", A.probs.h, fr(S.home.name)], ["d", A.probs.d, "le match nul"], ["a", A.probs.a, fr(S.away.name)]].sort((u, v) => v[1] - u[1])[0]; if (S.odds?.p || x) wp.push("La plupart des pronostiqueurs et les bookmakers voient " + mk[2] + " en tête : " + P(mk[1]) + " selon les cotes" + (cote?.fr ? " (" + cote.who + ")" : "") + "."); else wp.push("Sans cotes disponibles, notre estimation (forme + classement) place " + mk[2] + " en tête à " + P(mk[1]) + "."); }
    const why = wp.length ? wp.join(" ") : "Données insuffisantes pour justifier ce choix.";
    // prono complémentaire du moteur FightEdge : plus-value d'abord, sinon le plus sûr hors 1N2 / buts déjà affichés
    const frPick = (y) => y.offer?.fr && y.offer.odds >= 1.25;
    const extra = E?.picks.find((y) => y.kind === "value" && frPick(y)) || E?.picks.find((y) => ["safe", "mid", "bold"].includes(y.kind) && frPick(y) && !["1x2", "dc"].includes(y.gid)) || null;
    return { m, S, A, x, cote, side, pickOdd, goal, why, extra, main: { ...main, label: main.label.replace(S.home.name, fr(S.home.name)).replace(S.away.name, fr(S.away.name)) } };
  }).filter(Boolean)
    .filter((c) => (c.cote?.fr && c.pickOdd) || (!c.cote?.fr && FRL.has(c.m.slug)))
    .map((c) => (c.cote?.fr ? { ...c, goal: c.goal?.odd ? c.goal : null } : { ...c, noFeed: true, cote: null, pickOdd: null }));
  // Sélection par jour : jusqu'à 8 pronos solides (55 % ou plus), au moins 4 quand il y a des matchs (seuil 45 %).
  const score = (c) => c.main.p * (c.A.n >= 3 ? 1.05 : 1) * (c.x ? 1.05 : 1);
  const byDay = days.map((d) => {
    const all = cards0.filter((c) => dayKey(c.m.start) === d).sort((a, b) => score(b) - score(a));
    // grandes compétitions (Ligue des champions, Ligue 1, Premier League…) : un prono pour chaque match
    const big = all.filter((c) => prio(c.m) <= 1);
    let pick = [...big, ...all.filter((c) => !big.includes(c) && c.main.p >= 0.52)].slice(0, 16);
    if (pick.length < 4) pick = [...pick, ...all.filter((c) => !pick.includes(c) && c.main.p >= 0.45).slice(0, 4 - pick.length)];
    return { d, cards: pick.sort((a, b) => String(a.m.start).localeCompare(String(b.m.start))), nAll: list.filter((m) => dayKey(m.start) === d).length };
  });
  const cards = byDay.flatMap((g) => g.cards);
  if (!cards.length) return null;

  // Historique : chaque prono affiché ici est enregistré une seule fois, puis réglé avec le score final (voir le bilan).
  if (storeOn()) {
    const recs = [];
    for (const c of cards) {
      const home = c.x?.home || c.S.home.name, away = c.x?.away || c.S.away.name, mid = c.x?.id || c.m.id;
      const base = { matchId: mid, sk: c.x?.sk || null, sport: "football", league: c.m.comp || c.S.league, home, away, start: c.m.start, hl: c.S.home.crest || null, al: c.S.away.crest || null, src: "espn", rel: null, kind: null, nBooks: null, mv: "v1" };
      const frOdd = c.cote?.fr && c.pickOdd ? c.pickOdd : null;
      const frBook = frOdd ? c.cote.who : null;
      const usOdd = c.cote && !c.cote.fr && c.pickOdd ? c.pickOdd : null;
      let rule = null;
      if (c.side) rule = { t: "h2h", s: c.side === "h" ? "home" : "away" };
      else if (c.main.dc) rule = { t: "dc", set: (c.main.dc === "h" ? ["draw", "home"] : ["away", "draw"]).sort() };
      const k = ruleKey(rule);
      if (k) recs.push({ id: `${mid}:${k}`, ...base, market: c.side ? "h2h" : "dc", selection: c.main.label, rule, odds: frOdd, book: frBook, usOdds: usOdd, prob: c.main.p, probMarket: null, value: null });
      if (c.goal) { const r2 = { t: "tot", u: "buts", p: 2.5, s: c.goal.s }; recs.push({ id: `${mid}:${ruleKey(r2)}`, ...base, market: "totals", selection: c.goal.label, rule: r2, odds: c.goal.odd || null, book: c.goal.odd ? "Winamax/Betclic" : null, prob: c.goal.p, probMarket: null, value: null }); }
    }
    after(async () => {
      try {
        const h = await loadHistory();
        const known = new Set(h.picks.map((p) => p.id));
        const at = new Date().toISOString();
        const fresh = recs.filter((r) => !known.has(r.id)).map((r) => ({ ...r, publishedAt: at }));
        if (fresh.length) await putJson(`picks/${at.slice(0, 10)}/${at.replace(/[:.]/g, "-")}-${rid()}.json`, { at, picks: fresh });
      } catch (e) { console.error("espn-rec", e?.message); }
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-extrabold tracking-tight">Football : pronos IA jour par jour<span className="ml-2 text-sm font-medium text-muted">{cards.length} sélectionnés sur {pool.length} matchs analysés</span></h2>
      <p className="text-xs text-muted">{scopeNote || "Calendrier ESPN des grandes compétitions."} Uniquement des matchs et des paris proposés par les opérateurs français (Winamax, Betclic, Unibet, PMU), avec leur meilleure cote quand nous l'avons, sinon la cote juste à comparer. Ce sont des estimations, jamais des certitudes.</p>
      {byDay.map((g, gi) => (
        <div key={g.d} className="space-y-2">
          <h3 className="flex items-baseline gap-2 text-lg font-extrabold">{gi === 0 ? "Aujourd'hui" : gi === 1 ? "Demain" : ucl && (g.d === ucl.d || g.d === ucl.d2) ? `Ligue des champions · ${fmtDayShort(g.d)}` : fmtDayShort(g.d)}<span className="text-sm font-medium capitalize text-muted">{gi < 2 ? fmtDayShort(g.d) : ""}</span><span className="text-xs font-medium text-muted">{g.cards.length} prono{g.cards.length > 1 ? "s" : ""}</span></h3>
          {g.cards.length === 0 ? <p className="card p-4 text-sm text-muted">{ucl && (g.d === ucl.d || g.d === ucl.d2) ? "Les opérateurs français n'ont pas encore ouvert les cotes de ces matchs : les pronos apparaîtront ici dès qu'elles seront disponibles (en général 2 à 3 jours avant)." : gi === 0 ? "Aucun autre match de football coté par les opérateurs français aujourd'hui : voir les autres sports ci-dessous." : "Les cotes françaises de ce jour ne sont pas encore toutes publiées : les pronos arrivent au fil des heures."}</p> : (
            <div className="grid gap-3 lg:grid-cols-2">
        {g.cards.map(({ m, S, A, main, cote, pickOdd, goal, why, extra, noFeed }) => (
          <Link key={m.id} href={`/match/${encodeURIComponent(m.id)}`} className="card block space-y-2.5 p-4 transition hover:shadow-md">
            <div className="text-[11px] font-semibold text-muted">⚽ {frComp(m.comp || S.league)} · {fmtDateTime(m.start)}</div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <span className="flex min-w-0 items-center gap-2"><Badge src={S.home.crest} name={S.home.name} size={32} /><span className="truncate text-sm font-bold">{fr(S.home.name)}</span></span>
              <span className="text-xs font-semibold text-muted">vs</span>
              <span className="flex min-w-0 items-center justify-end gap-2"><span className="truncate text-right text-sm font-bold">{fr(S.away.name)}</span><Badge src={S.away.crest} name={S.away.name} size={32} /></span>
            </div>
            <div className="flex items-center gap-3"><Ring value={main.p} size={52} /><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-brand">{main.label}</span><span className="num block text-xs font-bold">Probabilité {P(main.p)}{pickOdd ? ` · cote ${o2(pickOdd)}` : ` · cote juste ${o2(1 / main.p)}`}</span></span></div>
            {goal && <div className="flex items-baseline justify-between gap-3 text-sm"><span className="font-semibold">{goal.label}</span><span className="num font-bold">{P(goal.p)}{goal.odd ? ` · cote ${o2(goal.odd)}` : ""}</span></div>}
            {extra && <div className="flex items-baseline justify-between gap-3 text-sm"><span className="font-semibold">{extra.group} : {extra.label}{extra.kind === "value" ? <span className="ml-1.5 rounded bg-good/10 px-1 text-[10px] font-bold text-good">plus-value</span> : null}</span><span className="num font-bold">{P(extra.p)}{extra.offer ? ` · cote ${o2(extra.offer.odds)}` : ` · juste ${o2(extra.fair)}`}</span></div>}
            {cote && (cote.h || cote.a) ? (
              <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                {[["1", cote.h], ["N", cote.d], ["2", cote.a]].map(([l, v]) => <div key={l} className="rounded-lg bg-card2 px-2 py-1.5"><div className="text-[10px] text-muted">{l}</div><div className="num font-extrabold">{v ? o2(v) : "—"}</div></div>)}
              </div>
            ) : noFeed ? <p className="rounded-lg bg-card2 px-2 py-1.5 text-[11px] leading-relaxed">Pari proposé chez Winamax, Betclic, Unibet et PMU. <b>Cote juste FightEdge : {o2(1 / main.p)}</b>{goal ? ` (buts : ${o2(1 / goal.p)})` : ""} : jouez-le seulement si votre appli affiche une cote supérieure.</p> : <p className="rounded-lg bg-card2 px-2 py-1.5 text-[11px] text-muted">Cotes non disponibles pour ce match pour le moment.</p>}
            <div className="rounded-lg bg-card2 px-2.5 py-2 text-[11px] leading-relaxed"><b className="text-brand">Pourquoi ce choix ?</b> {why}</div>
            <p className="text-[11px] text-muted">{cote?.fr ? `Cotes ${cote.who}.` : noFeed ? "Cotes françaises du jour non relevées par notre source : à vérifier sur votre appli." : ""} Base : {A.source || "—"} · fiabilité des données {A.level}.</p>
            <span className="text-xs font-bold text-brand">Analyse complète du match →</span>
          </Link>
        ))}
      </div>
          )}
        </div>
      ))}
    </section>
  );
}
