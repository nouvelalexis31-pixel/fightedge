import { frComp } from "@/lib/frcomp";
import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import { getLive, getGoals } from "@/lib/fd";
import { getOtherLive, getFootLive, getFootEspn, getTennisLive, getFootByDate, OTHER } from "@/lib/livex";
import { dayKey, fmtTime } from "@/lib/format";
import { loadEnriched } from "@/lib/data";
import { getLiveOdds } from "@/lib/liveodds";
import { nameSim } from "@/lib/analysis";
import { fr, canon } from "@/lib/fr";
import { tipsOf } from "@/components/MatchTips";

export const metadata = { title: "Scores en direct" };
export const revalidate = 0;
export const dynamic = "force-dynamic";

const FD_LIVE = new Set(["IN_PLAY", "PAUSED", "LIVE"]);
const FD_DONE = new Set(["FINISHED", "AWARDED"]);

// Football (football-data.org) ramené au même format que les autres sports.
function fromFd(m) {
  const state = FD_LIVE.has(m.status) ? "live" : FD_DONE.has(m.status) ? "done" : "up";
  const est = () => { const e = Math.floor((Date.now() - new Date(m.start).getTime()) / 60000); if (e < 1) return "En cours"; if (e <= 47) return `≈ ${Math.min(e, 45)}'`; if (e <= 62) return "≈ 45'+"; return `≈ ${Math.min(e - 15, 90)}'`; };
  const label = m.status === "PAUSED" ? "Mi-temps" : state === "live" ? (m.minute ? `${m.minute}'` : est()) : "";
  return { id: `fd${m.id}`, rawId: m.id, state, label, start: m.start, comp: m.comp, home: { name: m.home.name, crest: m.home.crest }, away: { name: m.away.name, crest: m.away.crest }, h: state === "up" ? null : m.h, a: state === "up" ? null : m.a };
}

const STRIP = /\b(fc|cf|ac|as|sc|ss|us|rc|ud|cd|sv|afc|club|de|the|1)\b|[^a-z]/g;
const key = (n) => String(n).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(STRIP, "").slice(0, 5);

const isDup = (seen, m) => { const h = key(m.home.name), a = key(m.away.name), t = +new Date(m.start); return seen.some(([sh, sa, st]) => Math.abs(st - t) <= 3 * 3600e3 && ((sh === h && sa === a) || ((sh === h || sa === a) && Math.abs(st - t) <= 600e3))); };
const SPORT_KEY = { football: "football", basket: "basketball", hockey: "hockey", nfl: "americanfootball", tennis: "tennis", baseball: "baseball", rugby: "rugby" };
const f1 = (x) => Number(x).toFixed(1).replace(".", ",");
const P = (p) => Math.round(p * 100) + " %";
const norm = (x) => String(canon(x) || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const sim = (a, b) => { const na = norm(a), nb = norm(b); const loose = na.length >= 3 && nb.length >= 3 && (na.includes(nb) || nb.includes(na)) ? 0.8 : 0; return Math.max(nameSim(a, b), loose); };
function findEnriched(m, sk, enr) {
  const t = new Date(m.start).getTime();
  let best = null, bs = 0;
  for (const e of enr) {
    if (e.sport !== sk) continue;
    if (Math.abs(new Date(e.start).getTime() - t) > 14 * 3600 * 1000) continue;
    const sh = sim(m.home.name, e.home), sa = sim(m.away.name, e.away);
    const near = Math.abs(new Date(e.start).getTime() - t) <= 45 * 60 * 1000;
    const s = Math.min(sh, sa) >= 0.45 ? Math.min(sh, sa) : near && Math.max(sh, sa) >= 0.5 ? 0.45 : 0;
    if (s > bs) { bs = s; best = e; }
  }
  return bs >= 0.45 ? best : null;
}
function predOf(m, e, sk) {
  const out = [];
  const tips = tipsOf(e);
  const issue = tips.find((t) => t.id === "issue"), total = tips.find((t) => t.id === "total"), scorer = tips.find((t) => t.id === "scorer" && t.best);
  if (issue) out.push(issue.pick + (issue.p != null ? " (" + P(issue.p) + ")" : ""));
  if (total) out.push(total.pick + (total.p != null ? " (" + P(total.p) + ")" : ""));
  const mo = e.model;
  if (mo?.kind === "goals") {
    if (mo.scores?.[0]) out.push("Score probable " + mo.scores[0].h + "-" + mo.scores[0].a);
    out.push("≈ " + f1(mo.mu) + " buts attendus");
    const mn = parseInt(String(m.label || "").replace(/[^0-9]/g, ""), 10);
    if (sk === "football" && m.state === "live" && Number.isFinite(mn) && mn > 0 && mn < 90 && m.h != null && m.a != null) {
      out.push("Projection en direct : ≈ " + f1(m.h + m.a + mo.mu * (90 - mn) / 90) + " buts au total (estimation)");
    }
  } else if (mo?.kind === "sets") { const sc0 = mo.markets?.find((g) => g.group === "Score en sets")?.items?.[0]; if (sc0) out.push("Score en sets probable : " + sc0.label + " (" + P(sc0.p) + ")"); const ns0 = mo.markets?.find((g) => g.group === "Nombre de sets")?.items?.slice().sort((a, b) => b.p - a.p)[0]; if (ns0) out.push(ns0.label + " (" + P(ns0.p) + ")"); } else if (mo?.kind === "points") out.push("Score attendu ≈ " + Math.round(mo.h) + " - " + Math.round(mo.a));
  if (scorer) out.push("Buteur à suivre : " + scorer.pick + " (cote " + Number(scorer.best.odds).toFixed(2).replace(".", ",") + ", " + scorer.best.book + ")");
  return out;
}

const o2 = (v) => Number(v).toFixed(2).replace(".", ",");
function preOf(e) {
  const oc = (e.outcomes || []).filter((o) => o.best);
  if (oc.length < 2) return null;
  const nh = norm(e.home), na = norm(e.away);
  const pick = (f) => oc.find(f);
  const home = pick((o) => norm(o.name) === nh), away = pick((o) => norm(o.name) === na), draw = pick((o) => /^(nul|draw)/i.test(o.name));
  const row = [[fr(e.home), home], ...(draw ? [["Nul", draw]] : []), [fr(e.away), away]].filter(([, o]) => o);
  return row.length >= 2 ? row.map(([n, o]) => ({ n, odds: o.best.odds, book: o.best.book })) : null;
}

function OddsZone({ m }) {
  const live = m.state === "live" && m.odds;
  const rows = live
    ? [["1", "Victoire " + fr(m.home.name), m.odds.home], ...(m.odds.draw ? [["N", "Match nul", m.odds.draw]] : []), ["2", "Victoire " + fr(m.away.name), m.odds.away]]
    : m.pre && m.state !== "done" ? m.pre.map((x, k, arr) => [arr.length === 3 ? (k === 0 ? "1" : k === 1 ? "N" : "2") : k === 0 ? "1" : "2", x.n === "Nul" ? "Match nul" : "Victoire " + x.n, x.odds, x.book]) : null;
  if (!rows) return null;
  const min = Math.min(...rows.map((r) => r[2]));
  return (
    <div className="mx-4 mb-3 rounded-2xl border border-line bg-card2/60 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
        <span className={`rounded-full px-2 py-0.5 font-bold ${live ? "bg-bad text-white" : "bg-white text-muted ring-1 ring-line"}`}>{live ? "Cotes LIVE" : "Cotes avant-match (pas des cotes en direct)"}</span>
        <span className="num text-muted">{live ? `${m.odds.books.join(", ")} · mises à jour ${fmtTime(new Date(m.odds.at).toISOString())}` : "Meilleure cote parmi Betclic, Winamax, Unibet, PMU"}</span>
      </div>
      <div className={`grid gap-2 ${rows.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {rows.map(([k, n, v, book]) => (
          <div key={k} className={`rounded-xl bg-white px-2 py-2 text-center ${v === min ? "ring-2 ring-brand/40" : "ring-1 ring-line"}`}>
            <div className="text-[11px] font-bold text-muted">{k}</div>
            <div className="num text-lg font-extrabold">{o2(v)}</div>
            <div className="truncate text-[10px] text-muted">{book || "meilleure cote"}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span>{m.mk?.length ? "Marchés : " + m.mk.join(", ") : ""}</span>
        {m.eid && <Link href={`/match/${encodeURIComponent(m.eid)}`} className="font-bold text-brand">Analyse du match →</Link>}
      </div>
    </div>
  );
}

function Row({ m }) {
  const live = m.state === "live";
  const status = live ? m.label : m.state === "done" ? "Terminé" : m.state === "off" ? "Reporté" : m.start ? fmtTime(m.start) : "";
  const score = m.h != null && m.a != null && m.state !== "up" && m.state !== "off";
  const Team = ({ t, v }) => (
    <div className="flex items-center gap-3">
      {t.crest ? <img src={t.crest} alt="" width="26" height="26" className="h-[26px] w-[26px] shrink-0 object-contain" loading="lazy" /> : <span className="h-[26px] w-[26px] shrink-0 rounded-full bg-card2" />}
      <span className="min-w-0 flex-1 truncate text-sm font-bold">{fr(t.name)}</span>
      <span className={`num w-9 shrink-0 text-right text-lg font-extrabold ${live ? "text-bad" : ""}`}>{score ? v : ""}</span>
    </div>
  );
  const ev = [...(m.goals || []).map((g) => ({ ...g, k: "goal" })), ...(m.cards || []).map((c) => ({ ...c, k: c.kind }))].sort((x, y) => (x.min ?? 0) - (y.min ?? 0));
  return (
    <div className="border-t border-line first:border-t-0">
      <div className="flex items-stretch gap-3 px-4 py-3">
        <div className={`num flex w-[4.25rem] shrink-0 flex-col items-start justify-center text-xs font-bold leading-tight ${live ? "text-bad" : "text-muted"}`}>
          {live && <span className="live-dot mb-1 inline-block h-2 w-2 rounded-full bg-bad" />}{status}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5"><Team t={m.home} v={m.h} /><Team t={m.away} v={m.a} /></div>
      </div>
      {ev.length > 0 && (
        <ul className="space-y-0.5 px-4 pb-3 pl-[5.5rem] text-xs text-muted">
          {ev.map((g, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="num w-8 shrink-0 text-right">{g.min != null ? g.min + "'" : ""}</span>
              <span aria-hidden>{g.k === "goal" ? "⚽" : g.k === "red" ? "🟥" : "🟨"}</span>
              <b className="truncate text-ink">{g.name}</b>
              <span className="truncate">({g.team === "h" ? fr(m.home.name) : fr(m.away.name)}){g.k === "goal" ? (/OWN/i.test(g.type) ? " csc" : /PEN/i.test(g.type) ? " pen." : "") : ""}</span>
            </li>
          ))}
        </ul>
      )}
      <OddsZone m={m} />
      {(m.eid || m.sid) && !(m.eid && ((m.state === "live" && m.odds) || (m.pre && m.state !== "done"))) && <p className="px-4 pb-2 pl-[5.5rem]"><Link href={`/match/${encodeURIComponent(m.eid || m.sid)}`} className="text-xs font-bold text-brand">Analyse complète du match →</Link></p>}
      {m.detail && <p className="num px-4 pb-1 pl-[5.5rem] text-xs font-semibold text-ink">Sets : {m.detail}</p>}
      {m.tv && m.state !== "done" && <p className="px-4 pb-2 pl-[5.5rem] text-xs text-muted">📺 {m.tv}</p>}
      {m.pred?.length > 0 && m.state !== "done" && (
        <p className="px-4 pb-3 pl-[5.5rem] text-xs leading-relaxed text-muted"><span className="font-bold text-brand">Analyse</span> · {m.pred.join(" · ")}</p>
      )}
    </div>
  );
}

function Comp({ g, openAll }) {
  const live = g.items.filter((m) => m.state === "live").length;
  const up = g.items.filter((m) => m.state === "up" || m.state === "off").length;
  const done = g.items.filter((m) => m.state === "done").length;
  const order = { live: 0, up: 1, off: 1, done: 2 };
  const items = g.items.slice().sort((x, y) => (order[x.state] - order[y.state]) || String(x.start).localeCompare(String(y.start)));
  return (
    <details open={openAll || live > 0 || g.open} className="group card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 bg-card2 px-4 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-muted transition-transform group-open:rotate-90">▸</span>
        <span className="min-w-0 flex-1 truncate font-bold">{g.name}</span>
        {g.app && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">Sur les applis</span>}
        {live > 0 && <span className="rounded-full bg-bad px-2 py-0.5 text-[10px] font-bold text-white">{live} en direct</span>}
        <span className="num shrink-0 text-xs text-muted">{up > 0 ? `${up} à venir` : ""}{up > 0 && done > 0 ? " · " : ""}{done > 0 ? `${done} terminé${done > 1 ? "s" : ""}` : ""}</span>
      </summary>
      {items.map((m) => <Row key={m.id} m={m} />)}
    </details>
  );
}

function Block({ items, openAll }) {
  const groups = [];
  for (const m of items) {
    const cn = frComp(m.comp) || "Autres compétitions";
    let g = groups.find((x) => x.name === cn);
    if (!g) { g = { name: cn, items: [], app: false }; groups.push(g); }
    g.items.push(m);
    if (m.app) g.app = true;
  }
  const rank = (g) => (g.items.some((m) => m.state === "live") ? 0 : 2) + (g.app ? 0 : 1);
  groups.sort((x, y) => rank(x) - rank(y) || String(x.items[0].start).localeCompare(String(y.items[0].start)));
  let k = 0;
  for (const g of groups) { if (g.app && k < 2) { g.open = true; k++; } }
  return <div className="space-y-2">{groups.map((g) => <Comp key={g.name} g={g} openAll={openAll} />)}</div>;
}

function SportSection({ id, icon, label, items, note, openAll, next = [] }) {
  const liveL = items.filter((m) => m.state === "live");
  const soon = items.filter((m) => m.state === "up" || m.state === "off");
  const done = items.filter((m) => m.state === "done");
  const Sub = ({ t, list, tone, all }) => list.length > 0 && (
    <div className="space-y-2">
      <h3 className={`flex items-center gap-2 text-sm font-extrabold ${tone}`}>{t}<span className="num font-medium text-muted">{list.length}</span></h3>
      <Block items={list} openAll={all} />
    </div>
  );
  return (
    <section id={id} className="scroll-mt-28 space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-extrabold"><span aria-hidden>{icon}</span>{label}<span className="num text-sm font-medium text-muted">{items.length}</span>{liveL.length > 0 && <span className="rounded-full bg-bad px-2 py-0.5 text-xs font-bold text-white">{liveL.length} en direct</span>}</h2>
      {items.length === 0 ? <p className="card p-4 text-sm text-muted">{note || "Aucun match du jour dans une compétition suivie."}</p> : (
        <>
          <Sub t="🔴 En direct" list={liveL} tone="text-bad" all />
          <Sub t="À venir aujourd'hui" list={soon} tone="text-ink" all />
          <Sub t="Terminés récemment" list={done} tone="text-muted" all={false} />
        </>
      )}
      {next.length > 0 && <Sub t="Demain" list={next} tone="text-ink" all={false} />}
    </section>
  );
}

export default async function Live({ searchParams }) {
  const sp = (await searchParams) || {};
  const view = ["live", "all", "apps"].includes(sp.v) ? sp.v : "all";
  const onlyLive = view === "live";
  const tomorrowKey = (() => { const d = new Date(Date.now() + 864e5); return dayKey(d.toISOString()); })();
  const [fd, other, af, es, tn, tmw] = await Promise.all([getLive(), getOtherLive(), getFootLive(), getFootEspn(), getTennisLive(), getFootByDate(tomorrowKey).catch(() => ({ items: [] }))]);
  const today = dayKey(new Date().toISOString());
  const foot = (fd.matches || []).map(fromFd).filter((m) => m.state === "live" || dayKey(m.start) === today).sort((a, b) => String(a.start).localeCompare(String(b.start)));
  // football-data (actualisé chaque minute) prioritaire ; API-Sports ajoute les autres compétitions.
  const seen = foot.map((m) => [key(m.home.name), key(m.away.name), +new Date(m.start)]);
  const esp = (es.items || []).filter((m) => m.state === "live" || dayKey(m.start) === today).filter((m) => !isDup(seen, m));
  seen.push(...esp.map((m) => [key(m.home.name), key(m.away.name), +new Date(m.start)]));
  const extra = af.items.filter((m) => m.state === "live" || dayKey(m.start) === today).filter((m) => !isDup(seen, m));
  const allFoot = [...foot, ...esp, ...extra].sort((x, y) => String(x.start).localeCompare(String(y.start)));
  for (const m of allFoot) {
    if (/^se\d+$/.test(m.id)) { m.sid = m.id; continue; }
    const t = +new Date(m.start);
    let best = null, bs = 0;
    for (const e of es.items || []) {
      if (Math.abs(+new Date(e.start) - t) > 3 * 3600e3) continue;
      const s = Math.min(sim(m.home.name, e.home.name), sim(m.away.name, e.away.name));
      if (s > bs) { bs = s; best = e; }
    }
    if (best && bs >= 0.5) m.sid = best.id;
  }
  // Buteurs : détail des matchs en cours ou terminés avec au moins un but (football-data.org).
  const need = foot.filter((m) => m.rawId && (m.state === "live" || m.state === "done") && (m.h > 0 || m.a > 0)).slice(0, 8);
  const gl = await Promise.all(need.map((m) => getGoals(m.rawId)));
  need.forEach((m, i) => { m.goals = gl[i]; });
  const sections = [
    { id: "football", icon: "⚽", label: "Football", items: allFoot, error: null, next: (tmw.items || []).filter((m) => m.state === "up" && dayKey(m.start) === tomorrowKey).map((m) => ({ ...m, sid: m.id })) },
    { id: "tennis", icon: "🎾", label: "Tennis", items: tn.items || [], error: null, note: "Aucun match de tennis (ATP ou WTA) en cours ou proche pour le moment." },
    ...OTHER.map((s) => ({ id: s.id, icon: s.icon, label: s.label, items: other.sports[s.id]?.items || [], error: null })).filter((s) => s.items.length > 0),
  ].sort((a, b) => { const o = ["football", "tennis", "basket", "hockey", "nfl", "baseball", "rugby", "mma"]; return o.indexOf(a.id) - o.indexOf(b.id); });
  const enr = await loadEnriched().then((d) => d.matches || []).catch(() => []);
  for (const s of sections) {
    const sk = SPORT_KEY[s.id];
    if (!sk) continue;
    for (const m of s.items) {
      const e = findEnriched(m, sk, enr);
      if (e) { m.app = true; m.eid = e.id; m.mk = [(e.outcomes || []).length >= 2 && "1N2", (e.totals || []).length > 0 && "Plus/moins", (e.spreads || []).length > 0 && "Handicap", e.extras?.btts && "Les deux marquent", (e.extras?.scorers || []).length > 0 && "Buteurs"].filter(Boolean); try { m.pre = preOf(e); } catch {} if (m.state !== "done") { try { m.pred = predOf(m, e, sk); } catch {} } }
    }
  }
  const liveRows = sections.flatMap((s) => (SPORT_KEY[s.id] ? s.items.filter((m) => m.state === "live").map((m) => ({ id: m.id, sport: SPORT_KEY[s.id], home: m.home.name, away: m.away.name, start: m.start })) : []));
  const lodds = liveRows.length ? await getLiveOdds(liveRows).catch(() => ({})) : {};
  for (const s of sections) for (const m of s.items) if (lodds[m.id]) m.odds = lodds[m.id];
  const liveCount = sections.reduce((n, s) => n + s.items.filter((m) => m.state === "live").length, 0);

  const appComps = (items) => { const names = new Set(items.filter((m) => m.app).map((m) => m.comp)); return items.filter((m) => names.has(m.comp)); };
  const appCount = sections.reduce((n, s) => n + appComps(s.items).length, 0);
  const effView = view === "apps" && appCount === 0 ? "all" : view;
  const shown = (effView === "live" ? sections.map((s) => ({ ...s, items: s.items.filter((m) => m.state === "live") })) : effView === "apps" ? sections.map((s) => ({ ...s, items: appComps(s.items) })) : sections).filter((s) => s.items.length || effView === "all");
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const chip = (to, label, active) => <Link href={to} className={`tab shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "border-navy bg-navy text-white" : "border-line bg-white text-muted hover:text-ink"}`}>{label}</Link>;
  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} stamp={new Date().toISOString()} />
      <section className="hero p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Scores en direct</h1>
        <p className="muted mt-2 max-w-xl text-sm">{liveCount > 0 ? `${liveCount} match${liveCount > 1 ? "s" : ""} en cours.` : "Aucun match en cours pour le moment."} La vue « Sur les applis de paris » regroupe les matchs que proposent Betclic, Winamax, Unibet ou PMU (avec leurs meilleures cotes) ; chaque compétition se déplie d'un clic. Mise à jour automatique toutes les 10 secondes ; les minutes marquées « ≈ » sont estimées à partir du coup d'envoi.</p>
      </section>
      {(fd.error || es.error || af.error) && <p className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-xs text-warn">Une source de scores ne répond pas ({[fd.error && "football-data", es.error && "ESPN"].filter(Boolean).join(", ") || "API-Sports"}) : certains matchs peuvent manquer ou être en retard. Les scores affichés ne sont pas garantis en temps réel.</p>}
      <div className="flex gap-2 overflow-x-auto">{chip("/live?v=apps", `Sur les applis de paris (${appCount})`, effView === "apps")}{chip("/live?v=live", `En direct (${liveCount})`, effView === "live")}{chip("/live", `Tous les matchs (${total})`, effView === "all")}</div>
      {view === "apps" && appCount === 0 && <p className="card p-3 text-xs text-muted">Aucun match du jour n'est reconnu dans les cotes des bookmakers pour le moment : tous les matchs sont affichés.</p>}
      <nav aria-label="Sports" className="sticky top-[60px] z-20 -mx-4 flex gap-2 overflow-x-auto bg-bg/95 px-4 py-2 backdrop-blur">
        {shown.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="tab shrink-0 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-semibold text-ink hover:border-navy">
            <span aria-hidden>{s.icon}</span> {s.label}{s.items.some((m) => m.state === "live") && <span className="live-dot ml-1.5 inline-block h-2 w-2 rounded-full bg-bad align-middle" />}
          </a>
        ))}
      </nav>
      {effView === "live" && shown.length === 0 && <p className="card p-4 text-sm text-muted">Aucun match en cours pour le moment. Les prochains coups d'envoi sont dans « Tous les matchs ».</p>}
      {shown.map((s) => <SportSection key={s.id} {...s} openAll={effView === "live"} />)}
      
      <p className="text-xs text-muted">Sources : football-data.org et ESPN (une cinquantaine de championnats et coupes de football dans le monde), ESPN (NBA, WNBA, basket et football US universitaires, NFL, tennis ATP et WTA), NHL, MLB. Diffusion : chaînes indiquées par ESPN et la NHL quand elles existent (surtout États-Unis). Les scores peuvent avoir quelques minutes de retard.</p>
    </div>
  );
}
