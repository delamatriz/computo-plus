"use client";

import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  data: { mes: string; cantidad: number }[];
}

// Mismo lenguaje visual que la curva S de SeccionCronograma.tsx (grilla
// punteada gris, ejes en slate-400, tooltip redondeado) — primera vez que
// se usa recharts en un dashboard de overview, no en la vista de un
// proyecto puntual, pero el estilo se mantiene igual en toda la app.
export default function GraficoProyectosPorMes({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#94A3B8" }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94A3B8" }} width={30} />
        <Tooltip
          formatter={(value) => [`${value}`, "Proyectos"]}
          contentStyle={{ borderRadius: 8, borderColor: "#E2E8F0", fontSize: 12 }}
        />
        <Bar dataKey="cantidad" fill="#2563EB" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
