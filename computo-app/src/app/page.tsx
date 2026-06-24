"use client";

import { useRouter } from "next/navigation";

export default function SplashPage() {
  const router = useRouter();

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
          onClick={() => router.push("/dashboard")}
          className="mt-4 bg-transparent text-white rounded-full px-12 py-3.5 text-sm font-semibold uppercase tracking-widest border-[1.5px] border-white/60 transition-all duration-300 hover:bg-white/10 hover:border-white hover:-translate-y-0.5"
        >
          Entrar
        </button>
      </div>

      <div className="absolute bottom-8 right-8 z-10 text-[0.72rem] font-medium text-white/35 tracking-wide">
        v1.0 · Uruguay
      </div>

      <style jsx global>{`
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
