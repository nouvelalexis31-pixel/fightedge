// Écusson (ou initiales si le logo n'est pas fourni par la source) + nom de l'équipe.
export function Badge({ src, name, size = 44 }) {
  const ini = String(name || "?").split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const st = { width: size, height: size };
  return src
    ? <img src={src} alt="" width={size} height={size} loading="lazy" style={st} className="shrink-0 object-contain" />
    : <span style={st} className="grid shrink-0 place-items-center rounded-full bg-card2 text-xs font-extrabold text-muted">{ini}</span>;
}

export function Team({ name, logo, size = 44 }) {
  return (
    <span className="flex min-w-0 flex-col items-center gap-1.5 text-center">
      <Badge src={logo} name={name} size={size} />
      <span className="line-clamp-2 text-sm font-bold leading-tight">{name}</span>
    </span>
  );
}
