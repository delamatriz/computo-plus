import { crearMensaje } from "@/lib/anthropic-client";
import { db } from "@/lib/db";
import { resolverCapituloCatalogoId } from "@/lib/capituloCatalogoResolver";
import { buscarSubrubrosPorCapitulos, formatearSubrubrosParaPrompt, type SubrubroConApu } from "@/lib/bibliotecaApus";
import { sumManoObra, calcularPrecioUnitario, redondearPrecio, sumarAportesPatronalesPct, montoAportesPatronales } from "@/lib/apu-calc";
import { registrarLogConsumoIA } from "@/lib/logConsumoIA";
import { coincidenciasPrecioMaterial } from "@/lib/resolverPrecioInsumo";
import { materialesParaPrompt } from "@/lib/materialesParaPrompt";

const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

// Material tal como se guarda y se devuelve al cliente. Los campos de
// catálogo solo vienen cuando la descripción de la IA coincide EXACTO con
// un PrecioMTOP (ver vincularMaterialesAlCatalogo).
export interface MaterialGenerado {
  descripcion: string;
  unidad: string;
  rendimiento: number;
  precioUnit: number;
  precioMTOPId?: string | null;
  proveedor?: string | null;
  notaProcedencia?: string | null;
  motivoVerificacion?: string | null;
  fechaUltimaVerificacion?: Date | null;
}

// Vincula cada material que devolvió la IA con su fila de PrecioMTOP, si la
// descripción coincide exacto (sin distinguir mayúsculas ni espacios de más).
// La fila se elige con el mismo resolver que usa clonar-apu
// (coincidenciasPrecioMaterial: exacta primero), así el vínculo apunta a la
// misma fila que va a resolver después "Guardar en biblioteca" o un clon.
// Con vínculo, el precio pasa a ser el del catálogo (si es > 0) en vez del
// que estimó la IA. Sin coincidencia exacta queda sin vínculo, como antes.
async function vincularMaterialesAlCatalogo(
  materiales: { descripcion?: string; unidad?: string; rendimiento?: number; precioUnit?: number }[]
): Promise<MaterialGenerado[]> {
  return Promise.all(
    materiales.map(async (m) => {
      const base: MaterialGenerado = {
        descripcion: m.descripcion ?? "",
        unidad: m.unidad ?? "",
        rendimiento: m.rendimiento ?? 0,
        precioUnit: redondearPrecio(m.precioUnit ?? 0),
        precioMTOPId: null,
      };
      if (!base.descripcion.trim()) return base;
      const [primera] = await coincidenciasPrecioMaterial(base.descripcion);
      if (!primera || normalizar(primera.descripcion) !== normalizar(base.descripcion)) return base;
      return {
        ...base,
        descripcion: primera.descripcion,
        precioUnit: primera.precioUnitario > 0 ? primera.precioUnitario : base.precioUnit,
        precioMTOPId: primera.id,
        proveedor: primera.proveedor,
        notaProcedencia: primera.notaProcedencia,
        motivoVerificacion: primera.motivoVerificacion,
        fechaUltimaVerificacion: primera.fechaUltimaVerificacion,
      };
    })
  );
}


interface ApuGenerado {
  materiales: MaterialGenerado[];
  manoObra: { categoria: string; rendimiento: number; jornal: number }[];
  // Calculado server-side con calcularPrecioUnitario() sobre el costo
  // directo real de materiales/mano de obra que la IA generó, más
  // gastosGeneralesPct/utilidadPct — nunca es un número que la IA
  // reporte directamente (ver bug histórico: le pedíamos un margen
  // plano de 25% que no coincidía con el 15%/10% que se guarda en el
  // APU, dando un ~1,2% de gap de origen en todo rubro generado por IA).
  precioUnitarioEstimado: number;
  // "biblioteca" si la IA tomó como base un subrubro real de SubrubroEstandar
  // (ver bibliotecaApus.ts); "estimado" si no había ninguno aplicable para
  // el capítulo de este rubro y generó todo con su criterio (MTOP/jornales,
  // comportamiento anterior). subrubroBaseId solo se llena si "biblioteca" —
  // trazabilidad al subrubro real usado, resuelta acá contra la lista
  // realmente consultada (nunca se confía en un id que devuelva la IA).
  origen: "biblioteca" | "estimado";
  subrubroBaseId: string | null;
}

/* ─── Genera y persiste el APU de un rubro vía IA ───────────── */
export async function generarApuParaRubro(
  rubroId: string,
  datos: { descripcion: string; unidad: string; capitulo: string; tipoObra: string },
  // "manual" = botón "Sugerir APU" (acción discrecional del usuario,
  // POST /api/rubros/[id]/sugerir-apu). "auto" = loop en background
  // disparado por generar-rubros, una vez por cada rubro que sugiere —
  // puede correr muchas veces sin que el usuario haga nada extra más
  // allá de crear el proyecto. Perfiles de costo distintos — separados
  // en el log de consumo de IA (LogConsumoIA.funcion), nunca mezclados.
  origen: "manual" | "auto" = "manual"
): Promise<ApuGenerado> {
  const { descripcion, unidad, capitulo, tipoObra } = datos;

  const [rubro, apuExistente, categorias, preciosMTOP, capituloCatalogoId] = await Promise.all([
    db.rubro.findUnique({
      where: { id: rubroId },
      select: {
        trabajoEnAltura: true,
        // Default de Utilidad%/Aportes Patronales del proyecto — solo se usa
        // si este rubro todavía no tiene un APU propio (ver apuExistente más
        // abajo). Gastos Generales ya no se resuelve acá — dejó de
        // prorratearse por rubro. `proyecto.id` se suma acá (mismo select,
        // sin costo extra de query) solo para poder loguear proyectoId en
        // el log de consumo de IA de abajo.
        capitulo: {
          select: {
            proyecto: {
              select: {
                id: true,
                empresaId: true,
                utilidadPctDefault: true,
                leyesSociales: {
                  select: {
                    focerPatronalPct: true, fscFocapPct: true, fosvocPct: true,
                    frlPct: true, fondoGarantiaPct: true, 
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.aPU.findUnique({ where: { rubroId } }),
    db.categoriaLaboral.findMany({ orderBy: { nombre: "asc" } }),
    // Materiales base + los relevantes para ESTE rubro (antes: los primeros
    // 50 alfabéticos) — ver lib/materialesParaPrompt.ts.
    materialesParaPrompt(descripcion),
    // Mismo resolver ya usado al crear un capítulo real (Fase 2, Etapa 5) —
    // undefined si el nombre no matchea ningún CapituloCatalogo (alias
    // ambiguo o inexistente). Sin esto no hay dónde buscar subrubros reales
    // para este rubro — cae al comportamiento anterior (estimado).
    resolverCapituloCatalogoId(db, capitulo || ""),
  ]);

  // Subrubros reales de biblioteca para EL capítulo de este rubro (uno
  // solo, a diferencia de calcular-rapido que puede tocar varios) — vacío
  // si capitulo no resolvió a ningún CapituloCatalogo, o si ese capítulo
  // no tiene biblioteca propia (fallback esperado, no error).
  const subrubrosBiblioteca: SubrubroConApu[] = capituloCatalogoId
    ? await buscarSubrubrosPorCapitulos([capituloCatalogoId])
    : [];
  const tablaBiblioteca = formatearSubrubrosParaPrompt(subrubrosBiblioteca);

  const tablaJornales = categorias
    .map((c) => `${c.nombre}: $${c.jornal} UYU/jornada (8hs)`)
    .join("\n");

  const tablaMateriales = preciosMTOP
    .map((p) => `${p.descripcion}: ${p.precioUnitario} UYU/${p.unidad}`)
    .join("\n");

  const notaAltura = rubro?.trabajoEnAltura
    ? "\n\nEste rubro requiere trabajo en altura. Incluir en la mano de obra la categoría Oficial trabajo en altura con el recargo correspondiente."
    : "";

  const prompt = `Rubro: "${descripcion}"
Unidad de medida: ${unidad || "—"}
Capítulo: ${capitulo || "—"}
Tipo de obra: ${tipoObra || "—"}

JORNALES SUNCA VIGENTES (Uruguay 2025):
${tablaJornales}

MATERIALES DEL CATÁLOGO (precios de referencia en UYU — Lista MTOP y proveedores):
${tablaMateriales}
${
  tablaBiblioteca
    ? `\nSUBRUBROS REALES DE BIBLIOTECA para el capítulo "${capitulo}" (Sociedad de Arquitectos del Uruguay — composiciones y precios reales, preferí SIEMPRE éstos si alguno aplica a este rubro específico, aunque tengas que ajustar cantidades/rendimientos a la escala de "${descripcion}"):\n${tablaBiblioteca}\n`
    : ""
}${notaAltura}

Devolvé SOLO un JSON con esta estructura exacta:
{
  "materiales": [
    { "descripcion": string, "unidad": string, "rendimiento": number, "precioUnit": number }
  ],
  "manoObra": [
    { "categoria": string, "rendimiento": number, "jornal": number }
  ],
  "origen": "biblioteca" | "estimado",
  "subrubroCodigoBase": string | null
}

Reglas:
- "rendimiento" en materiales = cantidad de material por unidad de rubro (ej: 0.35 m³ de arena por m² de revoque).
- "rendimiento" en mano de obra = unidades de rubro producidas por jornada de 8hs (ej: 12 m² de revoque por jornada).
- No calcules ni devuelvas ningún precio unitario final — eso lo calcula el sistema a partir de los materiales y mano de obra que devuelvas.
- Si un material de la lista del catálogo sirve, usalo copiando su descripción EXACTA, letra por letra (sin abreviar ni reformular) y con su precio. Solo si ninguno sirve, describí uno propio. Para mano de obra, usá la categoría SUNCA más adecuada.
- Si usaste como base alguno de los SUBRUBROS REALES DE BIBLIOTECA de arriba (aunque hayas ajustado cantidades a la escala de este rubro), marcá "origen": "biblioteca" y poné en "subrubroCodigoBase" el código entre corchetes de ese subrubro (ej. "1.1"). Si no había ninguno aplicable y generaste todo con tu criterio, marcá "origen": "estimado" y "subrubroCodigoBase": null.
- Respondé SOLO con JSON válido, sin texto adicional ni markdown.`;

  const message = await crearMensaje({ empresaId: rubro?.capitulo.proyecto.empresaId ?? null, funcion: `sugerir-apu:${origen}` }, {
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: `Sos un presupuestador experto en construcción uruguaya con 20 años de experiencia.
Generás APU (Análisis de Precios Unitarios) detallados y precisos para cada rubro de obra.
Usás terminología local: ticholo, ladrillo, viga de arriostre, pilar, hormigón, encofrado, mortero común.
Tus APU son realistas, basados en rendimientos reales de obra uruguaya, usando precios MTOP y jornales SUNCA.`,
    messages: [{ role: "user", content: prompt }],
  });

  void registrarLogConsumoIA({
    funcion: `sugerir-apu:${origen}`,
    proyectoId: rubro?.capitulo.proyecto.id ?? null,
    empresaId: rubro?.capitulo.proyecto.empresaId ?? null,
    inputTokens: message.usage.input_tokens ?? 0,
    outputTokens: message.usage.output_tokens ?? 0,
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Respuesta inválida del modelo");

  const apuBruto = JSON.parse(match[0]) as {
    materiales: { descripcion?: string; unidad?: string; rendimiento?: number; precioUnit?: number }[];
    manoObra: ApuGenerado["manoObra"];
    origen?: string;
    subrubroCodigoBase?: string | null;
  };

  // subrubroBaseId nunca sale directo de lo que devuelve la IA — se resuelve
  // acá contra subrubrosBiblioteca (la lista que REALMENTE se le pasó en el
  // prompt), así que un código inventado o mal copiado por la IA se
  // descarta solo en vez de quedar como una referencia falsa.
  const subrubroBase = apuBruto.subrubroCodigoBase
    ? subrubrosBiblioteca.find((s) => s.codigo === apuBruto.subrubroCodigoBase)
    : undefined;

  // Si el rubro YA tiene un APU guardado, su Utilidad% queda congelado —
  // regenerar por IA no debe pisarlo con el default vigente del proyecto.
  // Recién si es la primera vez que este rubro tiene APU se usa el default.
  // Gastos Generales ya no se congela por rubro — queda fijo en 0.
  const proyectoDefaults = rubro?.capitulo?.proyecto;
  const gastosGeneralesPct = 0;
  const utilidadPct = apuExistente ? apuExistente.utilidadPct : proyectoDefaults?.utilidadPctDefault ?? 10;
  // Aportes Patronales: mismo congelamiento — se lee en vivo de LeyesSociales
  // del proyecto (fallback al default legal si el registro no existe
  // todavía) solo si este rubro no tenía APU previo.
  const aportesPatronalesPct = apuExistente
    ? apuExistente.aportesPatronalesPct
    : sumarAportesPatronalesPct(proyectoDefaults?.leyesSociales);

  // Antes de calcular el precio: los materiales que coinciden con el
  // catálogo toman su precio real y su vínculo (precioMTOPId).
  const materiales = await vincularMaterialesAlCatalogo(apuBruto.materiales ?? []);

  // precioUnitarioEstimado se calcula acá, NUNCA se toma de lo que reporte
  // la IA — mismo patrón que clonar-apu/route.ts. Este flujo no genera
  // equipos, así que el costo directo es solo materiales + mano de obra.
  const sumMO = sumManoObra(
    apuBruto.manoObra.map((mo) => ({ rendimiento: mo.rendimiento ?? 1, jornalRef: mo.jornal ?? 0 })),
    []
  );
  const costoDirecto =
    materiales.reduce((s, m) => s + m.rendimiento * m.precioUnit, 0) +
    sumMO +
    montoAportesPatronales(sumMO, aportesPatronalesPct);
  const precioUnitarioEstimado = redondearPrecio(calcularPrecioUnitario(costoDirecto, utilidadPct));

  const apu: ApuGenerado = {
    materiales,
    manoObra: apuBruto.manoObra,
    precioUnitarioEstimado,
    origen: apuBruto.origen === "biblioteca" && subrubroBase ? "biblioteca" : "estimado",
    subrubroBaseId: subrubroBase?.id ?? null,
  };

  const apuRecord = apuExistente
    ? await db.aPU.update({ where: { rubroId }, data: { gastosGeneralesPct, utilidadPct, aportesPatronalesPct } })
    : await db.aPU.create({ data: { rubroId, gastosGeneralesPct, utilidadPct, aportesPatronalesPct } });

  const apuId = apuRecord.id;

  await db.materialAPU.deleteMany({ where: { apuId } });
  if (apu.materiales.length > 0) {
    await db.materialAPU.createMany({
      data: apu.materiales.map((m, i) => ({
        apuId,
        descripcion: m.descripcion,
        unidad: m.unidad,
        rendimiento: m.rendimiento,
        precioUnit: m.precioUnit,
        orden: i,
        precioMTOPId: m.precioMTOPId ?? null,
        proveedor: m.proveedor ?? null,
        notaProcedencia: m.notaProcedencia ?? null,
        motivoVerificacion: m.motivoVerificacion ?? null,
        fechaUltimaVerificacion: m.fechaUltimaVerificacion ?? null,
      })),
    });
  }

  await db.manoObraAPU.deleteMany({ where: { apuId } });
  for (let i = 0; i < apu.manoObra.length; i++) {
    const mo = apu.manoObra[i];
    await db.manoObraAPU.create({
      data: {
        apuId,
        categoria: mo.categoria ?? "",
        jornadaHs: 8,
        rendimiento: mo.rendimiento ?? 1,
        jornalRef: mo.jornal ?? 0,
        orden: i,
      },
    });
  }

  await db.rubro.update({
    where: { id: rubroId },
    data: { precioUnit: apu.precioUnitarioEstimado },
  });

  return apu;
}
