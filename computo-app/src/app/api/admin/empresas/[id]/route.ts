import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrarEventoAdmin } from "@/lib/eventos-admin";
import { requerirSuperadmin } from "@/lib/sesion";

// Panel /admin — elimina una empresa con todo lo suyo (solo SUPERADMIN).
// Irreversible: usuarios, proyectos (y todo lo que cuelga de ellos),
// sugerencias, configuración, biblioteca propia y consumos de la prueba se
// borran en cascada (onDelete: Cascade en schema.prisma). LogConsumoIA y
// EventoAdmin quedan con empresaId en null, como historial.
//
// El body tiene que traer `confirmacion` con el nombre exacto de la empresa:
// la misma comprobación que hace el modal, repetida acá para que un pedido
// suelto (o un clic equivocado) no borre nada.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const acceso = await requerirSuperadmin();
  if (acceso instanceof NextResponse) return acceso;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const empresa = await db.empresa.findUnique({
      where: { id },
      select: { id: true, nombre: true, estado: true, _count: { select: { users: true, proyectos: true } } },
    });
    if (!empresa) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

    if (empresa.id === acceso.empresaId) {
      return NextResponse.json({ error: "No podés eliminar tu propia empresa." }, { status: 400 });
    }
    if (typeof body?.confirmacion !== "string" || body.confirmacion !== empresa.nombre) {
      return NextResponse.json({ error: "La confirmación no coincide con el nombre de la empresa." }, { status: 400 });
    }

    await db.empresa.delete({ where: { id } });
    await registrarEventoAdmin(
      "EMPRESA_ELIMINADA",
      null,
      "admin",
      `«${empresa.nombre}» (${empresa.estado}, ${empresa._count.users} usuarios, ${empresa._count.proyectos} proyectos) eliminada por ${acceso.email}.`
    );
    return NextResponse.json({ ok: true, eliminada: empresa.nombre });
  } catch (err) {
    console.error("[DELETE /api/admin/empresas/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
