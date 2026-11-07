import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sesionActual } from "@/lib/sesion";
import {
  ArrowRight,
  BookMarked,
  CalendarRange,
  ClipboardCheck,
  FileDown,
  HardHat,
  Landmark,
  Layers,
  Ruler,
  ShoppingCart,
  Tags,
  Timer,
} from "lucide-react";
import { GuardarOrigen } from "@/components/landing/GuardarOrigen";
import { DIAS_PRUEBA } from "@/lib/config-prueba";

// Landing pública (/landing; la raíz / es la portada con el login). Link de
// campañas: /landing?o=instagram. Con sesión iniciada no se muestra: va directo a
// /inicio, igual que después del login (mismo chequeo que las páginas
// protegidas, sesionActual()). Sin
// sesión, el único pedacito de cliente es GuardarOrigen (guarda el ?o= para el
// registro). "Probalo gratis" va al registro público (/registro → /verificar →
// /bienvenida); "Iniciar sesión" a /login.

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

// Módulos de la app que se destacan en la landing (todos existen hoy).
const MODULOS = [
  {
    icono: Ruler,
    grupo: "Presupuesto",
    titulo: "Visor de metrajes",
    texto: "Medí sobre los planos y pasá las cantidades directo a cada rubro.",
  },
  {
    icono: BookMarked,
    grupo: "Presupuesto",
    titulo: "Biblioteca de rubros propios",
    texto: "Guardá tus rubros con su descompuesto y reusalos en cada obra.",
  },
  {
    icono: Tags,
    grupo: "Presupuesto",
    titulo: "Precios del mercado uruguayo",
    texto: "Lista MTOP y precios de barracas y proveedores locales.",
  },
  {
    icono: HardHat,
    grupo: "Presupuesto",
    titulo: "Mano de obra según convenio",
    texto: "Jornales SUNCA por categoría, al día con cada ajuste del convenio.",
  },
  {
    icono: Landmark,
    grupo: "Presupuesto",
    titulo: "Leyes sociales",
    texto: "Aporte AUC al BPS y fondos de la empresa según la normativa vigente.",
  },
  {
    icono: CalendarRange,
    grupo: "Gestión de obra",
    titulo: "Cronograma",
    texto: "Planificá la obra por capítulos y seguí el avance en el tiempo.",
  },
  {
    icono: ClipboardCheck,
    grupo: "Gestión de obra",
    titulo: "Certificación de avance",
    texto: "Certificá el avance de cada rubro y llevá el saldo de la obra.",
  },
  {
    icono: ShoppingCart,
    grupo: "Gestión de obra",
    titulo: "Órdenes de compra",
    texto: "Pedí los materiales a tus proveedores desde el presupuesto.",
  },
];

const PASOS = [
  {
    titulo: "Ingresá los datos de la obra",
    texto: "Tipo de obra, metros cuadrados y ubicación. Con eso ya tenés una primera estimación.",
  },
  {
    titulo: "Revisá y ajustá el presupuesto",
    texto: "Editá cantidades y precios de cada rubro; los totales se recalculan al instante.",
  },
  {
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
  "inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-[#2563EB] text-white text-[15px] font-semibold shadow-lg shadow-black/20 transition-colors duration-200 hover:bg-[#1D4ED8]";

function Marca({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight text-white ${className}`}>
      <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] ring-4 ring-[#2563EB]/25" aria-hidden />
      CÓMPUTO+
    </span>
  );
}

export default async function LandingPage() {
  if (await sesionActual()) redirect("/inicio");

  return (
    <div className="min-h-screen bg-[#F0F4F8] text-[#1E293B]">
      <GuardarOrigen />

      {/* Header fijo */}
      <header className="fixed inset-x-0 top-0 z-40 bg-[#1A3A5C]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between">
          <Link href="/landing" aria-label="CÓMPUTO+, inicio">
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

      {/* Hero: foto de obra con overlay oscuro; texto, CTA y presupuesto de ejemplo encima */}
      <section className="relative overflow-hidden pt-16 bg-[#0A192F]">
        <Image
          src="/hero-obra.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_35%]"
        />
        <div className="absolute inset-0 bg-[rgba(10,25,47,0.72)]" aria-hidden />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-16 sm:pt-24 sm:pb-20 flex flex-col items-center text-center">
          <h1
            className="font-bold text-white leading-[1.05] max-w-3xl"
            style={{ fontSize: "clamp(2.3rem, 6vw, 4.2rem)", letterSpacing: "-0.035em" }}
          >
            Del cómputo al presupuesto en minutos
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-white/80 max-w-xl">
            ¿Cuántas horas perdés calculando un presupuesto?
          </p>
          <div className="mt-9 flex flex-col items-center gap-3">
            <Link href="/registro" className={ctaPrimario}>
              Probalo gratis {DIAS_PRUEBA} días
              <ArrowRight className="w-4 h-4" />
            </Link>
            <span className="text-sm text-white/60">Sin tarjeta de crédito</span>
          </div>

          {/* Ilustración: presupuesto de ejemplo, como una planilla real */}
          <div className="mt-14 w-full max-w-2xl text-left" aria-hidden>
            <div className="rounded-xl bg-white shadow-2xl shadow-black/40 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Presupuesto</p>
                  <p className="text-sm font-semibold text-[#1A3A5C] truncate">Vivienda unifamiliar · 120 m²</p>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-slate-500">5 capítulos</span>
              </div>
              <div className="px-5 py-2 grid grid-cols-[1.5rem_1fr_auto] gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <span>N°</span>
                <span>Capítulo</span>
                <span className="text-right">Importe</span>
              </div>
              <ul>
                {CAPITULOS_EJEMPLO.map((c, i) => (
                  <li
                    key={c.nombre}
                    className={`px-5 py-2.5 grid grid-cols-[1.5rem_1fr_auto] gap-3 items-center text-sm ${i % 2 === 0 ? "bg-[#F0F4F8]" : "bg-white"}`}
                  >
                    <span className="tabular-nums text-slate-400">{i + 1}</span>
                    <span className="truncate text-slate-700">{c.nombre}</span>
                    <span className="tabular-nums font-medium text-slate-800 text-right">$ {c.monto}</span>
                  </li>
                ))}
              </ul>
              <div className="px-5 py-4 bg-[#1A3A5C] flex items-center justify-between text-white">
                <span className="text-sm font-semibold uppercase tracking-wider text-white/80">Total de obra</span>
                <span className="text-lg sm:text-xl font-bold tabular-nums">$ 2.990.550</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-[#1A3A5C]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#3B82F6]">Todo en un solo lugar</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Hecho para presupuestar obra en Uruguay
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:gap-6 md:grid-cols-3">
            {FEATURES.map(({ icono: Icono, titulo, texto }) => (
              <div
                key={titulo}
                className="rounded-xl border border-[#3B82F6]/25 bg-[#3B82F6]/[0.14] p-6 sm:p-7 transition-colors hover:bg-[#3B82F6]/[0.2]"
              >
                <span className="w-11 h-11 rounded-lg border border-[#3B82F6]/35 bg-[#3B82F6]/20 flex items-center justify-center">
                  <Icono className="w-5 h-5 text-[#3B82F6]" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-white">{titulo}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-300">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Módulos */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#2563EB]">Módulos</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-[#1A3A5C]">
              Del primer metraje a la última certificación
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULOS.map(({ icono: Icono, grupo, titulo, texto }) => (
              <div key={titulo} className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 transition-colors hover:border-[#2563EB]/40">
                <div className="flex items-center justify-between gap-3">
                  <span className="w-10 h-10 rounded-lg bg-[#1A3A5C] flex items-center justify-center">
                    <Icono className="w-5 h-5 text-[#3B82F6]" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{grupo}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-[#1A3A5C]">{titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ¿Cómo funciona? */}
      <section className="px-4 sm:px-6 py-14 sm:py-16 bg-[#F0F4F8]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center text-3xl sm:text-4xl font-bold tracking-tight text-[#1A3A5C]">¿Cómo funciona?</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3 md:gap-8">
            {PASOS.map(({ titulo, texto }, i) => (
              <li key={titulo} className="flex gap-4">
                <span className="w-10 h-10 shrink-0 rounded-full bg-[#2563EB] text-white text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-[#1A3A5C] leading-snug pt-1.5">{titulo}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{texto}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex justify-center">
            <Link href="/registro" className={ctaPrimario}>
              Probalo gratis {DIAS_PRUEBA} días
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1A3A5C] text-white px-4 sm:px-6 py-10 border-t border-white/10">
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
