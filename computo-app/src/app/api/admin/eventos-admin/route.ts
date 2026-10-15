import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirSuperadmin } from "@/lib/sesion";

// Panel /admin — Eventos del sistema (topes de gasto, clave de pruebas sin
// configurar, facturación): los últimos 50 y el total por tipo. Solo SUPERADMIN.
export async function GET() {
  const acceso = await requerirSuperadmin();
  if (acceso instanceof NextResponse) return acceso;
  try {
    const [eventos, porTipo] = await Promise.all([
      db.eventoAdmin.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, tipo: true, funcion: true, detalle: true, createdAt: true, empresa: { select: { id: true, nombre: true } } },
      }),
      db.eventoAdmin.groupBy({ by: ["tipo"], _count: { _all: true } }),
    ]);
    return NextResponse.json({
      eventos,
      porTipo: porTipo.map((t) => ({ tipo: t.tipo, total: t._count._all })).sort((a, b) => b.total - a.total),
    });
  } catch (err) {
    console.error("[GET /api/admin/eventos-admin]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
