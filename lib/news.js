const FEEDS = [
  { src: "L'Équipe", url: "https://www.lequipe.fr/rss/actu_rss_Football.xml" },
  { src: "franceinfo", url: "https://www.francetvinfo.fr/sports/foot.rss" },
  { src: "RMC Sport", url: "https://rmcsport.bfmtv.com/rss/football/" },
  { src: "Foot Mercato", url: "https://www.footmercato.net/flux-rss" },
];
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘", hellip: "…", eacute: "é", egrave: "è", agrave: "à", ecirc: "ê", ccedil: "ç" };
function clean(s) {
  if (!s) return "";
  s = String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  s = s.replace(/<[^>]*>/g, " ");
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
  return s.replace(/\s+/g, " ").trim();
}
const tag = (b, t) => { const m = b.match(new RegExp("<" + t + "[^>]*>([\\s\\S]*?)</" + t + ">", "i")); return m ? m[1] : ""; };
function parse(xml, src) {
  const out = [];
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of items) {
    const title = clean(tag(b, "title"));
    let link = clean(tag(b, "link"));
    if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); link = m ? m[1] : ""; }
    const date = new Date(clean(tag(b, "pubDate")) || clean(tag(b, "dc:date")));
    let desc = clean(tag(b, "description"));
    if (desc === title) desc = "";
    if (desc.length > 220) desc = desc.slice(0, 217).replace(/\s+\S*$/, "") + "…";
    if (!title || !/^https?:/.test(link) || isNaN(+date)) continue;
    let img = null;
    const cands = [...b.matchAll(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*>/gi)].map((x) => x[0]).filter((x) => !/type="(?!image)/i.test(x) && !/medium="(?!image)/i.test(x)).map((x) => (x.match(/\burl="([^"]+)"/i) || [])[1]).filter(Boolean);
    img = cands[0] || (b.match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || null;
    if (img) { img = img.replace(/&amp;/g, "&"); if (img.startsWith("//")) img = "https:" + img; if (!/^https:\/\//.test(img)) img = null; }
    out.push({ title, link, desc, t: +date, src, img });
  }
  return out;
}
export async function loadNews() {
  const res = await Promise.allSettled(FEEDS.map(async (f) => {
    const r = await fetch(f.url, { next: { revalidate: 600 }, headers: { "User-Agent": "Mozilla/5.0 FightEdge", Accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error(String(r.status));
    return parse(await r.text(), f.src);
  }));
  const seen = new Set();
  const all = [];
  const ok = [];
  res.forEach((r, i) => { if (r.status === "fulfilled" && r.value.length) { ok.push(FEEDS[i].src); all.push(...r.value); } });
  all.sort((a, b) => b.t - a.t);
  const list = all.filter((a) => { const k = a.title.toLowerCase().slice(0, 50); if (seen.has(k)) return false; seen.add(k); return a.t > Date.now() - 4 * 864e5; });
  return { items: list.slice(0, 40), sources: ok, at: Date.now() };
}
