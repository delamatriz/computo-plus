// Total certificado de un proyecto — suma, a través de TODAS las
// certificaciones (sin filtro de estado: Certificacion no tiene ese
// campo), de cada CertificacionItem: (porcentajeAvance/100) ×
// rubro.cantidad × rubro.precioUnit. Mismo cálculo que ya vive en
// SeccionCertificaciones.tsx (montoCertificadoDe(), por certificación
// individual) — portado acá server-side y sumado a nivel proyecto para
// poder cruzarlo contra Liquidación Final sin duplicar la fórmula a mano.
//
// porcentajeAvance es el aporte INCREMENTAL de cada certificación (no
// un acumulado) — sumar el de todas las certificaciones del proyecto
// para un mismo rubro da el % acumulado real, así que no hace falta
// agrupar por rubro antes de sumar: sumar todos los ítems da el total
// correcto directamente.
export interface RubroParaTotalCertificado {
  cantidad: number;
  precioUnit: number;
}

export interface CertificacionItemParaTotalCertificado {
  porcentajeAvance: number;
  rubro: RubroParaTotalCertificado | null;
}

export interface CertificacionParaTotalCertificado {
  items: CertificacionItemParaTotalCertificado[];
}

export function calcularTotalCertificadoAgregado(
  certificaciones: CertificacionParaTotalCertificado[]
): number {
  let total = 0;
  for (const cert of certificaciones) {
    for (const item of cert.items) {
      if (!item.rubro) continue;
      total += (item.porcentajeAvance / 100) * item.rubro.cantidad * item.rubro.precioUnit;
    }
  }
  return total;
}

export type EstadoCruceCertificacion = "certificado_de_mas" | "falta_certificar" | "coincide";

export interface CruceCertificacion {
  totalCertificado: number;
  diferencia: number; // totalCertificado - totalLiquidado
  umbral: number;
  estado: EstadoCruceCertificacion;
}

// Umbral: mayor entre $100 fijo (protege proyectos muy chicos/en UYU de
// alertar por centavos de redondeo) y 0.1% del Total Liquidado (escala
// con el tamaño real del proyecto, incluida la diferencia de magnitud
// entre UYU y USD). Diferencias dentro del umbral, en cualquier
// dirección, se consideran "coincide" — un umbral que solo protegiera
// el lado de "falta certificar" y no el de "certificado de más" no
// tendría sentido como umbral.
export function calcularCruceCertificacion(
  totalCertificado: number,
  totalLiquidado: number
): CruceCertificacion {
  const umbral = Math.max(100, totalLiquidado * 0.001);
  const diferencia = totalCertificado - totalLiquidado;

  let estado: EstadoCruceCertificacion;
  if (Math.abs(diferencia) <= umbral) {
    estado = "coincide";
  } else if (diferencia > 0) {
    estado = "certificado_de_mas";
  } else {
    estado = "falta_certificar";
  }

  return { totalCertificado, diferencia, umbral, estado };
}
