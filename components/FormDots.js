const C = { V: "bg-good text-white", N: "bg-slate-300 text-slate-700", D: "bg-bad text-white" };
export function FormDots({ letters }) {
  return (
    <span className="inline-flex gap-1" aria-label={`Forme : ${letters.join(" ")}`}>
      {letters.map((l, i) => <span key={i} className={`grid h-5 w-5 place-items-center rounded text-[10px] font-bold ${C[l]}`}>{l}</span>)}
    </span>
  );
}
