// Un match a assez de bookmakers de référence : 3 en général ; 1 (Pinnacle) suffit pour les cotes OddsPapi.
export const enough = (m) => m.nBooks >= (m.minBooks || (String(m.id || "").startsWith("papi-") ? 1 : 3));
