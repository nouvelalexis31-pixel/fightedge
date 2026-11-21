// Cotes en direct : The Odds API (cotes des bookmakers pendant le match, quand ils en proposent).
// On ne montre que des cotes récentes (mises à jour il y a moins de 10 minutes) : jamais de cote périmée présentée comme "en direct".
import { FR, oddsKeys } from "./odds.js";
import { nameSim } from "./analysis.js";
import { canon } from "./fr.js";

const BASE = "https://api.the-odds-api.com/v4";
const GROUPS = { Soccer: "football", Tennis: "tennis", Basketball: "basketball", "Ice Hockey": "hockey", "American Football": "americanfootball", Baseball: "baseball", "Rugby Union": "rugby", "Rugby League": "rugby" };
const DUR = { football: 3.2, tennis: 6, basketball: 3.5, hockey: 3.5, americanfootball: 4.5, baseball: 4.5, rugby: 2.8 };
const FRESH = 10 * 60 * 1000;
const RESERVE = 150; // crédits laissés aux cotes d'avant-match
const norm = (x) => String(canon(x) || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const sim = (a, b) => { const na = norm(a), nb = norm(b); const loose = na.length >= 3 && nb.length >= 3 && (na.includes(nb) || nb.includes(na)) ? 0.8 : 0; return Math.max(nameSim(a, b), loose); };

async function call(path, rev) {
  const keys = oddsKeys();
  const sep = path.includes("?") ? "&" : "?";
  let res;
  for (const key of keys) {
    res = await fetch(`${BASE}${path}${sep}apiKey=${key}`, { next: { revalidate: rev } });
    if (res.status !== 401 && res.status !== 429) break;
  }
  if (!res || !res.ok) throw new Error("odds " + (res && res.status));
  const rem = Number(res.headers.get("x-requests-remaining"));
  return { data: await res.json(), remaining: Number.isFinite(rem) ? rem : null };
}

// rows : [{ id, sport, home, away, start }] des matchs en direct. Retourne { [id]: { home, draw, away, books, at } }
export async function getLiveOdds(rows) {
  const out = {};
  const live = (rows || []).filter((r) => r.sport && DUR[r.sport]);
  if (!live.length || !process.env.ODDS_API_KEY) return out;
  try {
    const s = await call("/sports", 300);
    if (s.remaining != null && s.remaining < RESERVE) return out;
    const sports = s.data.filter((x) => x.active && !x.has_outrights && GROUPS[x.group] && live.some((r) => r.sport === GROUPS[x.group]));
    const now = Date.now();
    const evs = await Promise.allSettled(sports.map(async (x) => ({ key: x.key, sport: GROUPS[x.group], events: (await call(`/sports/${x.key}/events?dateFormat=iso`, 600)).data })));
    const wanted = new Map(); // key -> [{ev, row}]
    for (const r of evs) {
      if (r.status !== "fulfilled") continue;
      const { key, sport, events } = r.value;
      for (const e of events) {
        const t = +new Date(e.commence_time);
        if (!(t <= now + 5 * 60e3 && t >= now - DUR[sport] * 3600e3)) continue;
        let best = null, bs = 0;
        for (const row of live) {
          if (row.sport !== sport) continue;
          if (Math.abs(+new Date(row.start) - t) > 3 * 3600e3) continue;
          const sh = sim(row.home, e.home_team), sa = sim(row.away, e.away_team);
          const sc = Math.min(sh, sa);
          if (sc >= 0.45 && sc > bs) { bs = sc; best = row; }
        }
        if (best) { if (!wanted.has(key)) wanted.set(key, []); wanted.get(key).push({ ev: e, row: best }); }
      }
    }
    const keys = [...wanted.keys()].slice(0, 6);
    await Promise.allSettled(keys.map(async (k) => {
      const list = wanted.get(k);
      const ids = list.map((x) => x.ev.id).join(",");
      const r = await call(`/sports/${k}/odds?regions=eu&markets=h2h&oddsFormat=decimal&dateFormat=iso&eventIds=${ids}`, 240);
      for (const e of r.data) {
        const link = list.find((x) => x.ev.id === e.id);
        if (!link) continue;
        const fresh = [];
        for (const b of e.bookmakers || []) {
          const m = (b.markets || []).find((x) => x.key === "h2h");
          if (!m) continue;
          const lu = +new Date(m.last_update || b.last_update || 0);
          if (!(now - lu <= FRESH)) continue;
          const price = (n) => (m.outcomes || []).find((o) => o.name === n)?.price;
          const h = price(e.home_team), a = price(e.away_team), d = price("Draw");
          if (!(h > 1) || !(a > 1)) continue;
          fresh.push({ key: b.key, title: FR[b.key] || b.title || b.key, fr: !!FR[b.key], h, a, d: d > 1 ? d : null, lu });
        }
        const frs = fresh.filter((x) => x.fr);
        let o = null;
        if (frs.length) {
          const best = (f) => frs.reduce((acc, x) => (x[f] != null && (!acc || x[f] > acc.v) ? { v: x[f], b: x.title } : acc), null);
          const h = best("h"), a = best("a"), d = best("d");
          o = { home: h.v, away: a.v, draw: d ? d.v : null, books: [...new Set(frs.map((x) => x.title))], at: Math.max(...frs.map((x) => x.lu)) };
        } else if (fresh.length) {
          const x = fresh.sort((p, q) => q.lu - p.lu)[0];
          o = { home: x.h, away: x.a, draw: x.d, books: [x.title], at: x.lu, other: true };
        }
        if (o) out[link.row.id] = o;
      }
    }));
  } catch {}
  return out;
}
