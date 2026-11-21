// Pronos IA hors football (tennis, basket, hockey, rugby) à partir du calendrier ESPN, même sans flux de cotes françaises.
// Probabilité : marché (cotes ESPN converties, marge retirée) quand elles existent, sinon modèle (Elo tennis appris sur
// 47 000 matchs, bilan des équipes). Seuls des paris proposés par Winamax, Betclic, Unibet et PMU : le vainqueur du match.
import { unstable_cache } from "next/cache";
import { espnJson } from "./espnfetch.js";
import { eloProb } from "./tennisElo.js";
import { dayKey } from "./format.js";

const BASE = "https://site.api.espn.com/apis/site/v2/sports/";
const ymd = (t) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/New_York" }).replace(/-/g, "");
const ml2dec = (v) => { const n = Number(String(v ?? "").replace("+", "")); if (!Number.isFinite(n) || n === 0) return null; return n > 0 ? 1 + n / 100 : 1 + 100 / -n; };
const devig2 = (a, b) => { if (!a || !b) return null; const x = 1 / a, y = 1 / b; return [x / (x + y), y / (x + y)]; };
const recPct = (t) => { const s = (t.records || t.record || []).find?.((r) => /total|overall|ytd/i.test(r.type || r.name || "")) || (t.records || [])[0]; const m = /^(\d+)-(\d+)/.exec(s?.summary || ""); return m ? { w: +m[1], l: +m[2], s: s.summary } : null; };

function moneyline(c) {
  const o = (c.odds || [])[0];
  if (!o) return null;
  const h = ml2dec(o.homeTeamOdds?.moneyLine ?? o.moneyline?.home?.close?.odds ?? o.moneyline?.home?.open?.odds);
  const a = ml2dec(o.awayTeamOdds?.moneyLine ?? o.moneyline?.away?.close?.odds ?? o.moneyline?.away?.open?.odds);
  return devig2(h, a);
}

async function teamSport(path, label, icon, homeAdv) {
  const now = Date.now(), out = [];
  for (const d of [ymd(now), ymd(now + 864e5)]) {
    let j; try { j = await espnJson(`${BASE}${path}/scoreboard?dates=${d}`); } catch { continue; }
    for (const e of j.events || []) {
      const c = e.competitions?.[0]; if (!c || c.status?.type?.state !== "pre") continue;
      const t = +new Date(e.date); if (!(t > now && t < now + 36 * 3600e3)) continue;
      const cs = c.competitors || [], H = cs.find((x) => x.homeAway === "home"), A = cs.find((x) => x.homeAway === "away");
      if (!H?.team || !A?.team) continue;
      const rh = recPct(H), ra = recPct(A);
      let pH = null, src = "";
      const mk = moneyline(c);
      if (mk) { pH = mk[0]; src = "consensus des bookmakers (marge retirée)"; }
      else if (rh && ra && rh.w + rh.l >= 5 && ra.w + ra.l >= 5) {
        const a = (rh.w + 1) / (rh.w + rh.l + 2), b = (ra.w + 1) / (ra.w + ra.l + 2);
        pH = Math.min(0.9, Math.max(0.1, (a * (1 - b)) / (a * (1 - b) + b * (1 - a)) + homeAdv));
        src = "bilan des deux équipes cette saison + avantage du terrain";
      }
      if (pH == null) continue;
      const fav = pH >= 0.5 ? "h" : "a", p = fav === "h" ? pH : 1 - pH;
      const W = fav === "h" ? H : A, L = fav === "h" ? A : H, rw = fav === "h" ? rh : ra, rl = fav === "h" ? ra : rh;
      const why = [
        `${W.team.displayName} est donné gagnant à ${Math.round(p * 100)} % (${src}).`,
        rw && rl ? `Bilan de la saison : ${W.team.displayName} ${rw.s}, ${L.team.displayName} ${rl.s}.` : null,
        fav === "h" ? `${W.team.displayName} joue à domicile.` : `${W.team.displayName} gagne malgré le déplacement selon notre estimation.`,
      ].filter(Boolean).join(" ");
      out.push({ id: path + e.id, sport: label, icon, comp: path.includes("nba") ? "NBA" : path.includes("college-basketball") ? "NCAA (basket universitaire)" : path.includes("nfl") ? "NFL" : label === "Hockey" ? "NHL" : e.season?.slug || label,
        start: e.date, home: { name: H.team.displayName, logo: H.team.logo }, away: { name: A.team.displayName, logo: A.team.logo },
        pick: `Victoire ${W.team.displayName}`, p, fair: 1 / p, why, href: `/live` });
    }
  }
  return out;
}

async function tennis() {
  const now = Date.now(), out = [];
  for (const tour of ["atp", "wta"]) {
    let j; try { j = await espnJson(`${BASE}tennis/${tour}/scoreboard`); } catch { continue; }
    for (const ev of j.events || []) {
      const comps = ev.groupings?.length ? ev.groupings.filter((g) => /singles/i.test(g.grouping?.displayName || "")).flatMap((g) => g.competitions || []) : ev.competitions || [];
      for (const c of comps) {
        if (c.status?.type?.state !== "pre") continue;
        const t = +new Date(c.date || c.startDate || ev.date); if (!(t > now - 3600e3 && t < now + 36 * 3600e3)) continue;
        const [a, b] = (c.competitors || []).slice().sort((x, y) => (x.order || 0) - (y.order || 0));
        const n1 = a?.athlete?.displayName, n2 = b?.athlete?.displayName; if (!n1 || !n2 || /\//.test(n1 + n2)) continue;
        const e = eloProb(n1, n2); if (!e) continue;
        const fav = e.p >= 0.5, p = fav ? e.p : 1 - e.p, W = fav ? e.A : e.B, L = fav ? e.B : e.A;
        const why = `Classement Elo FightEdge (appris sur 47 000 matchs) : ${W.name} ${W.elo} contre ${L.name} ${L.elo}. Forme : ${Math.round(W.form * 10)} victoires sur ses 10 derniers matchs (${Math.round(W.dom * 100)} % des jeux gagnés) contre ${Math.round(L.form * 10)} pour ${L.name}. Sur nos tests, quand ce modèle annonce ${Math.round(p * 100)} %, le favori gagne au moins aussi souvent.`;
        out.push({ id: "te" + c.id, sport: "Tennis", icon: "🎾", comp: ev.name || tour.toUpperCase(), start: c.date || ev.date,
          home: { name: n1, logo: a.athlete?.flag?.href || null }, away: { name: n2, logo: b.athlete?.flag?.href || null },
          pick: `Victoire ${W.name}`, p, fair: 1 / p, why, href: "/live" });
      }
    }
  }
  return out;
}

// Rugby : seulement quand ESPN publie des cotes (sinon pas assez de données fiables).
const RUGBY = [["rugby/270559", "Top 14"], ["rugby/267979", "Premiership"], ["rugby/270557", "URC"], ["rugby/271937", "Champions Cup"], ["rugby/289234", "Tests internationaux"]];

const load = unstable_cache(async () => {
  const rs = await Promise.allSettled([
    tennis(),
    teamSport("basketball/nba", "Basket", "🏀", 0.03),
    teamSport("hockey/nhl", "Hockey", "🏒", 0.02),
    teamSport("basketball/mens-college-basketball", "Basket", "🏀", 0.04),
    teamSport("football/nfl", "Foot US", "🏈", 0.03),
    ...RUGBY.map(([p, n]) => teamSport(p, "Rugby", "🏉", 0.05).then((xs) => xs.filter((x) => /consensus/.test(x.why)).map((x) => ({ ...x, comp: n })))),
  ]);
  return rs.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}, ["sportpicks-v2"], { revalidate: 900 });

// 2 à 4 pronos par sport et par jour : les plus probables, mais pas les « évidences » à cote trop faible.
export async function sportPicks() {
  let all = [];
  try { all = await load(); } catch { return []; }
  const seen = new Set(), out = [];
  const groups = {};
  for (const x of all) { if (seen.has(x.id)) continue; seen.add(x.id); (groups[x.sport + "|" + dayKey(x.start)] ||= []).push(x); }
  for (const g of Object.values(groups)) {
    const ok = g.filter((x) => x.p >= 0.52 && x.p <= 0.9).sort((a, b) => b.p - a.p);
    out.push(...ok.slice(0, 4));
  }
  return out.sort((a, b) => String(a.start).localeCompare(String(b.start)));
}
