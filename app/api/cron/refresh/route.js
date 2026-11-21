import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { loadEnriched } from "@/lib/data";
import { recordPicks, settlePending } from "@/lib/track";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  globalThis.__papiAllow = true;
  const out = { ok: true, refreshedAt: new Date().toISOString() };
  try { revalidatePath("/", "layout"); } catch {}
  try {
    const { matches } = await loadEnriched();
    out.recorded = matches?.length ? await recordPicks(matches) : 0;
    out.settled = await settlePending({ force: true });
  } catch (e) { out.error = String(e?.message || e).slice(0, 200); }
  return NextResponse.json(out);
}
