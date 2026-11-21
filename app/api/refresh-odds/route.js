import { loadAll } from "@/lib/odds";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
// Rafraîchit le relevé OddsPapi s'il est périmé (au plus une fois par jour : le quota gratuit est très limité).
export async function GET(req) {
  if (new URL(req.url).searchParams.get("k") !== "fe-odds") return new Response("no", { status: 404 });
  globalThis.__papiAllow = true;
  const d = await loadAll();
  const by = {};
  for (const m of d.matches || []) by[m.league] = (by[m.league] || 0) + 1;
  return Response.json({ source: d.source || "the-odds-api", fetchedAt: d.fetchedAt, matches: d.matches?.length || 0, partial: !!d.partial, errors: d.papiErrors || [], by });
}
