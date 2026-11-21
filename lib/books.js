export const BOOKS_ORDER = ["Betclic", "Winamax", "Unibet", "PMU"];

// Un seul bookmaker par carte : celui (dans l'ordre de préférence) qui propose toutes les issues du match.
export function pickBook(outcomes) {
  const pref = [process.env.PREFERRED_BOOK, ...BOOKS_ORDER].filter(Boolean);
  const outs = outcomes || [];
  let best = null, bc = -1;
  for (const b of pref) {
    const c = outs.filter((o) => typeof o.odds?.[b] === "number").length;
    if (c === outs.length && c > 0) return b;
    if (c > bc) { bc = c; best = b; }
  }
  return bc > 0 ? best : null;
}
export const oddOf = (x, book) => (x && book && typeof x.odds?.[book] === "number" ? x.odds[book] : null);
