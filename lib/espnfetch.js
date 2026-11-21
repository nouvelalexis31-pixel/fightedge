// Accès commun aux API publiques ESPN : ESPN répond « 403 » quand il reçoit trop de requêtes d'un coup
// ou des requêtes sans en-têtes de navigateur. On limite donc le nombre d'appels simultanés, on envoie des
// en-têtes standards, et on réessaie (avec le serveur miroir site.web.api.espn.com) avant d'abandonner.
const HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  referer: "https://www.espn.com/",
  origin: "https://www.espn.com",
};
const MAX = 6;
const g = globalThis;
g.__espnQ = g.__espnQ || { active: 0, wait: [] };
const Q = g.__espnQ;
const take = () => (Q.active < MAX ? (Q.active++, Promise.resolve()) : new Promise((r) => Q.wait.push(r)).then(() => { Q.active++; }));
const give = () => { Q.active--; const n = Q.wait.shift(); if (n) n(); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRY = new Set([403, 408, 429, 500, 502, 503, 504]);

const mirror = (u) => (u.includes("//site.api.espn.com/") ? u.replace("//site.api.espn.com/", "//site.web.api.espn.com/") : u.includes("//site.web.api.espn.com/") ? u.replace("//site.web.api.espn.com/", "//site.api.espn.com/") : null);

export async function espnFetch(url, { timeout = 8000, tries = 3 } = {}) {
  const alt = mirror(url);
  await take();
  try {
    let last = null;
    for (let i = 0; i < tries; i++) {
      const u = i % 2 === 1 && alt ? alt : url;
      try {
        const r = await fetch(u, { cache: "no-store", headers: HEADERS, signal: AbortSignal.timeout(timeout) });
        if (r.ok) return r;
        last = new Error("HTTP " + r.status);
        if (!RETRY.has(r.status)) break;
      } catch (e) { last = e; }
      if (i < tries - 1) await sleep(250 * (i + 1) + Math.random() * 250);
    }
    throw last || new Error("ESPN indisponible");
  } finally { give(); }
}

export async function espnJson(url, opts) {
  return (await espnFetch(url, opts)).json();
}
