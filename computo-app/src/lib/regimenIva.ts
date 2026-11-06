// Régimen de IVA de la empresa (Empresa.regimenIva, nov-2026).
//
// - GENERAL: contribuyente de IVA. Recupera el IVA de las compras con la
//   factura (los materiales entran al costo sin IVA) y le factura IVA al
//   cliente (22% al final del presupuesto).
// - LITERAL_E (pequeña empresa) y MONOTRIBUTO: pagan un IVA mínimo fijo, no
//   descuentan el IVA de las compras (el material cuenta entero, con IVA) y
//   no le cobran IVA al cliente (el presupuesto no suma 22%).
//
// Solo decide cómo nacen los proyectos nuevos: cada proyecto guarda su
// propio Proyecto.descuentaIvaCompras y Proyecto.facturaConIva.

export const REGIMENES_IVA = ["GENERAL", "LITERAL_E", "MONOTRIBUTO"] as const;
export type RegimenIva = (typeof REGIMENES_IVA)[number];

export const ETIQUETA_REGIMEN_IVA: Record<RegimenIva, string> = {
  GENERAL: "Contribuyente de IVA (régimen general)",
  LITERAL_E: "Pequeña empresa (literal E)",
  MONOTRIBUTO: "Monotributo",
};

export function esRegimenIva(v: unknown): v is RegimenIva {
  return typeof v === "string" && (REGIMENES_IVA as readonly string[]).includes(v);
}

/** Valores de IVA con que se crea un proyecto nuevo de una empresa con este régimen. */
export function ivaDeProyectoNuevo(regimen: string | null | undefined): {
  descuentaIvaCompras: boolean;
  facturaConIva: boolean;
} {
  const general = regimen !== "LITERAL_E" && regimen !== "MONOTRIBUTO";
  return { descuentaIvaCompras: general, facturaConIva: general };
}
