"use client";
export default function Error({ reset }) {
  return (
    <div className="card mx-auto max-w-md space-y-3 p-8 text-center">
      <h1 className="text-2xl font-extrabold">Un problème est survenu</h1>
      <p className="text-sm text-muted">Les données n'ont pas pu être chargées. Réessayez dans un instant.</p>
      <button onClick={() => reset()} className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white">Réessayer</button>
    </div>
  );
}
