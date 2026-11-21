"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const KEY = "fe_favs";
const read = () => {
  try { const m = document.cookie.split("; ").find((c) => c.startsWith(KEY + "=")); return m ? decodeURIComponent(m.slice(KEY.length + 1)).split(",").filter(Boolean) : []; } catch { return []; }
};
const write = (ids) => { try { document.cookie = `${KEY}=${encodeURIComponent(ids.slice(0, 60).join(","))}; path=/; max-age=31536000; samesite=lax`; } catch {} };

// Étoile « favori » : la liste est gardée dans un cookie du navigateur (aucun compte nécessaire).
export function FavButton({ id, className = "" }) {
  const [on, setOn] = useState(false);
  const router = useRouter();
  const path = usePathname();
  useEffect(() => { setOn(read().includes(id)); }, [id]);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Retirer des favoris" : "Ajouter aux favoris"}
      title={on ? "Retirer des favoris" : "Ajouter aux favoris"}
      onClick={(e) => {
        e.preventDefault(); e.stopPropagation();
        const cur = read();
        const next = on ? cur.filter((x) => x !== id) : [id, ...cur.filter((x) => x !== id)];
        write(next); setOn(!on);
        if (path.startsWith("/favoris")) router.refresh();
      }}
      className={`relative z-10 grid h-8 w-8 place-items-center rounded-full border transition ${on ? "border-gold bg-gold/20 text-gold" : "border-line bg-white text-muted hover:text-ink"} ${className}`}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="m12 3.5 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z" /></svg>
    </button>
  );
}
