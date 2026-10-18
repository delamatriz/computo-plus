import Link from "next/link";

// Marco de las páginas legales estáticas (/terminos, /privacidad): sin sidebar ni header de la
// app (son públicas, ver PUBLICAS en proxy.ts). `titulo` es el h1; el contenido usa <h2>, <p> y
// <p className={META}> para la línea de versión/vigencia/responsable.
export const META = "text-sm text-slate-500 !my-1";

export function PaginaLegal({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F0F4F8] px-4 py-12 font-sans">
      <div className="max-w-[700px] mx-auto">
        <Link href="/" className="block text-4xl font-bold tracking-tight text-[#1A3A5C]">
          CÓMPUTO+
        </Link>
        <p className="text-sm text-slate-500 mt-1">Presupuestación de Obra Premium</p>
        <Link href="/" className="inline-block mt-5 text-sm font-semibold text-[#2563EB] hover:underline">
          ← Volver al inicio
        </Link>

        <h1 className="text-3xl font-bold text-[#1A3A5C] mt-10 mb-4 leading-tight">{titulo}</h1>
        <div className="text-[15px] leading-8 text-slate-700 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[#1A3A5C] [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:my-4">
          {children}
        </div>

        <p className="text-center text-sm text-slate-400 mt-16">computo.delamatriz.com</p>
      </div>
    </div>
  );
}
