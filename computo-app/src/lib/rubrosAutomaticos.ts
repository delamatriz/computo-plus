import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { generarApuParaRubro } from "@/lib/apu";
import { clonarApuAlRubro } from "@/lib/clonarApu";
import { registrarLogConsumoIA } from "@/lib/logConsumoIA";

const client = new Anthropic();

interface RubroSugerido {
  // Número del capítulo en la lista numerada que se le pasa a la IA (ver
  // generarRubrosAutomaticosInterno) — no el nombre: con varios títulos los
  // nombres se repiten ("Demoliciones y Picados" en cada frente).
  capitulo: number;
  descripcion: string;
  unidad: string;
}

export interface CapituloConMonto {
  nombre: string;
  monto: number;
  // Presentes en el desglose real de Cálculo Rápido aunque el tipo
  // CapituloIA del frontend no los declara — ver calcular-rapido/route.ts.
  materiales?: number;
  manoObra?: number;
  origen?: "biblioteca" | "estimado";
  codigoSubrubro?: string | null;
}

// Capítulo de proyecto donde caen los ítems de Cálculo Rápido sin
// codigoSubrubro real (origen "estimado") — no hay forma de inferir a qué
// capítulo pertenecen (el nombre del ítem es un rubro, no un capítulo), así
// que quedan agrupados acá, visibles y editables, sin bloquear el flujo.
const NOMBRE_CAPITULO_VERIFICAR = "Ítems a verificar";

/* ─── Genera los rubros iniciales de un proyecto recién creado.
   Si viene con capitulosConMontos (desglose de Cálculo Rápido), clona los
   subrubros reales ya matcheados en vez de regenerarlos con una IA nueva.
   Si no, usa el flujo anterior (IA sugiere rubros por capítulo). Pensada
   para ejecutarse en background (no se espera su resolución). ── */
export async function generarRubrosAutomaticos(
  proyectoId: string,
  capitulosConMontos?: CapituloConMonto[]
): Promise<void> {
  try {
    if (capitulosConMontos && capitulosConMontos.length > 0) {
      await generarRubrosDesdeCalculoRapido(proyectoId, capitulosConMontos);
    } else {
      await generarRubrosAutomaticosInterno(proyectoId);
    }
  } finally {
    await db.proyecto.update({
      where: { id: proyectoId },
      data: { generandoRubros: false },
    }).catch((err) => console.error("[rubrosAutomaticos] no se pudo limpiar generandoRubros", err));
  }
}

/* ─── Camino nuevo: viene de Cálculo Rápido. Por cada ítem con
   codigoSubrubro válido (revalidado contra la biblioteca real), clona el
   subrubro real —con su APU real— al capítulo real correspondiente. Los
   ítems sin match real (origen "estimado") van a un capítulo de fallback,
   marcados para verificar, sin pasar por ninguna IA. ── */
async function generarRubrosDesdeCalculoRapido(
  proyectoId: string,
  items: CapituloConMonto[]
): Promise<void> {
  const proyecto = await db.proyecto.findUnique({
    where: { id: proyectoId },
    include: {
      capitulos: true,
      titulos: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!proyecto || proyecto.titulos.length === 0) return;

  let capitulos = proyecto.capitulos;
  const tituloDefaultId = capitulos[0]?.tituloId ?? proyecto.titulos[0].id;

  const siguienteOrdenCapitulo = () =>
    capitulos.length ? Math.max(...capitulos.map((c) => c.orden)) + 1 : 0;

  const siguienteCodigoRubro = async (capituloId: string) => {
    const ultimo = await db.rubro.findFirst({
      where: { capituloId },
      orderBy: { createdAt: "desc" },
      select: { codigo: true },
    });
    const n = ultimo ? parseInt(ultimo.codigo.replace(/\D/g, "") || "0") + 1 : 1;
    return `R${String(n).padStart(3, "0")}`;
  };

  const obtenerOCrearCapituloVerificar = async () => {
    const existente = capitulos.find(
      (c) => c.nombre.trim().toLowerCase() === NOMBRE_CAPITULO_VERIFICAR.toLowerCase()
    );
    if (existente) return existente;

    const orden = siguienteOrdenCapitulo();
    const nuevo = await db.capitulo.create({
      data: {
        proyectoId,
        tituloId: tituloDefaultId,
        nombre: NOMBRE_CAPITULO_VERIFICAR,
        codigo: String(orden + 1).padStart(2, "0"),
        orden,
      },
    });
    capitulos = [...capitulos, nuevo];
    return nuevo;
  };

  const obtenerOCrearCapituloReal = async (
    capituloCatalogo: { id: string; nombre: string }
  ) => {
    const { id: capituloCatalogoId, nombre } = capituloCatalogo;

    const porCatalogo = capitulos.find((c) => c.capituloCatalogoId === capituloCatalogoId);
    if (porCatalogo) return porCatalogo;

    const porNombre = capitulos.find(
      (c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()
    );
    if (porNombre) {
      if (!porNombre.capituloCatalogoId) {
        await db.capitulo.update({
          where: { id: porNombre.id },
          data: { capituloCatalogoId },
        });
      }
      return porNombre;
    }

    const orden = siguienteOrdenCapitulo();
    const nuevo = await db.capitulo.create({
      data: {
        proyectoId,
        tituloId: tituloDefaultId,
        nombre,
        codigo: String(orden + 1).padStart(2, "0"),
        orden,
        capituloCatalogoId,
      },
    });
    capitulos = [...capitulos, nuevo];
    return nuevo;
  };

  const crearRubroEstimado = async (item: CapituloConMonto) => {
    const capitulo = await obtenerOCrearCapituloVerificar();
    const codigo = await siguienteCodigoRubro(capitulo.id);
    const monto = Math.round(item.monto);

    const rubro = await db.rubro.create({
      data: {
        capituloId: capitulo.id,
        codigo,
        descripcion: item.nombre.trim(),
        unidad: "gl",
        cantidad: 1,
        // Sin utilidad ni aportes patronales, precioUnit colapsa al monto
        // estimado por Cálculo Rápido — no hace falta pasar por
        // calcularPrecioUnitario para un único material a rendimiento 1.
        precioUnit: monto,
      },
    });

    const apu = await db.aPU.create({
      data: {
        rubroId: rubro.id,
        gastosGeneralesPct: 0,
        utilidadPct: 0,
        aportesPatronalesPct: 0,
        porcentajePiedra: 0.3,
      },
    });

    await db.materialAPU.create({
      data: {
        apuId: apu.id,
        descripcion: item.nombre.trim(),
        unidad: "gl",
        rendimiento: 1,
        precioUnit: monto,
        orden: 0,
        motivoVerificacion: "sin_precio_referencia",
      },
    });
  };

  for (const item of items) {
    try {
      const codigoSubrubro = item.codigoSubrubro?.trim();
      const subrubro = codigoSubrubro
        ? await db.subrubroEstandar.findUnique({
            where: { codigo: codigoSubrubro },
            include: { capituloCatalogo: true },
          })
        : null;

      if (!subrubro || !subrubro.capituloCatalogo) {
        await crearRubroEstimado(item);
        continue;
      }

      const capitulo = await obtenerOCrearCapituloReal(subrubro.capituloCatalogo);
      const codigo = await siguienteCodigoRubro(capitulo.id);

      const rubro = await db.rubro.create({
        data: {
          capituloId: capitulo.id,
          codigo,
          descripcion: item.nombre.trim(),
          unidad: subrubro.unidad,
          cantidad: 1,
          precioUnit: 0,
        },
      });

      const { costoDirecto } = await clonarApuAlRubro(subrubro.id, rubro.id);

      // Despeja la cantidad contra el COSTO DIRECTO puro del subrubro (sin
      // su Utilidad% interna) — el monto de Cálculo Rápido es en sí mismo
      // un costo directo (se ve en su propia pantalla, antes de aplicar
      // Gastos Generales/Beneficio). Si se despejara contra precioUnit
      // final (que ya incluye Utilidad%), el margen quedaría duplicado: una
      // vez adentro del precio de biblioteca, otra vez a nivel de proyecto.
      // No hay cantidad/unidad propia en el desglose original de Cálculo
      // Rápido, así que no hay otra forma de anclarla.
      const cantidad = costoDirecto > 0 ? item.monto / costoDirecto : 1;
      await db.rubro.update({
        where: { id: rubro.id },
        data: { cantidad: Math.round(cantidad * 100) / 100 },
      });
    } catch (err) {
      console.error("[rubrosAutomaticos] error procesando ítem de Cálculo Rápido", item, err);
    }
  }
}

/* ─── Camino anterior: proyecto "+ Nuevo proyecto" desde cero, sin
   Cálculo Rápido de por medio. IA sugiere 2-3 rubros por capítulo. ── */
async function generarRubrosAutomaticosInterno(proyectoId: string): Promise<void> {
  const proyecto = await db.proyecto.findUnique({
    where: { id: proyectoId },
    include: { capitulos: true, titulos: true },
  });

  const descripcionTrabajos = proyecto?.trabajos?.trim() || proyecto?.descripcion?.trim();
  if (!proyecto || !descripcionTrabajos || proyecto.capitulos.length === 0) return;

  // Capítulos numerados en el orden del presupuesto (título y capítulo), con
  // el nombre del título adelante cuando hay 2 o más. La IA devuelve el
  // NÚMERO del capítulo de cada rubro, no su nombre: antes se buscaba el
  // capítulo por nombre y, como los títulos repiten capítulos ("Demoliciones
  // y Picados" en cada frente), todos los rubros caían en los del primer
  // título y los demás quedaban vacíos.
  const ordenTitulo = new Map(proyecto.titulos.map((t) => [t.id, t.orden]));
  const nombreTitulo = new Map(proyecto.titulos.map((t) => [t.id, t.nombre]));
  const conVariosTitulos = proyecto.titulos.length >= 2;
  const capitulosNumerados = [...proyecto.capitulos].sort(
    (a, b) => (ordenTitulo.get(a.tituloId) ?? 0) - (ordenTitulo.get(b.tituloId) ?? 0) || a.orden - b.orden
  );
  const listaCapitulos = capitulosNumerados
    .map((c, i) => `[${i + 1}] ${conVariosTitulos ? `${nombreTitulo.get(c.tituloId) ?? "Sin título"} › ` : ""}${c.nombre}`)
    .join("\n");
  const aclaracionTitulos = conVariosTitulos
    ? " El presupuesto está dividido en títulos (frentes de obra independientes) y un mismo capítulo puede repetirse en varios: sugerí rubros propios de cada título según su nombre."
    : "";

  // El área se suma al prompt solo como referencia de escala (qué rubros y qué
  // unidad tienen sentido); no entra en ningún cálculo.
  const lineaArea = proyecto.area && proyecto.area > 0 ? ` Área de la obra: ${proyecto.area} m².` : "";

  const prompt = `Dado este presupuesto de obra tipo ${proyecto.tipo} con la siguiente descripción de trabajos: '${descripcionTrabajos}', y estos capítulos numerados:
${listaCapitulos}
${lineaArea}${aclaracionTitulos} Sugerí los 2-3 rubros más importantes para cada capítulo, con descripción y unidad de medida. Basate en prácticas constructivas uruguayas.
Para la unidad: si el rubro es de estimación global usá unidad "gl", si tiene medida clara (superficie, volumen, longitud) usá m², m³ o ml.
En "capitulo" poné el NÚMERO del capítulo de la lista (el que está entre corchetes), no su nombre.
Respondé SOLO con JSON:
{ "rubros": [{ "capitulo": number, "descripcion": string, "unidad": string }] }`;

  let sugerencias: RubroSugerido[] = [];
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      // 2-3 rubros por capítulo y por título: con varios títulos la lista
      // crece y 2000 tokens podía cortar el JSON (y sin JSON no hay rubros).
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    void registrarLogConsumoIA({
      funcion: "generar-rubros",
      proyectoId,
      empresaId: proyecto.empresaId ?? null,
      inputTokens: message.usage.input_tokens ?? 0,
      outputTokens: message.usage.output_tokens ?? 0,
    });
    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Respuesta inválida del modelo");
    const data = JSON.parse(match[0]) as { rubros: RubroSugerido[] };
    sugerencias = data.rubros ?? [];
  } catch (err) {
    console.error("[rubrosAutomaticos] sugerencia de rubros", err);
    return;
  }

  for (const sugerido of sugerencias) {
    // Número fuera de la lista (o que no es un número) → el rubro se
    // descarta: mejor que caiga en un capítulo equivocado.
    const numero = Number(sugerido.capitulo);
    const capitulo = Number.isInteger(numero) ? capitulosNumerados[numero - 1] : undefined;
    if (!capitulo || !sugerido.descripcion?.trim()) continue;

    try {
      const ultimo = await db.rubro.findFirst({
        where: { capituloId: capitulo.id },
        orderBy: { createdAt: "desc" },
        select: { codigo: true },
      });
      const n = ultimo ? parseInt(ultimo.codigo.replace(/\D/g, "") || "0") + 1 : 1;

      const rubro = await db.rubro.create({
        data: {
          capituloId: capitulo.id,
          codigo: `R${String(n).padStart(3, "0")}`,
          descripcion: sugerido.descripcion.trim(),
          unidad: sugerido.unidad?.trim() || "gl",
          cantidad: 1,
          precioUnit: 0,
        },
      });

      await generarApuParaRubro(
        rubro.id,
        {
          descripcion: rubro.descripcion,
          unidad: rubro.unidad,
          capitulo: capitulo.nombre,
          tipoObra: proyecto.tipo,
        },
        "auto"
      );
    } catch (err) {
      console.error("[rubrosAutomaticos] error generando rubro", sugerido, err);
    }
  }
}
