// Règles de pari lisibles par la machine : permettent de régler automatiquement chaque pronostic.
const num = (s) => Number(String(s).replace(",", "."));
const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function ruleFromCand(m, c) {
  const o = c.o;
  if (c.market === "h2h") return { t: "h2h", s: o.name === "Match nul" ? "draw" : o.name === m.home ? "home" : o.name === m.away ? "away" : null };
  if (c.market === "totals") return { t: "tot", u: unitWord(m), p: c.line.point, s: c.side };
  if (c.market === "spreads") return { t: "spr", s: c.side, p: c.line.point };
  if (c.market === "btts") return { t: "btts", y: o.name === "Oui" };
  if (c.market === "dnb") return { t: "dnb", s: o.name === m.home ? "home" : o.name === m.away ? "away" : null };
  if (c.market === "dc") {
    const n = String(o.name), set = [];
    if (n.includes(m.home)) set.push("home");
    if (n.includes(m.away)) set.push("away");
    if (/\bnul\b|draw|\bx\b/i.test(n)) set.push("draw");
    return set.length === 2 ? { t: "dc", set: set.sort() } : null;
  }
  return null;
}

function unitWord(m) {
  return m.sport === "tennis" ? "jeux" : m.sport === "football" || m.sport === "hockey" ? "buts" : m.sport === "baseball" ? "points" : "points";
}

// « Plus de 2,5 buts », « Moins de 2,5 sets », « Plus de 22,5 jeux »...
export function ruleFromLabel(m, label) {
  const x = String(label || "").match(/^(Plus|Moins) de ([\d.,]+) (buts?|points?|jeux|sets?|manches|essais)/i);
  if (!x) return null;
  const u = /^but/i.test(x[3]) ? "buts" : /^point/i.test(x[3]) ? "points" : /^set/i.test(x[3]) ? "sets" : /^jeu/i.test(x[3]) ? "jeux" : x[3].toLowerCase();
  return { t: "tot", u, p: num(x[2]), s: /^plus/i.test(x[1]) ? "over" : "under" };
}

export function ruleKey(r) {
  if (!r) return null;
  if (r.t === "h2h") return "h2h-" + r.s;
  if (r.t === "tot") return `tot-${r.u}-${r.p}-${r.s}`;
  if (r.t === "spr") return `spr-${r.s}-${r.p}`;
  if (r.t === "btts") return "btts-" + (r.y ? "oui" : "non");
  if (r.t === "dnb") return "dnb-" + r.s;
  if (r.t === "dc") return "dc-" + r.set.join("");
  if (r.t === "scorer") return "scorer-" + slug(r.name);
  return null;
}

export const catOf = (r, sport) => {
  if (!r) return "Autre";
  if (r.t === "h2h") return sport === "football" ? "Résultat du match" : "Vainqueur";
  if (r.t === "tot") return `Plus/Moins de ${r.u}`;
  if (r.t === "spr") return "Handicap";
  if (r.t === "btts") return "Les deux équipes marquent";
  if (r.t === "dnb") return "Nul remboursé";
  if (r.t === "dc") return "Double chance";
  if (r.t === "scorer") return "Buteur";
  return "Autre";
};

const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

// Règle + jeu terminé -> { status: "won" | "lost" | "void" } ou null (impossible à régler avec cette source).
// game : { hs, as, sets: [{h, a}] | null, aet, walkover, retired, scorers: [noms] | null }
export function settle(rule, game, sport) {
  if (!rule || !game) return null;
  const { hs, as } = game;
  const tennis = sport === "tennis";
  const gm = tennis && game.sets?.length ? { h: game.sets.reduce((a, s) => a + s.h, 0), a: game.sets.reduce((a, s) => a + s.a, 0) } : null;
  if (game.walkover) return { status: "void", note: "Forfait" };
  const win = (cond) => ({ status: cond ? "won" : "lost" });
  const cmp = (v, p, side) => (v === p ? { status: "void", note: "Ligne exacte" } : win(side === "over" ? v > p : v < p));
  if (rule.t === "h2h") {
    if (hs == null || as == null) return null;
    if (game.aet && sport === "football") return null; // marchés sur 90 minutes
    const r = hs > as ? "home" : hs < as ? "away" : "draw";
    if (tennis && r === "draw") return null;
    return win(r === rule.s);
  }
  if (rule.t === "dnb") {
    if (hs == null || as == null || (game.aet && sport === "football")) return null;
    if (hs === as) return { status: "void", note: "Match nul : mise remboursée" };
    return win((hs > as ? "home" : "away") === rule.s);
  }
  if (rule.t === "dc") {
    if (hs == null || as == null || (game.aet && sport === "football")) return null;
    const r = hs > as ? "home" : hs < as ? "away" : "draw";
    return win(rule.set.includes(r));
  }
  if (rule.t === "btts") {
    if (hs == null || as == null || (game.aet && sport === "football")) return null;
    const both = hs > 0 && as > 0;
    return win(rule.y ? both : !both);
  }
  if (rule.t === "tot") {
    if (rule.u === "sets") { if (!game.sets?.length) return null; if (game.retired) return { status: "void", note: "Abandon" }; return cmp(game.sets.length, rule.p, rule.s); }
    if (tennis) { if (!gm) return null; if (game.retired) return { status: "void", note: "Abandon" }; return cmp(gm.h + gm.a, rule.p, rule.s); }
    if (hs == null || as == null || (game.aet && sport === "football")) return null;
    return cmp(hs + as, rule.p, rule.s);
  }
  if (rule.t === "spr") {
    let h = hs, a = as;
    if (tennis) { if (!gm) return null; if (game.retired) return { status: "void", note: "Abandon" }; h = gm.h; a = gm.a; }
    if (h == null || a == null || (game.aet && sport === "football")) return null;
    const d = rule.s === "home" ? h + rule.p - a : a - rule.p - h;
    return d === 0 ? { status: "void", note: "Handicap exact" } : win(d > 0);
  }
  if (rule.t === "scorer") {
    if (!game.scorers) return null;
    const t = norm(rule.name).split(" ").filter((w) => w.length > 2);
    const last = t[t.length - 1];
    const hit = game.scorers.some((n) => { const x = norm(n); return x === norm(rule.name) || (last && x.split(" ").includes(last)); });
    if (hit) return { status: "won" };
    return game.scorers.length || hs + as === 0 ? { status: "lost" } : null;
  }
  return null;
}
