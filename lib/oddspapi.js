// Source de secours : OddsPapi (Winamax FR pour les cotes affichées, Pinnacle pour la probabilité du marché).
// Quota gratuit très limité : 1 requête = 1 bookmaker x 1 compétition. On rafraîchit au plus une fois par jour.
const BASE = "https://api.oddspapi.io/v4";
const TOURS = [
  [34, "soccer_france_ligue_one", "Ligue 1"],
  [17, "soccer_epl", "Premier League"],
  [8, "soccer_spain_la_liga", "La Liga"],
  [23, "soccer_italy_serie_a", "Serie A"],
  [35, "soccer_germany_bundesliga", "Bundesliga"],
  [7, "soccer_uefa_champs_league", "UEFA Champions League"],
];
const BOOK = { winamax: ["winamax.fr", "winamax_fr", "Winamax"], pinnacle: ["pinnacle", "pinnacle", "Pinnacle"] };
const TOTALS = [[2.5, "1010", "1011"], [1.5, "108", "109"], [3.5, "1012", "1013"]];
const MAX_AGE = 14 * 864e5;

export const papiOn = () => !!process.env.ODDSPAPI_KEY;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// L'API limite le rythme des requêtes (429) : on espace les appels et on réessaie une fois.
async function get(path, opts = {}) {
  let r;
  for (let i = 0; i < 3; i++) {
    r = await fetch(BASE + path + (path.includes("?") ? "&" : "?") + "apiKey=" + process.env.ODDSPAPI_KEY, opts);
    if (r.status !== 429) break;
    await sleep(1500 * (i + 1));
  }
  if (!r.ok) { const e = new Error("OddsPapi " + r.status); e.status = r.status; throw e; }
  return r.json();
}

const price = (m, id) => {
  const p = m?.outcomes?.[id]?.players?.["0"];
  return p && p.price > 1 ? { price: p.price, at: p.changedAt ? +new Date(p.changedAt) : null } : null;
};

function markets(b, stamp) {
  const m = b?.markets || {};
  const out = [];
  const take = (x) => { if (x.at) { stamp.min = Math.min(stamp.min, x.at); stamp.max = Math.max(stamp.max, x.at); } return x.price; };
  const ok = (x) => x && (!x.at || Date.now() - x.at < MAX_AGE);
  const h = price(m["101"], "101"), d = price(m["101"], "102"), a = price(m["101"], "103");
  if (ok(h) && ok(d) && ok(a)) out.push({ key: "h2h", outcomes: [{ name: "HOME", price: take(h) }, { name: "Draw", price: take(d) }, { name: "AWAY", price: take(a) }] });
  return out.concat(totals(m, stamp, ok, take));
}
function totals(m, stamp, ok, take) {
  // Les marchés "plus / moins" sont rangés sous un identifiant propre à chaque ligne : on cherche celui qui contient les deux issues.
  const ts = [];
  for (const [pt, o, u] of TOTALS) {
    const mk = Object.values(m).find((x) => x?.outcomes?.[o] && x?.outcomes?.[u]);
    const ov = price(mk, o), un = price(mk, u);
    if (ok(ov) && ok(un)) ts.push({ name: "Over", price: take(ov), point: pt }, { name: "Under", price: take(un), point: pt });
  }
  return ts.length ? [{ key: "totals", outcomes: ts }] : [];
}

export async function loadPapi() {
  const names = await get("/participants?sportId=10", { next: { revalidate: 7 * 86400 } });
  const now = Date.now();
  const events = [];
  const stamp = { min: Infinity, max: 0 };
  const errors = [];
  for (const [tid, sk, title] of TOURS) {
    const per = {};
    for (const [k, [slug]] of Object.entries(BOOK)) {
      await sleep(1100);
      try { per[k] = await get(`/odds-by-tournaments?bookmaker=${slug}&tournamentIds=${tid}`, { cache: "no-store" }); }
      catch (e) { errors.push(`${title}/${k}: ${e.message}`); per[k] = []; }
    }
    const pin = new Map((per.pinnacle || []).map((f) => [f.fixtureId, f]));
    for (const f of per.winamax || []) {
      const t = +new Date(f.startTime);
      if (!(t > now) || f.statusId !== 0) continue;
      const home = names[f.participant1Id], away = names[f.participant2Id];
      if (!home || !away) continue;
      const bks = [];
      for (const [k, src] of [["winamax", f], ["pinnacle", pin.get(f.fixtureId)]]) {
        const ms = markets(src?.bookmakerOdds?.[BOOK[k][0]], stamp);
        if (!ms.length) continue;
        for (const m of ms) for (const o of m.outcomes) if (o.name === "HOME") o.name = home; else if (o.name === "AWAY") o.name = away;
        bks.push({ key: BOOK[k][1], title: BOOK[k][2], markets: ms });
      }
      if (!bks.length) continue;
      events.push({ id: "papi-" + f.fixtureId, sport_key: sk, sport_title: title, commence_time: f.startTime, home_team: home, away_team: away, bookmakers: bks, minBooks: 1, key: sk });
    }
  }
  return { events, errors, min: stamp.min === Infinity ? null : new Date(stamp.min).toISOString(), max: stamp.max ? new Date(stamp.max).toISOString() : null };
}
