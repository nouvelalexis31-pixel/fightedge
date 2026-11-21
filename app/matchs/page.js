import Link from "next/link";
import { redirect } from "next/navigation";
import { getSummary } from "@/lib/espnsum";
import { dailyPicks, dailyCombos } from "@/lib/analysis";
import { PickCard } from "@/components/PickCard";
import { ComboCard } from "@/components/ComboCard";
import { SPORTS } from "@/lib/odds";
import { loadEnriched } from "@/lib/data";
import { Setup } from "@/components/Setup";
import { dayKey, fmtDayShort, fmtDateTime, fmtTime, todayKey } from "@/lib/format";
import { getFootByDate } from "@/lib/livex";
import { fr } from "@/lib/fr";
import { findInfo } from "@/lib/matchinfo";
import { MatchRow } from "@/components/MatchRow";
import { flagOf } from "@/components/flags";

const nz = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(fc|cf|ac|as|sc|ss|us|rc|ud|cd|sv|afc|club|de|the)\b|[^a-z0-9]/g, "");
const near = (a, b) => { const x = nz(a), y = nz(b); return x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x) || x.slice(0, 5) === y.slice(0, 5)); };
const addD = (k, n) => { const d = new Date(k + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export const revalidate = 1800;
export const dynamic = "force-dynamic";

export const metadata = { title: "Matchs et cotes" };

export default async function Home({ searchParams }) {
  const { sport, q, jour, comp, mk: mkt, fi, go } = await searchParams;
  const data = await loadEnriched();
  const all = data.matches || [];
  const oddsDown = all.length === 0; // cotes indisponibles : le calendrier (ESPN) reste affiché
  const today = todayKey();
  const dayKeys = [...new Set(all.map((m) => dayKey(m.start)))].filter(Boolean).sort();
  const day = jour && /^\d{4}-\d{2}-\d{2}$/.test(jour) ? jour : dayKeys.includes(today) || !dayKeys.length ? today : dayKeys[0];
  const cal = !sport || sport === "football" ? await getFootByDate(day) : null;
  const ofDay = all.filter((m) => dayKey(m.start) === day);
  const counts = Object.fromEntries(Object.keys(SPORTS).map((k) => [k, ofDay.filter((m) => m.sport === k).length]));
  const TERM_ALIAS = { psg: "paris saint", om: "marseille", ol: "lyon", asm: "monaco", losc: "lille", rcl: "lens", asse: "saint-etienne", "man utd": "manchester united", "man united": "manchester united", "man city": "manchester city", barca: "barcelona", "barça": "barcelona", real: "real madrid", atletico: "atl", inter: "inter", juve: "juventus", bayern: "bayern" };
  const term0 = (q || "").trim().toLowerCase();
  const term = TERM_ALIAS[term0] || term0;
  const comps = [...new Set(ofDay.filter((m) => !sport || m.sport === sport).map((m) => m.league))].sort();
  const MK = { totals: ["Plus / moins", (m) => (m.totals || []).length > 0], spreads: ["Handicap", (m) => (m.spreads || []).length > 0], draw: ["1 N 2 (nul possible)", (m) => (m.outcomes || []).length === 3], btts: ["Les deux marquent", (m) => !!m.extras?.btts], scorers: ["Buteurs", (m) => !!(m.extras?.scorers || []).length] };
  const minBooks = fi === "3" ? 5 : fi === "2" ? 3 : 0;
  const shown = ofDay.filter((m) => (!sport || m.sport === sport) && (!comp || m.league === comp) && (!mkt || !MK[mkt] || MK[mkt][1](m)) && (m.nBooks || 0) >= minBooks && (!term || `${m.home} ${m.away} ${m.league}`.toLowerCase().includes(term)));

  const leagues = [];
  for (const m of shown) {
    let l = leagues.find((x) => x.name === m.league && x.sport === m.sport);
    if (!l) { l = { name: m.league, sport: m.sport, items: [] }; leagues.push(l); }
    l.items.push(m);
  }
  { const SO = ["football", "tennis", "basketball", "hockey", "americanfootball", "baseball", "rugby", "mma", "boxing"]; const oi = (s) => { const i = SO.indexOf(s); return i < 0 ? 99 : i; }; leagues.sort((a, b) => oi(a.sport) - oi(b.sport)); }
  const href = (o) => {
    const j = o.jour !== undefined ? o.jour : day === today ? "" : day;
    const sp = o.sport !== undefined ? o.sport : sport || "";
    const p = new URLSearchParams();
    if (j) p.set("jour", j);
    if (sp) p.set("sport", sp);
    if (comp) p.set("comp", comp);
    if (mkt) p.set("mk", mkt);
    if (fi) p.set("fi", fi);
    if (term) p.set("q", q);
    const qs = p.toString();
    return qs ? `/matchs?${qs}` : "/matchs";
  };
  const chip = (to, label, active, n) => (
    <Link key={label} href={to} className={`tab shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "border-navy bg-navy text-white" : "border-line bg-white text-muted hover:text-ink"}`}>
      {label}{typeof n === "number" ? <span className="ml-1.5 opacity-70">{n}</span> : null}
    </Link>
  );
  const dayLabel = (k) => (k === today ? "Aujourd'hui" : fmtDayShort(k));

  // Liste unique : calendrier ESPN (tous les championnats) + cotes quand on les a ; matchs avec cotes absents d'ESPN et autres sports en complément.
  const calOn = !!cal && !mkt && !fi;
  const used = new Set();
  const rows = [];
  if (calOn) {
    for (const m of cal.items) {
      if (term && !`${m.home.name} ${m.away.name} ${m.comp}`.toLowerCase().includes(term)) continue;
      if (comp && m.comp !== comp) continue;
      const e = ofDay.find((x) => x.sport === "football" && near(x.home, m.home.name) && near(x.away, m.away.name));
      if (e) used.add(e.id);
      rows.push({ key: m.id, league: m.comp, flag: flagOf({ slug: m.slug, name: m.comp }), sport: "football", home: fr(m.home.name), away: fr(m.away.name), hl: e?.logos?.homeCrest || m.home.crest, al: e?.logos?.awayCrest || m.away.crest, start: m.start, state: m.state, label: m.label, h: m.h, a: m.a, venue: m.venue, sid: m.id, e });
    }
  }
  for (const e of shown) {
    if (calOn && e.sport === "football" && used.has(e.id)) continue;
    rows.push({ key: e.id, league: e.league, flag: e.sport === "football" ? flagOf({ sk: e.key || e.sk, name: e.league }) : SPORTS[e.sport].icon, sport: e.sport, home: e.home, away: e.away, hl: e.logos?.homeCrest, al: e.logos?.awayCrest, start: e.start, state: "up", e });
  }
  // Recherche d'une équipe : si elle ne joue pas ce jour-là, on va directement à son prochain match.
  let noNext = false;
  if (term && go) {
    const nowMs = Date.now();
    const cands = [];
    const live = (st) => /^(live|in)$/.test(String(st || ""));
    const days = Array.from({ length: 14 }, (_, n) => addD(today, n));
    const cs = await Promise.all(days.map((k) => (k === day && cal ? Promise.resolve(cal) : getFootByDate(k).catch(() => null))));
    for (const c of cs) for (const m of c?.items || []) {
      const hay = (m.home.name + " " + m.away.name + " " + fr(m.home.name) + " " + fr(m.away.name)).toLowerCase();
      if (!hay.includes(term) || /\bwomen\b|\bfeminin|\(w\)|\bu-?(1\d|2\d)\b|\breserves?\b|\byouth\b|lyonnes|lionesses|\bladies\b|femenin|\bfrauen\b|\bdames\b|\bfeminas?\b/i.test(m.home.name + " " + m.away.name)) continue;
      const t = +new Date(m.start);
      if (!(t >= nowMs - 3 * 3600e3 || live(m.state))) continue;
      const e = all.find((x) => x.sport === "football" && near(x.home, m.home.name) && near(x.away, m.away.name) && Math.abs(+new Date(x.start) - t) < 6 * 3600e3);
      cands.push({ id: e ? e.id : m.id, t, names: [m.home.name, m.away.name] });
    }
    for (const m of all) {
      if (!(m.home + " " + m.away).toLowerCase().includes(term)) continue;
      const t = +new Date(m.start);
      if (t < nowMs - 3 * 3600e3 || cands.some((c) => c.id === m.id || (Math.abs(c.t - t) < 6 * 3600e3 && c.names.some((n) => near(n, m.home))))) continue;
      cands.push({ id: m.id, t, names: [m.home, m.away] });
    }
    cands.sort((a, b) => a.t - b.t);
    {
      const chk = await Promise.all(cands.slice(0, 8).map(async (c) => {
        if (!/^se\d+$/.test(String(c.id))) return c;
        const S = await getSummary(c.id).catch(() => null);
        if (!S) return null;
        return /women|femin|femenil|frauen|\bu-?(1\d|2\d)\b|youth|reserve|lionesses|lyonnes/i.test(S.league + " " + S.home.name + " " + S.away.name) ? null : c;
      }));
      const keep = chk.filter(Boolean);
      cands.length = 0;
      cands.push(...keep);
    }
    if (cands.length) {
      const ex = cands.filter((c) => c.names.some((n) => nz(fr(n)) === nz(q.trim())));
      const pool2 = ex.length ? ex : cands;
      const mt = new Set();
      for (const c of pool2.slice(0, 3)) for (const n of c.names) if ((n + " " + fr(n)).toLowerCase().includes(term)) mt.add(nz(fr(n)));
      const first = pool2[0];
      if (mt.size <= 1) redirect("/match/" + encodeURIComponent(first.id));
      const fk = dayKey(new Date(first.t).toISOString());
      if (fk !== day) redirect("/matchs?jour=" + fk + "&q=" + encodeURIComponent(q.trim()));
    } else noNext = true;
  }
  const picksIA = dailyPicks(all).slice(0, 3);
  const comboIA = dailyCombos(all)[0];
  const iconsIA = Object.fromEntries(Object.entries(SPORTS).map(([k, v]) => [k, v.icon]));
  const BIG = ["Ligue 1", "Premier League", "LaLiga", "Serie A", "Bundesliga", "Ligue des champions", "Ligue Europa", "Ligue Europa Conférence", "Ligue 2"];
  const SOP = ["football", "tennis", "basketball", "hockey", "americanfootball", "baseball", "rugby", "mma", "boxing"];
  const board = [];
  for (const r of rows) {
    const k = r.sport + "|" + nz(r.league);
    let g = board.find((x) => x.k === k);
    if (!g) { g = { k, name: r.league, flag: r.flag, sport: r.sport, items: [] }; board.push(g); }
    g.items.push(r);
  }
  for (const g of board) g.items.sort((x, y) => String(x.start).localeCompare(String(y.start)));
  const bi = (n) => { const i = BIG.indexOf(n); return i < 0 ? 99 : i; };
  board.sort((a, b) => SOP.indexOf(a.sport) - SOP.indexOf(b.sport) || bi(a.name) - bi(b.name) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-9">
      {data.stale && <div className="card border-warn/30 bg-warn/5 p-4 text-sm leading-relaxed"><b>Cotes enregistrées le {fmtDateTime(data.fetchedAt)}.</b> La source des cotes est indisponible ({data.staleReason}) : ces cotes ne sont pas mises à jour, vérifiez-les sur le site du bookmaker avant de parier.</div>}
      {oddsDown && <div className="card border-warn/30 bg-warn/5 p-4 text-sm leading-relaxed"><b>Cotes indisponibles pour le moment.</b> {data.error || "Aucun match avec cotes."} Le calendrier et les résultats du football ci-dessous restent affichés (source ESPN, indépendante des cotes).</div>}
      <section className="hero p-6 sm:p-8">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20"><span className="live-dot h-2 w-2 rounded-full bg-gold" />{data.fetchedAt ? `Cotes relevées ${fmtDateTime(data.fetchedAt)}${data.stale ? " (non actualisées)" : ""}` : "Cotes réelles"}</p>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">Tous les matchs et leurs cotes</h1>
        <p className="muted mt-3 max-w-2xl text-sm leading-relaxed">Betclic, Winamax, Unibet et PMU comparés. Filtrez par sport, compétition, date, marché disponible ou nombre de bookmakers ; ouvrez un match pour son analyse, tous ses paris et le comparateur de cotes.</p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href={href({ jour: addD(day, -1) })} aria-label="Jour précédent" className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white text-lg font-bold">‹</Link>
          <form action="/matchs" className="flex flex-1 items-center gap-2">
            {sport ? <input type="hidden" name="sport" value={sport} /> : null}
            <input type="date" name="jour" defaultValue={day} aria-label="Choisir une date" className="min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold" />
            <button className="min-h-11 rounded-xl bg-navy px-4 text-sm font-bold text-white">Aller</button>
          </form>
          <Link href={href({ jour: addD(day, 1) })} aria-label="Jour suivant" className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white text-lg font-bold">›</Link>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {dayKeys.map((k) => chip(href({ jour: k === today ? "" : k }), dayLabel(k), k === day))}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {chip(href({ sport: "" }), "Tous", !sport, ofDay.length)}
          {Object.entries(SPORTS).filter(([k]) => counts[k] > 0).map(([k, s]) => chip(href({ sport: k }), `${s.icon} ${s.label}`, sport === k, counts[k]))}
        </div>
        <form action="/matchs" className="space-y-2">
          {sport ? <input type="hidden" name="sport" value={sport} /> : null}
          {day !== today ? <input type="hidden" name="jour" value={day} /> : null}
          <input type="hidden" name="go" value="1" />
          <div className="flex gap-2">
            <input name="q" defaultValue={q || ""} placeholder="Rechercher une équipe, un joueur, une compétition…" aria-label="Rechercher" className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-base shadow-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20" />
            <button className="rounded-2xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-md shadow-brand/25">OK</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select name="comp" defaultValue={comp || ""} aria-label="Compétition" className="rounded-xl border border-line bg-white px-3 py-2 text-sm"><option value="">Toutes les compétitions</option>{comps.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <select name="mk" defaultValue={mkt || ""} aria-label="Marché" className="rounded-xl border border-line bg-white px-3 py-2 text-sm"><option value="">Tous les marchés</option>{Object.entries(MK).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select>
            <select name="fi" defaultValue={fi || ""} aria-label="Fiabilité des cotes" className="rounded-xl border border-line bg-white px-3 py-2 text-sm"><option value="">Fiabilité : toutes</option><option value="2">3 bookmakers ou plus</option><option value="3">5 bookmakers ou plus</option></select>
          </div>
          {(comp || mkt || fi || term) && <Link href={href({ sport: "", jour: "" }).split("?")[0]} className="inline-block text-xs font-bold text-brand">Réinitialiser les filtres</Link>}
        </form>
        {day !== today && !dayKeys.includes(today) && !oddsDown && <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">Plus aucun match à venir aujourd'hui : voici les prochains.</p>}
      </section>
      {noNext && <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">Aucun prochain match trouvé pour « {q} » dans les 8 prochains jours. Vérifiez l'orthographe ou essayez le nom du championnat.</p>}
      {(picksIA.length > 0 || comboIA) && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-xl font-extrabold tracking-tight">Pronos IA du moment</h2>
            <div className="flex gap-3 text-xs font-bold text-brand"><Link href="/pronos">Tous les pronos</Link><Link href="/combines">Combinés</Link></div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {picksIA.map((p) => <PickCard key={p.id} p={p} icon={iconsIA[p.match.sport]} compact />)}
            {comboIA && <ComboCard c={comboIA} icons={iconsIA} />}
          </div>
        </section>
      )}
      <Board board={board} cal={cal} calOn={calOn} day={day} today={today} href={href} comp={comp} />
    </div>
  );
}

function Board({ board, cal, calOn, day, today, href, comp }) {
  const total = board.reduce((n, g) => n + g.items.length, 0);
  const foot = board.filter((g) => g.sport === "football");
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">{day === today ? "Tous les matchs du jour" : `Matchs du ${fmtDayShort(day)}`}</h2>
        <p className="text-xs text-muted">
          {cal?.error ? "Calendrier indisponible pour le moment : " + cal.error + ". " : ""}
          {total} match{total > 1 ? "s" : ""} dans {board.length} compétition{board.length > 1 ? "s" : ""}
          {calOn && cal && !cal.error ? ` · ${cal.total} championnats et coupes interrogés${cal.failed ? " (" + cal.failed + " sans réponse)" : ""} · calendrier ESPN, cotes des bookmakers quand elles sont disponibles` : ""}.
        </p>
      </div>
      {foot.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Link href={href({ comp: "" })} className={`tab shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${!comp ? "border-navy bg-navy text-white" : "border-line bg-white text-muted"}`}>Tous les championnats</Link>
          {foot.slice(0, 24).map((g) => <Link key={g.k} href={href({ comp: g.name })} className={`tab shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${comp === g.name ? "border-navy bg-navy text-white" : "border-line bg-white text-muted hover:text-ink"}`}>{g.flag} {g.name}</Link>)}
        </div>
      )}
      {total === 0 && <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">Aucun match programmé ou joué ce jour dans les compétitions suivies. Rien n'est affiché plutôt que d'inventer une rencontre.</p>}
      {board.map((g) => (
        <div key={g.k} className="card overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-line bg-card2 px-4 py-2.5">
            <span className="text-lg leading-none" aria-hidden>{g.flag}</span>
            <h3 className="min-w-0 flex-1 truncate text-sm font-extrabold">{g.name}</h3>
            <span className="num text-xs font-semibold text-muted">{g.items.length}</span>
          </div>
          {g.items.map((r) => <MatchRow key={r.key} r={r} />)}
        </div>
      ))}
    </section>
  );
}
