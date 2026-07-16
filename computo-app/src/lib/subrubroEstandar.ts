import type { PrismaClient, Prisma } from "@/generated/prisma/client";

export type SubrubroEstandarInput = {
  codigo: string;
  capitulo: string;
  subcapitulo?: string;
  descripcion: string;
  unidad: string;
  precioUY: number;
  fechaBase?: string;
  aportesSociales?: number;
  origen?: string;
  activo?: boolean;
};

export type CrearSubrubroEstandarOptions = {
  // Si true, no sobreescribe un subrubro ya existente con el mismo codigo —
  // solo crea si no existe (patrón de seed-subrubros-faltantes.ts). Default:
  // false — upsert que sobreescribe (patrón de seed-subrubros-sau.ts).
  skipIfExists?: boolean;
};

/**
 * Punto de escritura centralizado para altas en la biblioteca de
 * SubrubroEstandar. Resuelve capituloId/subcapituloId contra el catálogo
 * canónico (mismo criterio de matching exacto por nombre que usa el POST
 * de /api/subrubros-estandar, Fase 2 Etapa 3) y nunca bloquea la creación
 * si no hay match — solo loguea un warning y guarda con el FK en null.
 */
export async function crearSubrubroEstandar(
  db: PrismaClient,
  input: SubrubroEstandarInput,
  options: CrearSubrubroEstandarOptions = {}
) {
  const capituloCatalogo = await db.capituloCatalogo.findUnique({
    where: { nombre: input.capitulo },
  });
  if (!capituloCatalogo) {
    console.warn(
      `[crearSubrubroEstandar] Sin CapituloCatalogo para "${input.capitulo}" — se guarda sin capituloId (${input.codigo})`
    );
  }

  let subcapituloId: string | undefined;
  if (input.subcapitulo && capituloCatalogo) {
    const subcapituloCatalogo = await db.subcapituloCatalogo.findFirst({
      where: { capituloCatalogoId: capituloCatalogo.id, nombre: input.subcapitulo },
    });
    if (!subcapituloCatalogo) {
      console.warn(
        `[crearSubrubroEstandar] Sin SubcapituloCatalogo para "${input.capitulo}" :: "${input.subcapitulo}" — se guarda sin subcapituloId (${input.codigo})`
      );
    }
    subcapituloId = subcapituloCatalogo?.id;
  }

  if (options.skipIfExists) {
    const existente = await db.subrubroEstandar.findUnique({ where: { codigo: input.codigo } });
    if (existente) {
      return { subrubro: existente, creado: false };
    }
  }

  const data: Prisma.SubrubroEstandarUncheckedCreateInput = {
    codigo: input.codigo,
    capitulo: input.capitulo,
    subcapitulo: input.subcapitulo,
    descripcion: input.descripcion,
    unidad: input.unidad,
    precioUY: input.precioUY,
    fechaBase: input.fechaBase,
    aportesSociales: input.aportesSociales,
    origen: input.origen,
    activo: input.activo,
    capituloId: capituloCatalogo?.id,
    subcapituloId,
  };

  const subrubro = await db.subrubroEstandar.upsert({
    where: { codigo: input.codigo },
    create: data,
    update: data,
  });
  return { subrubro, creado: true };
}
