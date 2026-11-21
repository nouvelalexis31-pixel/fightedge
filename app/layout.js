import "./globals.css";
import Link from "next/link";
import Nav from "@/components/Nav";

export const metadata = {
  metadataBase: new URL("https://fightedge.vercel.app"),
  openGraph: { title: "FightEdge — Pronos, cotes et scores en direct", description: "Pronos du jour analysés, cotes Betclic, Winamax, Unibet et PMU, scores en direct.", locale: "fr_FR", type: "website", siteName: "FightEdge" },
  title: { default: "FightEdge — Pronos, cotes et scores en direct", template: "%s · FightEdge" },
  description: "Pronos du jour analysés, comparateur de cotes Betclic, Winamax, Unibet et PMU, et scores en direct.",
};
export const viewport = { themeColor: "#0a1a2f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <a href="#contenu" className="skip">Aller au contenu</a>
        <header className="sticky top-0 z-30 bg-navy text-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2.5 font-[family-name:var(--font-display)] text-lg font-extrabold tracking-tight" aria-label="FightEdge, accueil">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold text-navy">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 16l5-5 4 4 7-8" /><path d="M15 7h5v5" /></svg>
              </span>
              FightEdge
            </Link>
            <Nav />
          </div>
        </header>
        <main id="contenu" className="mx-auto max-w-5xl px-4 pb-24 pt-6 lg:pb-8">{children}</main>
        <footer className="mx-auto mt-10 max-w-5xl pb-20 lg:pb-8 border-t border-line px-4 py-8 text-xs leading-relaxed text-muted">
          <p><b className="text-ink">Aucun gain n'est garanti.</b> Les pronos sont des estimations, pas des certitudes. Ne misez jamais plus que ce que vous pouvez vous permettre de perdre. Interdit aux moins de 18 ans.</p>
          <p className="mt-2">Besoin d'aide ? Joueurs Info Service : 09 74 75 13 13 (appel non surtaxé). FightEdge n'est affilié à aucun opérateur : vérifiez toujours la cote sur le site de l'opérateur avant de parier.</p>
        </footer>
      </body>
    </html>
  );
}
