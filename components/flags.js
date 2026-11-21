// Drapeau d'un championnat : code pays ESPN (fra.1, eng.2…), clé The Odds API (soccer_france_ligue_one…) ou nom de compétition.
const iso = (c) => String.fromCodePoint(...[...c.toUpperCase()].map((x) => 127397 + x.charCodeAt(0)));
const ENG = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
const SCO = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
const CODE = { fra: "FR", ger: "DE", esp: "ES", ita: "IT", por: "PT", ned: "NL", bel: "BE", tur: "TR", bra: "BR", arg: "AR", usa: "US", mex: "MX", ksa: "SA", sau: "SA", aut: "AT", sui: "CH", gre: "GR", rus: "RU", ukr: "UA", pol: "PL", den: "DK", swe: "SE", nor: "NO", jpn: "JP", chn: "CN", kor: "KR", aus: "AU", col: "CO", chi: "CL", uru: "UY", par: "PY", per: "PE", ecu: "EC", ven: "VE", bol: "BO", cro: "HR", srb: "RS", cze: "CZ", rou: "RO", hun: "HU", bul: "BG", isr: "IL", egy: "EG", mar: "MA", alg: "DZ", tun: "TN", rsa: "ZA", ind: "IN", qat: "QA", uae: "AE", irl: "IE", fin: "FI", ger_: "DE", can: "CA", cri: "CR", hon: "HN", gua: "GT", slo: "SI", svk: "SK", cyp: "CY", ltu: "LT", lva: "LV", est: "EE", isl: "IS", kaz: "KZ" };
const KEYS = [[/france|ligue/, "FR"], [/germany|bundesliga/, "DE"], [/spain|laliga|la_liga/, "ES"], [/italy|serie/, "IT"], [/portugal|primeira/, "PT"], [/netherlands|eredivisie/, "NL"], [/belgi/, "BE"], [/turkey|turk/, "TR"], [/brazil/, "BR"], [/argentin/, "AR"], [/usa|mls/, "US"], [/mexico|ligamx/, "MX"], [/saudi/, "SA"], [/austria/, "AT"], [/switzerland/, "CH"], [/greece/, "GR"], [/denmark/, "DK"], [/sweden/, "SE"], [/norway/, "NO"], [/japan/, "JP"], [/australia/, "AU"], [/poland/, "PL"], [/russia/, "RU"], [/china/, "CN"], [/korea/, "KR"]];
export function flagOf({ slug, sk, name } = {}) {
  const s = String(slug || "").toLowerCase();
  if (s) {
    const p = s.split(".")[0];
    if (p === "eng") return ENG;
    if (p === "sco") return SCO;
    if (CODE[p]) return iso(CODE[p]);
    if (/^uefa|^fifa|^club/.test(p)) return "\u{1F1EA}\u{1F1FA}";
    if (/^conmebol|^concacaf|^caf|^afc|^ofc/.test(p)) return "\u{1F30D}";
  }
  const k = String(sk || name || "").toLowerCase();
  if (/epl|england|efl|championship/.test(k)) return ENG;
  if (/scotland|spl/.test(k)) return SCO;
  for (const [re, c] of KEYS) if (re.test(k)) return iso(c);
  if (/uefa|champions|europa|conference|nations/.test(k)) return "\u{1F1EA}\u{1F1FA}";
  return "⚽";
}
