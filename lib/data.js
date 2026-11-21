import { loadAll } from "./odds";
import { getFormInfo } from "./fd";
import { enrich } from "./analysis";
import { frenchify } from "./fr.js";
import { attachLogos } from "./matchinfo.js";
import { attachSteam } from "./steam.js";

export async function loadEnriched() {
  const data = await loadAll();
  if (data.error && data.matches.length === 0) return data;
  const form = await getFormInfo();
  return { ...data, matches: await attachLogos(frenchify(enrich(await attachSteam(data.matches), form.teams))), formOn: form.teams.length > 0, formError: form.error };
}
