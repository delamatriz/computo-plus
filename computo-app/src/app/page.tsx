import Link from "next/link";
import { ArrowRight, ClipboardList, FileDown, Layers, SlidersHorizontal, Timer, Upload } from "lucide-react";
import { GuardarOrigen } from "@/components/landing/GuardarOrigen";
import { DIAS_PRUEBA } from "@/lib/config-prueba";

// Landing pública de la raíz. Página estática: el único pedacito de cliente es
// GuardarOrigen (guarda el ?o= para el registro). "Probalo gratis" va al
// registro público (/registro → /verificar → /bienvenida); "Iniciar sesión" a /login.

const FEATURES = [
  {
    icono: Timer,
    titulo: "Cálculo Rápido",
    texto: "Estimación de obra en minutos con solo el tipo y los m².",
  },
  {
    icono: Layers,
    titulo: "Presupuesto profesional",
    texto: "Capítulos, rubros, APU y leyes sociales en un solo lugar.",
  },
  {
    icono: FileDown,
    titulo: "Listo para entregar",
    texto: "Exportá PDF y Excel con tu membrete, sin trabajo extra.",
  },
];

const PASOS = [
  {
    icono: ClipboardList,
    titulo: "Ingresá los datos de la obra",
    texto: "Tipo de obra, metros cuadrados y ubicación. Con eso ya tenés una primera estimación.",
  },
  {
    icono: SlidersHorizontal,
    titulo: "Revisá y ajustá el presupuesto",
    texto: "Editá cantidades y precios de cada rubro; los totales se recalculan al instante.",
  },
  {
    icono: Upload,
    titulo: "Exportá y entregá al cliente",
    texto: "Un presupuesto prolijo, con tu membrete, listo para mandar.",
  },
];

// Ilustración del hero: un presupuesto de ejemplo con sus capítulos.
const CAPITULOS_EJEMPLO = [
  { nombre: "Implantación y movimiento de suelos", monto: "186.400" },
  { nombre: "Hormigón armado", monto: "1.248.900" },
  { nombre: "Mampostería de ticholo", monto: "642.300" },
  { nombre: "Revoques y terminaciones", monto: "518.750" },
  { nombre: "Instalación sanitaria", monto: "394.200" },
];

const ctaPrimario =
  "inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-white text-[#1A3A5C] text-[15px] font-semibold shadow-lg shadow-black/10 transition-all duration-200 hover:bg-[#F0F4F8] hover:-translate-y-0.5";

function Marca({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight text-white ${className}`}>
      <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] ring-4 ring-[#2563EB]/25" aria-hidden />
      CÓMPUTO+
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F0F4F8] text-[#1E293B]">
      <GuardarOrigen />

      {/* Header fijo */}
      <header className="fixed inset-x-0 top-0 z-40 bg-[#1A3A5C]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" aria-label="CÓMPUTO+, inicio">
            <Marca className="text-lg" />
          </Link>
          <Link
            href="/login"
            className="h-9 px-4 inline-flex items-center rounded-full border border-white/25 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1A3A5C] via-[#1E4A7A] to-[#2563EB] pt-16">
        {/* Retícula sutil, como papel de plano */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute -right-40 -top-40 w-[520px] h-[520px] rounded-full bg-[#3B82F6]/30 blur-3xl" aria-hidden />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_1fr] items-center">
          <div className="text-center lg:text-left">
            <h1
              className="font-bold text-white leading-[1.05]"
              style={{ fontSize: "clamp(2.3rem, 6vw, 3.9rem)", letterSpacing: "-0.035em" }}
            >
              Del cómputo al presupuesto en minutos
            </h1>
            <p className="mt-5 text-lg sm:text-xl text-white/80 max-w-xl mx-auto lg:mx-0">
              ¿Cuántas horas perdés calculando un presupuesto?
            </p>
            <div className="mt-9 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Link href="/registro" className={ctaPrimario}>
                Probalo gratis {DIAS_PRUEBA} días
                <ArrowRight className="w-4 h-4" />
              </Link>
              <span className="text-sm text-white/60">Sin tarjeta de crédito</span>
            </div>
          </div>

          {/* Ilustración: presupuesto de ejemplo */}
          <div className="relative mx-auto w-full min-w-0 max-w-md lg:max-w-none" aria-hidden>
            <div className="rounded-2xl bg-white shadow-2xl shadow-black/25 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Presupuesto</p>
                  <p className="text-sm font-semibold text-[#1A3A5C]">Vivienda unifamiliar · 120 m²</p>
                </div>
                <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-blue-50 text-[#2563EB]">5 capítulos</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {CAPITULOS_EJEMPLO.map((c, i) => (
                  <li key={c.nombre} className="px-5 py-3 flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 shrink-0 rounded-md bg-[#F0F4F8] text-[11px] font-semibold text-[#1A3A5C] flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-slate-600">{c.nombre}</span>
                    <span className="tabular-nums font-medium text-slate-800">$ {c.monto}</span>
                  </li>
                ))}
              </ul>
              <div className="px-5 py-4 bg-[#1A3A5C] flex items-center justify-between text-white">
                <span className="text-sm font-medium text-white/75">Total de obra</span>
                <span className="text-lg font-bold tabular-nums">$ 2.990.550</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 sm:px-6 py-20 sm:py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-[#2563EB]">Todo en un solo lugar</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-[#1A3A5C]">
              Hecho para presupuestar obra en Uruguay
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {FEATURES.map(({ icono: Icono, titulo, texto }) => (
              <div
                key={titulo}
                className="bg-white rounded-2xl border border-slate-200/80 p-7 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] flex items-center justify-center shadow-md shadow-[#2563EB]/25">
                  <Icono className="w-6 h-6 text-white" />
                </span>
                <h3 className="mt-6 text-lg font-semibold text-[#1A3A5C]">{titulo}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-500">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ¿Cómo funciona? */}
      <section className="px-4 sm:px-6 py-20 sm:py-24 bg-white border-y border-slate-200/70">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center text-3xl sm:text-4xl font-bold tracking-tight text-[#1A3A5C]">¿Cómo funciona?</h2>
          <ol className="mt-14 grid gap-10 md:gap-6 md:grid-cols-3 relative">
            {/* Línea que une los pasos (solo desktop) */}
            <div className="hidden md:block absolute top-7 left-[16.6%] right-[16.6%] h-px bg-gradient-to-r from-[#2563EB]/10 via-[#2563EB]/40 to-[#2563EB]/10" aria-hidden />
            {PASOS.map(({ icono: Icono, titulo, texto }, i) => (
              <li key={titulo} className="relative flex flex-col items-center text-center">
                <span className="relative w-14 h-14 rounded-full bg-[#1A3A5C] text-white flex items-center justify-center ring-8 ring-white">
                  <Icono className="w-6 h-6" />
                  <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#2563EB] text-xs font-bold flex items-center justify-center ring-2 ring-white">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-6 text-lg font-semibold text-[#1A3A5C]">{titulo}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-500 max-w-xs">{texto}</p>
              </li>
            ))}
          </ol>
          <div className="mt-16 flex justify-center">
            <Link
              href="/registro"
              className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-[#2563EB] text-white text-[15px] font-semibold shadow-lg shadow-[#2563EB]/25 transition-all duration-200 hover:bg-[#1D4ED8] hover:-translate-y-0.5"
            >
              Probalo gratis {DIAS_PRUEBA} días
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1A3A5C] text-white px-4 sm:px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <Marca />
            <p className="mt-2 text-sm text-white/60">Presupuestación de Obra Premium · Uruguay</p>
          </div>
          <p className="text-sm text-white/80">
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="font-semibold text-white underline-offset-4 hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/50">
          <span>© 2026 CÓMPUTO+</span>
          <nav className="flex gap-5">
            <Link href="/terminos" className="hover:text-white/80">Términos y condiciones</Link>
            <Link href="/privacidad" className="hover:text-white/80">Política de privacidad</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
