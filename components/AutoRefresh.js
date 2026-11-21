"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresh({ seconds = 10, stamp }) {
  const router = useRouter();
  const last = useRef(Date.now());
  const [ago, setAgo] = useState(0);
  const [paused, setPaused] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const refresh = () => { last.current = Date.now(); setAgo(0); router.refresh(); };
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, seconds * 1000);
    const tick = setInterval(() => { setPaused(document.visibilityState !== "visible"); setOffline(!navigator.onLine); setAgo(Math.floor((Date.now() - last.current) / 1000)); }, 1000);
    const vis = () => { if (document.visibilityState === "visible" && Date.now() - last.current > seconds * 1000) refresh(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); clearInterval(tick); document.removeEventListener("visibilitychange", vis); };
  }, [router, seconds]);
  return (
    <div className="pointer-events-none fixed bottom-20 right-3 z-40 md:bottom-4" aria-live="off">
      <span className="inline-flex items-center gap-2 rounded-full bg-navy/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
        <span className={"inline-block h-2 w-2 rounded-full " + (paused ? "bg-amber-400" : "live-dot bg-good")} />
        {paused ? "En pause (onglet caché)" : offline || ago > 45 ? "⚠ Données possiblement figées" : "Direct · actualisé " + (stamp ? new Date(stamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Paris" }) : "") + " (il y a " + ago + " s)"}
      </span>
    </div>
  );
}
