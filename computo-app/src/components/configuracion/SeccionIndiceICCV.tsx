"use client";

import { useEffect, useState } from "react";
import { TrendingUp, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface IndiceICCV {
  id: string;
  mes: string;
  variante: string;
  valor: number;
  updatedAt: string;
}

const LABEL_VARIANTE: Record<string, string> = {
  publica: "ICCV con participación pública",
  privada: "ICCV privado",
};

// Carga manual mensual del ICCV — reemplaza la búsqueda de IA que hacía
// antes actualizar-precios-indice/route.ts (falló 4/4 veces en encontrar
// el número índice absoluto de las variantes privada/pública, ver
// relevamiento). Luis carga acá los 2 valores del mes (público y privado)
// una vez que el INE publica el boletín — el endpoint de actualización de
// presupuesto pasa a leer de esta tabla, sin IA.
export default function SeccionIndiceICCV() {
  const [expandido, setExpandido] = useState(false);
  const [filas, setFilas] = useState<IndiceICCV[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mes, setMes] = useState("");
  const [variante, setVariante] = useState<"publica" | "privada">("privada");
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargarFilas() {
    setCargando(true);
    const res = await fetch("/api/configuracion/indice-iccv");
    setFilas(await res.json());
    setCargando(false);
  }

  useEffect(() => {
    if (expandido && filas.length === 0) cargarFilas();
  }, [expandido]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    if (!mes || !valor) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/configuracion/indice-iccv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, variante, valor: parseFloat(valor) }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "No se pudo guardar.");
        return;
      }
      setValor("");
      await cargarFilas();
    } catch {
      setError("No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id: string) {
    await fetch(`/api/configuracion/indice-iccv/${id}`, { method: "DELETE" });
    setFilas((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 mb-6 overflow-hidden">
      <button
        onClick={() => setExpandido((p) => !p)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <TrendingUp className="w-4 h-4 text-[#2563EB]" />
          <div>
            <h2 className="text-lg font-semibold text-[#1E293B]">Índice ICCV mensual</h2>
            <p className="text-sm text-slate-500">
              Carga manual del índice publicado por el INE — usado por &quot;Actualizar por ICCV&quot; en cada proyecto.
            </p>
          </div>
        </div>
        <span className="text-slate-400">
          {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-200"
          >
            <div className="p-6">
              <div className="flex items-end gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Mes</label>
                  <input
                    type="month"
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Variante</label>
                  <select
                    value={variante}
                    onChange={(e) => setVariante(e.target.value as "publica" | "privada")}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  >
                    <option value="privada">ICCV privado</option>
                    <option value="publica">ICCV con participación pública</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Valor del índice</label>
                  <input
                    type="number"
                    step="0.01"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="ej: 178.42"
                    className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  />
                </div>
                <button
                  onClick={guardar}
                  disabled={guardando || !mes || !valor}
                  className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1A3A5C] transition-colors disabled:opacity-60"
                >
                  {guardando ? "Guardando..." : "Cargar"}
                </button>
              </div>

              {error && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 mb-4 text-xs text-amber-800">
                  {error}
                </div>
              )}

              {cargando ? (
                <p className="text-sm text-slate-400">Cargando...</p>
              ) : filas.length === 0 ? (
                <p className="text-sm text-slate-400">Sin índices cargados todavía.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                      <th className="pb-2 font-medium">Mes</th>
                      <th className="pb-2 font-medium">Variante</th>
                      <th className="pb-2 font-medium text-right">Valor</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 text-slate-700">{f.mes}</td>
                        <td className="py-2 text-slate-700">{LABEL_VARIANTE[f.variante] ?? f.variante}</td>
                        <td className="py-2 text-right font-medium text-slate-700">{f.valor}</td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => borrar(f.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                            title="Borrar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
