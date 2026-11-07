"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession } from "next-auth/react";
import { FileText, Play, Ruler, Scale, X } from "lucide-react";
import { FormularioLogin } from "@/components/FormularioLogin";
import { CLAVE_ORIGEN } from "@/lib/config-prueba";

// Beneficios de la portada — texto provisorio, Luis lo redacta.
const BENEFICIOS = [
  {
    icono: Ruler,
    titulo: "Del plano al presupuesto",
    texto: "Computá metrajes y armá capítulos y rubros con su descompuesto y precios de la Lista MTOP.",
  },
  {
    icono: Scale,
    titulo: "Leyes sociales al día",
    texto: "Aporte AUC, jornales SUNCA y fondos de la empresa calculados según la normativa vigente.",
  },
  {
    icono: FileText,
    titulo: "Listo para entregar",
    texto: "Presupuesto para el cliente, certificaciones de avance y órdenes de compra en PDF.",
  },
];

// ?o= (instagram, mail, demo…): se guarda para asociarlo al registro en
// /bienvenida. Mismo criterio que sanitizarOrigen() del servidor.
function guardarOrigen() {
  try {
    const o = new URLSearchParams(window.location.search).get("o");
    const limpio = o?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
    if (limpio) sessionStorage.setItem(CLAVE_ORIGEN, limpio);
  } catch {}
}

export default function SplashPage() {
  const router = useRouter();
  // null = todavía no se sabe si hay sesión. Con sesión, "Entrar" va directo
  // a la app; sin sesión abre el modal de login.
  const [conSesion, setConSesion] = useState<boolean | null>(null);
  const [loginAbierto, setLoginAbierto] = useState(false);

  useEffect(() => {
    guardarOrigen();
    getSession().then((s) => setConSesion(!!s)).catch(() => setConSesion(false));
  }, []);

  useEffect(() => {
    if (!loginAbierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLoginAbierto(false);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [loginAbierto]);

  async function entrar() {
    // Si el chequeo inicial no terminó, se pregunta en el momento.
    const haySesion = conSesion ?? !!(await getSession().catch(() => null));
    if (haySesion) router.push("/inicio");
    else setLoginAbierto(true);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Portada */}
      <section className="relative min-h-[100svh] overflow-hidden flex flex-col items-center justify-center">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/obra-portada.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(10,20,35,0.35) 0%, rgba(10,20,35,0.55) 40%, rgba(10,20,35,0.80) 100%)",
          }}
        />

        <div
          className="relative z-10 flex flex-col items-center gap-6 text-center px-8"
          style={{ animation: "fadeIn 1.1s ease both" }}
        >
          <h1
            className="font-bold text-white leading-none"
            style={{
              fontSize: "clamp(2.8rem, 8vw, 5.5rem)",
              letterSpacing: "-0.04em",
            }}
          >
            CÓMPUTO<span style={{ color: "#2563EB" }}>+</span>
          </h1>

          <div
            className="w-[60px] h-[2px]"
            style={{
              background: "linear-gradient(90deg, transparent, #2563EB, transparent)",
            }}
          />

          <p
            className="font-light text-white/80 uppercase"
            style={{
              fontSize: "clamp(0.9rem, 2.5vw, 1.2rem)",
              letterSpacing: "0.12em",
            }}
          >
            De la medición al presupuesto en minutos
          </p>

          <div className="mt-4 flex flex-col items-center gap-3">
            <Link
              href="/registro"
              className="w-44 h-12 flex items-center whitespace-nowrap justify-center rounded-full bg-[#2563EB] text-white text-sm font-semibold uppercase tracking-widest border-[1.5px] border-[#2563EB] transition-all duration-300 hover:bg-[#1D4ED8] hover:border-[#1D4ED8] hover:-translate-y-0.5"
            >
              Probar gratis
            </Link>
            <button
              type="button"
              onClick={entrar}
              className="w-44 h-12 flex items-center whitespace-nowrap justify-center rounded-full bg-transparent text-white text-sm font-semibold uppercase tracking-widest border-[1.5px] border-[#2563EB] transition-all duration-300 hover:bg-[#2563EB]/15 hover:-translate-y-0.5"
            >
              Entrar
            </button>
          </div>
        </div>

        <div className="absolute bottom-8 right-8 z-10 text-[0.72rem] font-medium text-white/35 tracking-wide">
          v1.0 · Uruguay
        </div>
      </section>

      {/* Video + beneficios */}
      <section className="px-4 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto">
          {/* Lugar reservado para el video (Luis lo agrega después). */}
          <div className="aspect-video w-full rounded-2xl bg-slate-200 border border-slate-300/60 flex flex-col items-center justify-center gap-3 text-slate-500">
            <span className="w-14 h-14 rounded-full bg-white/70 flex items-center justify-center">
              <Play className="w-6 h-6 text-[#1A3A5C] translate-x-0.5" />
            </span>
            <span className="text-sm font-medium">Video próximamente</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 mt-10">
            {BENEFICIOS.map(({ icono: Icono, titulo, texto }) => (
              <div key={titulo} className="bg-white rounded-xl border border-slate-200 p-5">
                <span className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Icono className="w-5 h-5 text-[#2563EB]" />
                </span>
                <h2 className="text-sm font-semibold text-[#1A3A5C] mt-4">{titulo}</h2>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pie */}
      <footer className="border-t border-slate-200 px-4 py-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <span>
            CÓMPUTO<span className="text-[#2563EB]">+</span> · Presupuestación de Obra Premium · Uruguay
          </span>
          <nav className="flex gap-4">
            <Link href="/terminos" className="hover:text-slate-600">Términos y condiciones</Link>
            <Link href="/privacidad" className="hover:text-slate-600">Política de privacidad</Link>
          </nav>
        </div>
      </footer>

      {loginAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-[rgba(10,20,35,0.5)]"
          style={{ animation: "fadeInFondo 0.2s ease both" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLoginAbierto(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-login"
            className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl px-6 py-7"
            style={{ animation: "fadeIn 0.25s ease both" }}
          >
            <button
              type="button"
              onClick={() => setLoginAbierto(false)}
              aria-label="Cerrar"
              className="absolute top-3 right-3 p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center mb-6">
              <div className="text-2xl font-bold tracking-tight text-[#1A3A5C]">
                CÓMPUTO<span className="text-[#2563EB]">+</span>
              </div>
              <h2 id="titulo-login" className="text-sm text-[#4A7FA8] mt-1">
                Ingresá a tu cuenta
              </h2>
            </div>
            <FormularioLogin destino="/inicio" />
            <p className="text-center text-sm text-slate-500 mt-5">
              ¿No tenés cuenta?{" "}
              <Link href="/registro" className="font-semibold text-[#2563EB] hover:underline">
                Probar gratis
              </Link>
            </p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeInFondo {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
