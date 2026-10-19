// Lista oficial MTOP vigente según la base (solo servidor): el número más alto que tenga el
// catálogo global (PrecioMTOP con empresaId null) y su mes. numeroLista 0 es "sin número" (el
// importador lo deja así cuando el Excel no lo trae) y no cuenta. Reemplaza al "N°599, Nov 2025"
// que estaba escrito a mano en /materiales y en los prompts de IA. Para mostrarla, ver
// etiquetaFechaLista / detalleListaMTOP en lib/listaMTOP.ts.

import { db } from "@/lib/db";
import type { ListaMTOPVigente } from "@/lib/listaMTOP";

export async function listaMTOPVigente(): Promise<ListaMTOPVigente | null> {
  const fila = await db.precioMTOP.findFirst({
    where: { empresaId: null, numeroLista: { gt: 0 } },
    orderBy: [{ numeroLista: "desc" }, { fechaLista: "desc" }],
    select: { numeroLista: true, fechaLista: true },
  });
  return fila ? { numero: fila.numeroLista, fecha: fila.fechaLista || null } : null;
}
