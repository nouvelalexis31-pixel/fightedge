const TZ = "Europe/Paris";
export const fmtTime = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(d); };
export const fmtDay = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(d); };
export const dayKey = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : new Intl.DateTimeFormat("fr-CA", { timeZone: TZ }).format(d); };
export const fmtDateTime = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(d); };
export const odd = (n) => (typeof n === "number" ? n.toFixed(2).replace(".", ",") : "—");
export const pct = (p, d = 0) => `${(p * 100).toFixed(d).replace(".", ",")} %`;
export const signed = (p) => `${p >= 0 ? "+" : ""}${(p * 100).toFixed(1).replace(".", ",")} %`;
export const pt = (n) => String(n).replace(".", ",");

// Fin de la journée (heure de Paris) contenant l'instant donné.
export const endOfDay = (now = Date.now()) => {
  const k = dayKey(new Date(now).toISOString());
  let t = now;
  while (dayKey(new Date(t).toISOString()) === k) t += 5 * 60e3;
  return t;
};
export const todayKey = (now = Date.now()) => dayKey(new Date(now).toISOString());
export const fmtDayShort = (key) => new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(key + "T12:00:00Z"));
