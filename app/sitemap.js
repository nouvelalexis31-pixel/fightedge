export default function sitemap() {
  const base = "https://fightedge.vercel.app";
  return ["", "/pronos", "/live", "/methode"].map((p) => ({ url: base + p, lastModified: new Date() }));
}
