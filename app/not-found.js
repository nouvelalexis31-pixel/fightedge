import Link from "next/link";
export const metadata = { title: "Page introuvable" };
export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md space-y-3 p-8 text-center">
      <h1 className="text-2xl font-extrabold">Page introuvable</h1>
      <p className="text-sm text-muted">Ce match n'est plus affiché ou le lien est incorrect.</p>
      <Link href="/matchs" className="inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white">Voir les matchs du jour</Link>
    </div>
  );
}
