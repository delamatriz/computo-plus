"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/layout/Header";

const MODES = [
  {
    id: "rapido",
    title: "Cálculo Rápido",
    description:
      "Detallá las tareas a realizar de forma precisa y el tipo de obra. Tendrás un presupuesto orientativo en segundos.",
    cta: "Calcular ahora",
    href: "/calcular",
  },
  {
    id: "obra",
    title: "Nuevo Proyecto",
    description:
      "Creá tu presupuesto con capítulos y rubros. Presupuesto completo con descomposición de precios, mano de obra y metrajes.",
    cta: "Crear proyecto",
    href: "/proyectos/nuevo",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-full bg-white flex flex-col">
      <Header />

      {/* Hero */}
      <section className="max-w-4xl mx-auto w-full px-6 pt-16 pb-10 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-4xl md:text-5xl font-bold tracking-tight text-[#1A3A5C] mb-3"
        >
          Presupuestá tu obra
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="text-lg text-slate-500"
        >
          De la medición al presupuesto en minutos.
        </motion.p>
      </section>

      {/* Tarjetas */}
      <section className="max-w-3xl mx-auto w-full px-6 pt-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {MODES.map((mode, i) => (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.12 + i * 0.07 }}
            >
              <Link href={mode.href} className="block h-full group">
                <div className="h-full rounded-xl border border-slate-200 bg-white p-6 flex flex-col shadow-sm transition-all hover:shadow-lg hover:border-[#2563EB]/40">
                  <h3 className="text-lg font-bold text-[#1A3A5C] mb-2">
                    {mode.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed flex-1">
                    {mode.description}
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-[#2563EB]">
                    {mode.cta}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 mt-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center">
          <p className="text-slate-400 text-xs">Presupuestación de Obra Premium · Uruguay</p>
        </div>
      </footer>
    </div>
  );
}
