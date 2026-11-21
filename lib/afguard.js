// Coupe-circuit API-Football : quand le compte est suspendu, la clé refusée ou le quota épuisé, on arrête de
// l'appeler pendant 6 h (au lieu d'une erreur à chaque page). Le site bascule alors sur ses sources gratuites (ESPN).
const g = globalThis;
const PAUSE = 6 * 3600e3;
export const afOn = () => !!process.env.API_FOOTBALL_KEY && !(g.__afDownUntil > Date.now());
export function afFail(msg) {
  if (/suspend|not subscribed|invalid.*key|key.*invalid|request limit|rateLimit|quota|access|HTTP (401|403|429|499)/i.test(String(msg))) {
    if (!(g.__afDownUntil > Date.now())) console.warn("[api-football] désactivé 6 h :", String(msg).slice(0, 120));
    g.__afDownUntil = Date.now() + PAUSE;
  }
}
export function afGuard() {
  if (!afOn()) throw new Error("API-Football indisponible (compte suspendu ou quota) : source de secours utilisée");
}
