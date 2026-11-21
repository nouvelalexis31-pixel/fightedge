"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const I = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10",
  star: "m12 3.5 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z",
  live: "M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2",
  bolt: "M13 3 5 13h6l-1 8 8-10h-6z",
  layers: "M12 3 3 8l9 5 9-5zM3 13l9 5 9-5",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  news: "M5 4h11a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2zM18 9h2v8a2 2 0 0 1-2 2M8.5 8h6M8.5 12h6M8.5 15.5h4",
  chart: "M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6",
  fav: "M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 17l-5.3 3 1.1-6L3.4 9.8l6-.8z",
  tag: "M20 12l-8 8-9-9V4h7zM7.5 7.5h.01",
  home2: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  ball: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8l3 2.2-1.1 3.6h-3.8L9 10.2z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.8v.1",
};
const ITEMS = [
  { href: "/", label: "Accueil", icon: I.home2, bar: true },
  { href: "/matchs", label: "Matchs", icon: I.ball, bar: true },
  { href: "/live", label: "Direct", icon: I.live, bar: true },
  { href: "/pronos", label: "Pronos IA", short: "Pronostics", icon: I.star, bar: true },
  { href: "/bilan", label: "Bilan IA", icon: I.chart, bar: true },
  { href: "/value", label: "Value Bets", icon: I.tag },
  { href: "/combines", label: "Combinés", icon: I.layers },
  { href: "/buteurs", label: "Buteurs", icon: I.bolt },
  { href: "/actus", label: "Actualités", icon: I.news },
  { href: "/favoris", label: "Favoris", icon: I.heart },
  { href: "/methode", label: "Méthode", icon: I.info },
];
const isActive = (path, href) => (href === "/" ? path === "/" : href === "/matchs" ? path.startsWith("/matchs") || path.startsWith("/match/") : path.startsWith(href));
const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  const extra = ITEMS.filter((i) => !i.bar);
  const moreActive = extra.some((i) => isActive(path, i.href));
  return (
    <>
      <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Navigation principale">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} aria-current={isActive(path, i.href) ? "page" : undefined} className={`tab rounded-full px-2 py-2 text-[12.5px] xl:px-2.5 font-semibold transition ${isActive(path, i.href) ? "bg-white text-navy" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
            {i.label}
          </Link>
        ))}
      </nav>
      {open && <button aria-label="Fermer le menu" className="fixed inset-0 z-40 bg-navy/40 lg:hidden" onClick={() => setOpen(false)} />}
      {open && (
        <div role="dialog" aria-label="Autres rubriques" className="fixed inset-x-0 bottom-[calc(3.9rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md px-3 lg:hidden">
          <ul className="card grid grid-cols-3 gap-1 p-2 shadow-xl">
            {extra.map((i) => (
              <li key={i.href}>
                <Link href={i.href} aria-current={isActive(path, i.href) ? "page" : undefined} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-3 text-xs font-bold ${isActive(path, i.href) ? "bg-brand/10 text-brand" : "text-ink hover:bg-card2"}`}>
                  <Icon d={i.icon} />{i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <nav className="bottombar lg:hidden" aria-label="Navigation mobile">
        <ul className="mx-auto grid max-w-md grid-cols-6">
          {ITEMS.filter((i) => i.bar).map((i) => (
            <li key={i.href}>
              <Link href={i.href} aria-current={isActive(path, i.href) ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[9.5px] font-bold ${isActive(path, i.href) ? "text-brand" : "text-muted"}`}>
                <span className={`grid h-7 w-12 place-items-center rounded-full ${isActive(path, i.href) ? "bg-brand/10" : ""}`}><Icon d={i.icon} /></span>
                {i.short || i.label}
              </Link>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={`flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${open || moreActive ? "text-brand" : "text-muted"}`}>
              <span className={`grid h-7 w-12 place-items-center rounded-full ${open || moreActive ? "bg-brand/10" : ""}`}><Icon d={I.more} /></span>
              Plus
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
