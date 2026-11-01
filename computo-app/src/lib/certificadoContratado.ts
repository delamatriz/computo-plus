import { db } from "@/lib/db";
import { calcularTotalCertificadoAgregado } from "@/lib/totalCertificadoAgregado";
import {
  presupuestoContratado,
  certificadoSobreContratado,
  type PresupuestoContratado,
} from "@/lib/presupuestoContratado";

// Lado servidor de lib/presupuestoContratado: lee contrato, rubros y
// certificaciones del proyecto y devuelve el presupuesto contratado y lo
// certificado sobre esa base (para Liquidación Final y su PDF).
export interface DatosCertificadoContratado {
  sumaRubros: number;
  contratado: PresupuestoContratado;
  certificadoRubros: number;
  certificado: number; // sobre el presupuesto contratado
}

export async function datosCertificadoContratado(proyectoId: string): Promise<DatosCertificadoContratado | null> {
  const proyecto = await db.proyecto.findUnique({
    where: { id: proyectoId },
    select: {
      moneda: true,
      contrato: { select: { monto: true, moneda: true } },
      capitulos: { select: { rubros: { select: { cantidad: true, precioUnit: true } } } },
      certificaciones: {
        select: {
          items: { select: { porcentajeAvance: true, rubro: { select: { cantidad: true, precioUnit: true } } } },
        },
      },
    },
  });
  if (!proyecto) return null;

  const sumaRubros = proyecto.capitulos.reduce(
    (s, c) => s + c.rubros.reduce((t, r) => t + r.cantidad * r.precioUnit, 0),
    0
  );
  const contratado = presupuestoContratado(proyecto.contrato, sumaRubros, proyecto.moneda);
  const certificadoRubros = calcularTotalCertificadoAgregado(proyecto.certificaciones);
  return {
    sumaRubros,
    contratado,
    certificadoRubros,
    certificado: certificadoSobreContratado(certificadoRubros, sumaRubros, contratado.monto),
  };
}
