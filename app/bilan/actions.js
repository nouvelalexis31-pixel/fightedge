"use server";
import { revalidatePath } from "next/cache";
import { putJson, storeOn } from "@/lib/store";

const clean = (v, n) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, n);
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Paris joués déclarés par l'utilisateur : enregistrés en ajout seulement (un fichier par pari, un fichier par changement de résultat).
export async function addPlayed(fd) {
  if (!storeOn()) return;
  const odds = Number(String(fd.get("odds")).replace(",", ".")), stake = Number(String(fd.get("stake")).replace(",", "."));
  const match = clean(fd.get("match"), 120), sel = clean(fd.get("selection"), 120);
  if (!match || !sel || !(odds > 1) || odds > 1000 || !(stake > 0) || stake > 100000) return;
  const id = rid();
  await putJson(`played/${id}.json`, { id, match, selection: sel, book: clean(fd.get("book"), 40), odds, stake, date: clean(fd.get("date"), 10) || new Date().toISOString().slice(0, 10), fromPick: fd.get("fe") === "1", at: new Date().toISOString() });
  revalidatePath("/bilan");
}
export async function setPlayedResult(fd) {
  if (!storeOn()) return;
  const id = clean(fd.get("id"), 20), status = String(fd.get("status"));
  if (!id || !["won", "lost", "void", "pending"].includes(status)) return;
  await putJson(`played-res/${id}-${rid()}.json`, { id, status, at: new Date().toISOString() });
  revalidatePath("/bilan");
}
