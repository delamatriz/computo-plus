// Datos de PersonalObra para BPS/MTSS y la Planilla de Jornales (cédula,
// ingreso/egreso a la obra, jornal propio). Validación compartida por el POST
// y el PATCH de /api/proyectos/[id]/personal.

export interface DatosExtraPersonal {
  cedula: string | null;
  fechaIngreso: Date | null;
  fechaEgreso: Date | null;
  jornal: number | null;
}

// Devuelve los datos limpios, o un mensaje de error si alguno no es válido.
export function leerDatosExtraPersonal(body: Record<string, unknown>): DatosExtraPersonal | string {
  const fecha = (v: unknown): Date | null | "invalida" => {
    if (v == null || v === "") return null;
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return "invalida";
    return new Date(`${v.slice(0, 10)}T00:00:00Z`);
  };
  const fechaIngreso = fecha(body.fechaIngreso);
  const fechaEgreso = fecha(body.fechaEgreso);
  if (fechaIngreso === "invalida" || fechaEgreso === "invalida") return "Fecha inválida";
  if (fechaIngreso && fechaEgreso && fechaEgreso < fechaIngreso) return "El egreso no puede ser anterior al ingreso";

  let jornal: number | null = null;
  if (body.jornal != null && body.jornal !== "") {
    const n = typeof body.jornal === "number" ? body.jornal : Number(body.jornal);
    if (!Number.isFinite(n) || n < 0) return "Jornal inválido";
    jornal = n;
  }

  const cedula = typeof body.cedula === "string" && body.cedula.trim() ? body.cedula.trim() : null;
  return { cedula, fechaIngreso, fechaEgreso, jornal };
}
