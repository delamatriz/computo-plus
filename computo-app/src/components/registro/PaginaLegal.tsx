import Link from "next/link";

// Marco de las páginas legales estáticas (/terminos, /privacidad). El texto
// es provisorio: Luis lo reemplaza por el definitivo.
export function PaginaLegal({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-2xl font-bold tracking-tight text-[#1A3A5C]">
          CÓMPUTO<span className="text-[#2563EB]">+</span>
        </Link>
        <h1 className="text-2xl font-semibold text-[#1A3A5C] mt-8 mb-4">{titulo}</h1>
        <div className="text-sm leading-relaxed text-slate-600 space-y-3">{children}</div>
        <Link href="/" className="inline-block mt-10 text-sm font-semibold text-[#2563EB] hover:underline">
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
