// Noms d'équipes en français (affichage). La logique de rapprochement passe par canon().
const PAIRS = {
  Germany: "Allemagne", Netherlands: "Pays-Bas", Spain: "Espagne", Italy: "Italie", England: "Angleterre", Scotland: "Écosse", Wales: "Pays de Galles",
  "Northern Ireland": "Irlande du Nord", Ireland: "Irlande", "Republic of Ireland": "Irlande", Switzerland: "Suisse", Belgium: "Belgique", Croatia: "Croatie",
  Denmark: "Danemark", Sweden: "Suède", Norway: "Norvège", Finland: "Finlande", Iceland: "Islande", Poland: "Pologne", "Czech Republic": "Tchéquie", Czechia: "Tchéquie",
  Slovakia: "Slovaquie", Slovenia: "Slovénie", Hungary: "Hongrie", Austria: "Autriche", Greece: "Grèce", Turkey: "Turquie", "Türkiye": "Turquie", Romania: "Roumanie",
  Bulgaria: "Bulgarie", Serbia: "Serbie", "Bosnia and Herzegovina": "Bosnie-Herzégovine", "Bosnia-Herzegovina": "Bosnie-Herzégovine", Albania: "Albanie",
  "North Macedonia": "Macédoine du Nord", Montenegro: "Monténégro", Russia: "Russie", Belarus: "Biélorussie", Georgia: "Géorgie", Armenia: "Arménie",
  Azerbaijan: "Azerbaïdjan", Israel: "Israël", Cyprus: "Chypre", Malta: "Malte", Lithuania: "Lituanie", Latvia: "Lettonie", Estonia: "Estonie", Moldova: "Moldavie",
  "Faroe Islands": "Îles Féroé", Andorra: "Andorre", "San Marino": "Saint-Marin", Brazil: "Brésil", Argentina: "Argentine", Chile: "Chili", Colombia: "Colombie",
  Peru: "Pérou", Ecuador: "Équateur", Bolivia: "Bolivie", Mexico: "Mexique", USA: "États-Unis", "United States": "États-Unis", Jamaica: "Jamaïque", Haiti: "Haïti",
  Morocco: "Maroc", Algeria: "Algérie", Tunisia: "Tunisie", Egypt: "Égypte", Senegal: "Sénégal", "Ivory Coast": "Côte d'Ivoire", "Cote d'Ivoire": "Côte d'Ivoire",
  Cameroon: "Cameroun", "South Africa": "Afrique du Sud", "DR Congo": "RD Congo", "Cape Verde": "Cap-Vert", Japan: "Japon", "South Korea": "Corée du Sud", China: "Chine",
  Australia: "Australie", "Saudi Arabia": "Arabie saoudite", Iraq: "Irak", Uzbekistan: "Ouzbékistan", "New Zealand": "Nouvelle-Zélande",
  "Paris Saint Germain": "Paris SG", "Paris Saint-Germain": "Paris SG", "Olympique Marseille": "Marseille", "Olympique de Marseille": "Marseille", "Olympique Lyonnais": "Lyon",
  "Atletico Madrid": "Atlético de Madrid", "Club Brugge": "FC Bruges", "Standard Liege": "Standard de Liège", Roma: "AS Rome", Napoli: "Naples", Lazio: "Lazio Rome",
  Torino: "Turin", Genoa: "Gênes", Bologna: "Bologne", "Hellas Verona": "Vérone", Sevilla: "Séville", "Sporting Lisbon": "Sporting Portugal", Cologne: "Cologne", "FC Koln": "Cologne",
  "Bayern Munich": "Bayern Munich", "Borussia Dortmund": "Dortmund", "Borussia Monchengladbach": "Mönchengladbach", "Inter Milan": "Inter Milan", Seville: "Séville",
  Anderlecht: "Anderlecht", Zurich: "Zurich", "FC Zurich": "Zurich", Prague: "Prague", "Slavia Prague": "Slavia Prague", Moscow: "Moscou", Lisbon: "Lisbonne",
};
const strip = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const SUF = /^(.*?)(\s+(?:W|U\d\d|Women|B|II|Reserves))$/;
const split = (n) => { const m = SUF.exec(String(n)); return m ? [m[1], m[2]] : [String(n), ""]; };
const FR = new Map(Object.entries(PAIRS).map(([k, v]) => [k, v]));
const BACK = new Map();
for (const [en, fr] of Object.entries(PAIRS)) if (!BACK.has(strip(fr))) BACK.set(strip(fr), en);
export const fr = (n) => { if (typeof n !== "string" || !n) return n; const [b, s] = split(n); return FR.has(b) ? FR.get(b) + s : n; };
export const canon = (n) => { if (typeof n !== "string" || !n) return n; const [b, s] = split(n); if (FR.has(b)) return n; const e = BACK.get(strip(b)); return e ? e + s : n; };
export const hasFr = (n) => typeof n === "string" && FR.has(split(n)[0]);
// Remplace, partout dans l'objet, les noms d'équipes exacts par leur version française.
export function frenchify(root) {
  const seen = new WeakSet();
  const walk = (o) => {
    if (!o || typeof o !== "object" || seen.has(o)) return;
    seen.add(o);
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === "string") { if (hasFr(v)) o[k] = fr(v); }
      else walk(v);
    }
  };
  walk(root);
  return root;
}
