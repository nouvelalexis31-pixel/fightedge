// Reconstruit le classement Elo tennis (ATP + WTA) depuis l'historique ESPN 2022 → aujourd'hui.
import fs from "fs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CLAY = /roland|french open|monte|madrid|rome|internazionali|barcelona|hamburg|kitzb|gstaad|umag|bastad|båstad|estoril|munich|geneva|lyon|houston|marrakech|bucharest|cordoba|buenos aires|rio|santiago|charleston|bogota|rabat|strasbourg|parma|palermo|prague|warsaw|budapest|lausanne|iasi|bad homburg/i;
const GRASS = /wimbledon|queen|halle|eastbourne|hertogenbosch|stuttgart|mallorca|berlin|nottingham|birmingham|newport|libema/i;
const dates = []; for (let t = +new Date("2022-01-01"); t < Date.now() - 864e5; t += 3 * 864e5) dates.push(new Date(t).toISOString().slice(0, 10).replace(/-/g, ""));
const jobs = dates.flatMap((d) => ["atp", "wta"].map((tour) => ({ d, tour })));
const seen = new Map(); let i = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (i < jobs.length) { const { d, tour } = jobs[i++];
    for (let k = 0; k < 3; k++) { try {
      const j = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/scoreboard?dates=${d}`)).json();
      for (const ev of j.events || []) for (const g of ev.groupings || []) { if (!/Singles/i.test(g.grouping?.displayName || "")) continue;
        for (const c of g.competitions || []) { if (c.status?.type?.state !== "post" || seen.has(c.id)) continue; const cs = c.competitors || []; if (cs.length !== 2) continue;
          const w = cs.findIndex((x) => x.winner); if (w < 0) continue;
          if (/retired|walkover|w\/o/i.test(JSON.stringify(c.status?.type || {}) + (c.notes || []).map((n) => n.text).join(" "))) continue;
          seen.set(c.id, { t: +new Date(c.date), tn: ev.name || "", major: !!ev.major, a: cs[0].athlete?.displayName, b: cs[1].athlete?.displayName, w, sets: cs.map((x) => (x.linescores || []).map((l) => l.value)) }); } }
      break; } catch { await sleep(1500); } }
  }
}));
const rows = [...seen.values()].filter((r) => r.a && r.b).sort((x, y) => x.t - y.t);
const P = new Map(); const pl = (k) => { if (!P.has(k)) P.set(k, { elo: 1500, s: { Hard: 1500, Clay: 1500, Grass: 1500 }, n: 0, res: [], gl: [], last: 0 }); return P.get(k); };
for (const r of rows) {
  const surf = CLAY.test(r.tn) ? "Clay" : GRASS.test(r.tn) ? "Grass" : "Hard";
  const A = pl(r.a), B = pl(r.b), W = r.w === 0 ? A : B, L = r.w === 0 ? B : A;
  const e = 1 / (1 + 10 ** (-(W.elo - L.elo) / 400)), es = 1 / (1 + 10 ** (-(W.s[surf] - L.s[surf]) / 400));
  const k = (p) => (250 / (p.n + 5) ** 0.4) * (r.major ? 1.1 : 1);
  W.elo += k(W) * (1 - e); L.elo -= k(L) * (1 - e); W.s[surf] += k(W) * (1 - es); L.s[surf] -= k(L) * (1 - es);
  const gA = r.sets[0].reduce((s, v) => s + v, 0), gB = r.sets[1].reduce((s, v) => s + v, 0);
  for (const [p, g, o, won] of [[A, gA, gB, r.w === 0], [B, gB, gA, r.w === 1]]) { p.n++; p.res.push(won ? 1 : 0); p.gl.push(g + o ? g / (g + o) : 0.5); p.last = r.t; if (p.res.length > 10) p.res.shift(); if (p.gl.length > 5) p.gl.shift(); }
}
if (rows.length < 5000) { console.log("Historique ESPN incomplet (" + rows.length + " matchs) : classement Elo existant conservé."); process.exit(0); }
const out = { at: new Date().toISOString().slice(0, 10), players: {} }; const cut = Date.now() - 365 * 864e5;
for (const [name, p] of P) { if (p.n < 10 || p.last < cut) continue; const r = Math.round; out.players[name] = [r(p.elo), r(p.s.Hard), r(p.s.Clay), r(p.s.Grass), p.n, +(p.res.reduce((a, b) => a + b, 0) / p.res.length).toFixed(2), +(p.gl.reduce((a, b) => a + b, 0) / p.gl.length).toFixed(3)]; }
fs.writeFileSync(process.argv[2] || "tennis_elo.json", JSON.stringify(out));
console.log("matchs", rows.length, "joueurs", Object.keys(out.players).length, Object.entries(out.players).sort((a, b) => b[1][0] - a[1][0]).slice(0, 4).map(([n, v]) => n + " " + v[0]).join(", "));
