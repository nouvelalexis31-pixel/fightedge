// Logos, stade et diffusion d'un match de football : rapprochement des matchs avec cotes et du calendrier ESPN.
import { getFootByDate } from "./livex.js";
import { nameSim } from "./analysis.js";
import { canon } from "./fr.js";
import { logoOf } from "./logos.js";

const norm = (x) => String(canon(x) || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const sim = (a, b) => { const na = norm(a), nb = norm(b); const loose = na.length >= 3 && nb.length >= 3 && (na.includes(nb) || nb.includes(na)) ? 0.8 : 0; return Math.max(nameSim(a, b), loose); };
export const addDay = (k, n) => { const d = new Date(k + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// items : matchs ESPN ; m : match avec cotes { home, away, start }
export function findInfo(items, m) {
  const t = new Date(m.start).getTime();
  let best = null, bs = 0;
  for (const e of items || []) {
    if (Math.abs(new Date(e.start).getTime() - t) > 4 * 3600e3) continue;
    const s = Math.min(sim(m.home, e.home.name), sim(m.away, e.away.name));
    if (s > bs) { bs = s; best = e; }
  }
  if (!best || bs < 0.45) return null;
  return { homeCrest: best.home.crest || null, awayCrest: best.away.crest || null, venue: best.venue || null, tv: best.tv || null, comp: best.comp, state: best.state, h: best.h, a: best.a, sid: best.id };
}

export async function matchInfo(m) {
  if (!m || m.sport !== "football") return null;
  const d = new Date(m.start).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  for (const day of [d, addDay(d, 1), addDay(d, -1)]) {
    const r = await getFootByDate(day);
    const i = findInfo(r.items, m);
    if (i) return i;
  }
  return null;
}

const SPORTS_WITH_CLUBS = new Set(["football", "basketball", "hockey", "rugby", "baseball", "americanfootball"]);
const OTHER_ID = { basketball: "basket", hockey: "hockey", rugby: "rugby", baseball: "baseball", americanfootball: "nfl" };

// Ajoute m.logos = { homeCrest, awayCrest, venue } à chaque match dont le logo est connu (ESPN). Jamais bloquant.
export async function attachLogos(matches) {
  try {
    const list = matches || [];
    const foot = list.filter((m) => m.sport === "football");
    const days = new Set();
    for (const m of foot) { const d = new Date(m.start).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }); days.add(d); days.add(addDay(d, -1)); }
    const want = [...days].sort().slice(0, 4);
    const cals = await Promise.all(want.map((d) => getFootByDate(d).catch(() => ({ items: [] }))));
    const items = cals.flatMap((c) => c.items || []);
    let other = {};
    if (list.some((m) => OTHER_ID[m.sport])) {
      try { const { getOtherLive } = await import("./livex.js"); other = (await getOtherLive()).sports || {}; } catch {}
    }
    const out = list.map((m) => {
      const pool = m.sport === "football" ? items : other[OTHER_ID[m.sport]]?.items;
      const i = pool && pool.length ? findInfo(pool, m) : null;
      return i ? { ...m, logos: { homeCrest: i.homeCrest, awayCrest: i.awayCrest, venue: i.venue } } : m;
    });
    // Écussons manquants : recherche par nom (TheSportsDB), 24 équipes par affichage maximum (le reste suit aux affichages suivants).
    const need = [];
    for (const m of out) if (SPORTS_WITH_CLUBS.has(m.sport)) for (const side of ["home", "away"]) if (!m.logos?.[side + "Crest"]) need.push([m, side]);
    for (let i = 0; i < Math.min(need.length, 24); i += 6) {
      await Promise.all(need.slice(i, i + 6).map(async ([m, side]) => {
        const u = await logoOf(m[side], m.sport);
        if (u) m.logos = { ...(m.logos || {}), [side + "Crest"]: u };
      }));
    }
    return out;
  } catch { return matches; }
}
