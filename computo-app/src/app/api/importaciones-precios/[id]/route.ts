import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requerirAdminOSuperadmin } from "@/lib/sesion";
import { eliminarImportacion } from "@/lib/importacionesPrecios";

// Eliminar una lista importada: borra sus materiales que no usa ningún APU y
// deja los que están en uso (protegidos). ?simular=1 solo cuenta, para
// confirmar en pantalla antes de borrar.
// Dueño: el Administrador gestiona las del catálogo global y un usuario con
// rol Empresa solo las de su empresa; una lista ajena → 404. La Lista
// Oficial MTOP no se elimina desde acá.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirAdminOSuperadmin(
    "Solo un usuario con rol Empresa o el Administrador de CÓMPUTO+ puede eliminar listas importadas."
  );
  if (sesion instanceof NextResponse) return sesion;
  try {
    const { id } = await params;
    const empresaId = sesion.rol === "SUPERADMIN" ? null : sesion.empresaId;
    const importacion = await db.importacionPrecios.findFirst({ where: { id, empresaId }, select: { proveedor: true } });
    if (!importacion) {
      return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
    }
    if (importacion.proveedor === null) {
      return NextResponse.json({ error: "La Lista Oficial MTOP no se puede eliminar." }, { status: 400 });
    }
    const simular = req.nextUrl.searchParams.get("simular") === "1";
    return NextResponse.json(await eliminarImportacion(db, id, { simular }));
  } catch (err) {
    console.error("[DELETE /api/importaciones-precios/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
