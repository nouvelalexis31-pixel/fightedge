// Écussons des clubs hors ESPN (basket européen, rugby, hockey…) : TheSportsDB (gratuit, sans clé personnelle). Résultats gardés 30 jours.
import { unstable_cache } from "next/cache";

const SPORT = { football: "Soccer", basketball: "Basketball", hockey: "Ice Hockey", rugby: "Rugby", baseball: "Baseball", americanfootball: "American Football" };
const norm = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(fc|cf|ac|as|sc|bc|bk|kk|cb|the)\b|[^a-z0-9]/g, "");

const search = unstable_cache(
  async (name) => {
    const r = await fetch("https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=" + encodeURIComponent(name), { cache: "no-store" });
    if (!r.ok) throw new Error("tsdb " + r.status);
    const j = await r.json();
    return (j.teams || []).map((t) => ({ n: t.strTeam, a: t.strAlternate, s: t.strSport, b: t.strBadge || t.strTeamBadge || null }));
  },
  ["tsdb-search-v1"],
  { revalidate: 30 * 24 * 3600 }
);

export async function logoOf(name, sport) {
  try {
    const want = SPORT[sport];
    if (!want || !name) return null;
    const k = norm(name);
    const list = (await search(name)).filter((t) => t.s === want && t.b);
    const names = (t) => [t.n, ...String(t.a || "").split(",")].map(norm).filter(Boolean);
    const hit = list.find((t) => names(t).includes(k)) || list.find((t) => names(t).some((x) => x.length >= 4 && k.length >= 4 && (x.includes(k) || k.includes(x))));
    return hit ? hit.b + "/small" : null;
  } catch { return null; }
}
