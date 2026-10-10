"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "next-auth/react";
import { X } from "lucide-react";
import { FormularioLogin } from "@/components/FormularioLogin";

export default function SplashPage() {
  const router = useRouter();
  // null = todavía no se sabe si hay sesión. Con sesión, "Entrar" va directo
  // a la app; sin sesión abre el modal de login.
  const [conSesion, setConSesion] = useState<boolean | null>(null);
  const [loginAbierto, setLoginAbierto] = useState(false);

  useEffect(() => {
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
    <div className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-center">
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
        <div
          className="font-bold text-white leading-none"
          style={{
            fontSize: "clamp(2.8rem, 8vw, 5.5rem)",
            letterSpacing: "-0.04em",
          }}
        >
          CÓMPUTO<span style={{ color: "#2563EB" }}>+</span>
        </div>

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

        <button
          onClick={entrar}
          className="mt-4 bg-transparent text-white rounded-full px-12 py-3.5 text-sm font-semibold uppercase tracking-widest border-[1.5px] border-white/60 transition-all duration-300 hover:bg-white/10 hover:border-white hover:-translate-y-0.5"
        >
          Entrar
        </button>
      </div>

      <div className="absolute bottom-8 right-8 z-10 text-[0.72rem] font-medium text-white/35 tracking-wide">
        v1.0 · Uruguay
      </div>

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
