import Link from "next/link";

// Marco de las pantallas del registro público (/registro, /verificar,
// /bienvenida): mismo estilo que /login — logo arriba, tarjeta blanca y pie
// con los links legales.
export function MarcoRegistro({
  titulo,
  subtitulo,
  children,
  pie,
}: {
  titulo: string;
  subtitulo?: React.ReactNode;
  children: React.ReactNode;
  pie?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F0F4F8] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center mb-8">
          <span className="text-3xl font-bold tracking-tight text-[#1A3A5C]">
            CÓMPUTO<span className="text-[#2563EB]">+</span>
          </span>
          <span className="block text-sm text-[#4A7FA8] mt-1">Presupuestación de Obra Premium</span>
        </Link>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-7">
          <h1 className="text-base font-semibold text-[#1E293B]">{titulo}</h1>
          {subtitulo && <p className="text-sm text-slate-500 mt-1">{subtitulo}</p>}
          <div className="mt-5">{children}</div>
        </div>

        {pie && <div className="text-center text-sm text-slate-500 mt-5">{pie}</div>}

        <p className="text-center text-xs text-slate-400 mt-6 space-x-3">
          <Link href="/terminos" className="hover:text-slate-600">Términos y condiciones</Link>
          <span aria-hidden="true">·</span>
          <Link href="/privacidad" className="hover:text-slate-600">Política de privacidad</Link>
        </p>
      </div>
    </div>
  );
}

export const claseInput =
  "w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-[#1E293B] placeholder:text-slate-400 focus:outline-none focus:border-[#4A7FA8] focus:ring-2 focus:ring-[#4A7FA8]/20 transition";

export const claseBotonPrimario =
  "w-full h-10 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";

export function MensajeError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
      {children}
    </p>
  );
}
