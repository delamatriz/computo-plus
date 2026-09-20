import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { generarApuParaRubro } from "@/lib/apu";
import { clonarApuAlRubro } from "@/lib/clonarApu";

const client = new Anthropic();

interface RubroSugerido {
  capitulo: string;
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
    include: { capitulos: true },
  });

  const descripcionTrabajos = proyecto?.trabajos?.trim() || proyecto?.descripcion?.trim();
  if (!proyecto || !descripcionTrabajos || proyecto.capitulos.length === 0) return;

  const listaCapitulos = proyecto.capitulos.map((c) => c.nombre).join(", ");

  const prompt = `Dado este presupuesto de obra tipo ${proyecto.tipo} con la siguiente descripción de trabajos: '${descripcionTrabajos}', y estos capítulos: ${listaCapitulos}, sugerí los 2-3 rubros más importantes para cada capítulo, con descripción y unidad de medida. Basate en prácticas constructivas uruguayas.
Para la unidad: si el rubro es de estimación global usá unidad "gl", si tiene medida clara (superficie, volumen, longitud) usá m², m³ o ml.
Respondé SOLO con JSON:
{ "rubros": [{ "capitulo": string, "descripcion": string, "unidad": string }] }`;

  let sugerencias: RubroSugerido[] = [];
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
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
    const capitulo = proyecto.capitulos.find(
      (c) => c.nombre.toLowerCase() === sugerido.capitulo?.toLowerCase()
    ) ?? proyecto.capitulos.find((c) =>
      c.nombre.toLowerCase().includes(sugerido.capitulo?.toLowerCase() ?? "__") ||
      (sugerido.capitulo ?? "").toLowerCase().includes(c.nombre.toLowerCase())
    );
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

      await generarApuParaRubro(rubro.id, {
        descripcion: rubro.descripcion,
        unidad: rubro.unidad,
        capitulo: capitulo.nombre,
        tipoObra: proyecto.tipo,
      });
    } catch (err) {
      console.error("[rubrosAutomaticos] error generando rubro", sugerido, err);
    }
  }
}
