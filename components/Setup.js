export function Setup({ msg }) {
  return (
    <div className="card border-warn/30 bg-warn/5 p-5 text-sm leading-relaxed">
      <h1 className="text-xl font-bold">{msg === "no-key" ? "Une dernière étape : brancher les cotes réelles" : "Les cotes ne sont pas disponibles pour le moment"}</h1>
      {msg === "no-key" ? (
        <p className="mt-2">La clé <code>ODDS_API_KEY</code> est manquante dans Vercel (Settings → Environment Variables).</p>
      ) : (
        <p className="mt-2">Raison : {msg}. Aucune donnée n'est inventée : la page se remplira dès que la source répondra.</p>
      )}
    </div>
  );
}
