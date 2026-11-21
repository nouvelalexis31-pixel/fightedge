// Classement Elo tennis appris sur l'historique ESPN (ATP + WTA, 2022 → nov. 2026, 46 959 matchs).
// Test sur 23 860 matchs de 2024-2026 : 64,3 % de vainqueurs trouvés, probabilités bien calibrées.
// Facteurs qui comptent le plus (par ordre) : niveau Elo, domination récente (part des jeux gagnés), forme sur 10 matchs, repos.
// Les surfaces et la fatigue (nombre de matchs en 14 jours) n'apportent presque rien en plus.
import DATA from "./tennis_elo.json";
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
let IDX = null;
function index() {
  if (IDX) return IDX;
  IDX = new Map();
  for (const [name, v] of Object.entries(DATA.players || {})) {
    const n = norm(name); IDX.set(n, { name, v });
    const parts = n.split(" "); if (parts.length >= 2) IDX.set("~" + parts[parts.length - 1] + " " + parts[0][0], { name, v });
  }
  return IDX;
}
export function eloOf(name) {
  const I = index(), n = norm(name);
  const hit = I.get(n) || (() => { const p = n.split(" "); return p.length >= 2 ? I.get("~" + p[p.length - 1] + " " + p[0][0]) : null; })();
  if (!hit) return null;
  const [elo, hard, clay, grass, n2, form, dom] = hit.v;
  return { name: hit.name, elo, hard, clay, grass, n: n2, form, dom };
}
export const ELO_AT = DATA.at;
// Probabilité que A batte B selon l'Elo (avec un léger bonus pour la domination récente, appris sur l'historique)
export function eloProb(a, b) {
  const A = eloOf(a), B = eloOf(b);
  if (!A || !B) return null;
  const z = (A.elo - B.elo) / 400 * Math.LN10 + 2.0 * ((A.dom ?? 0.5) - (B.dom ?? 0.5)) + 0.4 * ((A.form ?? 0.5) - (B.form ?? 0.5));
  return { p: 1 / (1 + Math.exp(-z)), A, B };
}
