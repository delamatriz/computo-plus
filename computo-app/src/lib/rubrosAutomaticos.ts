import { crearMensaje, ErrorFuncionNoDisponible } from "@/lib/anthropic-client";
import { db } from "@/lib/db";
import { generarApuParaRubro } from "@/lib/apu";
import { clonarApuAlRubro } from "@/lib/clonarApu";
import { tipoCambioVigente } from "@/lib/tipoCambio";
import { registrarLogConsumoIA } from "@/lib/logConsumoIA";
import { randomUUID } from "crypto";
import { calcularPrecioUnitario, redondearPrecio, sumarAportesPatronalesPct } from "@/lib/apu-calc";
import { costoDirectoUnitario } from "@/lib/costoAgregado";


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
  // Código del subrubro usado: de la biblioteca global ("6.6.8") o de la
  // personal de la empresa ("MB-" + primeros 8 caracteres del id de
  // SubrubroEmpresa, ver buscarSubrubrosEmpresa en bibliotecaApus.ts).
  codigoSubrubro?: string | null;
  // Cantidad de la unidad del subrubro que pidió la IA (null si es estimado).
  cantidad?: number | null;
  // Capítulo al que pertenece el ítem, si el desglose lo trae. Hoy Cálculo
  // Rápido no lo devuelve (cada elemento ES el ítem): se busca por `nombre`.
  nombreCapitulo?: string;
}

// Palabras que no sirven para reconocer un capítulo del catálogo por nombre.
const PALABRAS_GENERICAS_CAPITULO = new Set([
  "de", "del", "la", "las", "el", "los", "y", "e", "en", "a", "con", "para", "por",
  "obra", "obras", "instalacion", "instalaciones", "trabajos", "otros", "general", "varios",
]);

// Raíces (5 letras, sin tildes) de las palabras significativas de un nombre.
function raicesNombreCapitulo(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p.length >= 3 && !PALABRAS_GENERICAS_CAPITULO.has(p))
    .map((p) => p.slice(0, 5));
}

// Capítulo de proyecto donde caen los ítems de Cálculo Rápido sin
// codigoSubrubro real (origen "estimado") — no hay forma de inferir a qué
// capítulo pertenecen (el nombre del ítem es un rubro, no un capítulo), así
// que quedan agrupados acá, visibles y editables, sin bloquear el flujo.
const NOMBRE_CAPITULO_VERIFICAR = "Ítems a verificar";
// Capítulo de los rubros de "Mi biblioteca" cuyo nombre no corresponde a
// ningún capítulo del catálogo (SubrubroEmpresa no tiene capítulo propio).
const NOMBRE_CAPITULO_RUBROS_PROPIOS = "Rubros propios";

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
      leyesSociales: {
        select: { focerPatronalPct: true, fscFocapPct: true, fosvocPct: true, frlPct: true, fondoGarantiaPct: true },
      },
    },
  });
  if (!proyecto || proyecto.titulos.length === 0) return;

  // Dólar BCU vigente: se lee una sola vez y solo si hace falta (proyecto en USD).
  let tipoCambio: number | null = null;
  const obtenerTipoCambio = async () => (tipoCambio ??= (await tipoCambioVigente()).valor);

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

  const obtenerOCrearCapituloVerificar = () => obtenerOCrearCapituloPorNombre(NOMBRE_CAPITULO_VERIFICAR);

  // Capítulo propio del proyecto (sin capítulo de catálogo) por nombre exacto.
  const obtenerOCrearCapituloPorNombre = async (nombre: string) => {
    const existente = capitulos.find(
      (c) => c.nombre.trim().toLowerCase() === nombre.toLowerCase()
    );
    if (existente) return existente;

    const orden = siguienteOrdenCapitulo();
    const nuevo = await db.capitulo.create({
      data: {
        proyectoId,
        tituloId: tituloDefaultId,
        nombre,
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

  // Capítulo del catálogo que corresponde a un nombre: igual (sin tildes ni
  // mayúsculas) o, si no, el que comparte más raíces de palabra con él
  // ("Pintura interior" → Pinturas, "Reparación de cañería sanitaria" →
  // Instalación Sanitaria). Empate o ninguna coincidencia → null.
  let capitulosCatalogo: { id: string; nombre: string }[] | null = null;
  const capituloCatalogoPorNombre = async (nombre: string) => {
    capitulosCatalogo ??= await db.capituloCatalogo.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
    });
    const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    const igual = capitulosCatalogo.find((c) => normalizar(c.nombre) === normalizar(nombre));
    if (igual) return igual;

    const raicesItem = new Set(raicesNombreCapitulo(nombre));
    let mejor: { id: string; nombre: string } | null = null;
    let mejorScore = 0;
    let empate = false;
    for (const c of capitulosCatalogo) {
      const score = raicesNombreCapitulo(c.nombre).filter((r) => raicesItem.has(r)).length;
      if (score > mejorScore) {
        mejor = c;
        mejorScore = score;
        empate = false;
      } else if (score > 0 && score === mejorScore) {
        empate = true;
      }
    }
    return empate ? null : mejor;
  };

  // Capítulo real para un ítem sin subrubro de catálogo: el del catálogo que
  // corresponde a su nombre; si no hay uno claro, "Ítems a verificar".
  const capituloParaItem = async (nombre: string) => {
    const capituloCatalogo = await capituloCatalogoPorNombre(nombre);
    return capituloCatalogo ? obtenerOCrearCapituloReal(capituloCatalogo) : obtenerOCrearCapituloVerificar();
  };

  const crearRubroEstimado = async (item: CapituloConMonto) => {
    const capitulo = await capituloParaItem(item.nombreCapitulo ?? item.nombre);
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
        // calcularPrecioUnitario: materiales + mano de obra suman el monto.
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

    // Apertura materiales / mano de obra que trae la estimación. Anteproyectos
    // viejos (o un ítem sin apertura) → un único material GL por el monto,
    // como siempre. La apertura se escala al monto para que el APU siga
    // sumando exactamente el precioUnit del rubro.
    const mat = item.materiales;
    const mo = item.manoObra;
    const conApertura =
      typeof mat === "number" && typeof mo === "number" &&
      Number.isFinite(mat) && Number.isFinite(mo) && mat >= 0 && mo >= 0 && mat + mo > 0;
    const montoManoObra = conApertura ? Math.round((monto * mo) / (mat + mo)) : 0;
    const montoMateriales = monto - montoManoObra;

    if (montoMateriales > 0 || !conApertura) {
      await db.materialAPU.create({
        data: {
          apuId: apu.id,
          descripcion: item.nombre.trim(),
          unidad: "gl",
          rendimiento: 1,
          precioUnit: montoMateriales,
          orden: 0,
          motivoVerificacion: "sin_precio_referencia",
        },
      });
    }

    if (montoManoObra > 0) {
      const categoria = await categoriaParaManoObra(item.nombre);
      const jornal = categoria?.jornal ?? 0;
      // Costo de MO en el APU = jornalRef / rendimiento (rendimiento = gl por
      // jornada), así que rendimiento = 1 / jornadas, con jornadas = monto / jornal.
      // Sin jornal: 1 jornada a un jornal igual al monto.
      await db.manoObraAPU.create({
        data: {
          apuId: apu.id,
          categoria: categoria?.nombre ?? "Oficial albañil",
          jornadaHs: 8,
          rendimiento: jornal > 0 ? jornal / montoManoObra : 1,
          jornalRef: jornal > 0 ? jornal : montoManoObra,
          orden: 0,
        },
      });
    }
  };

  // Categoría SUNCA más cercana al ítem, por palabras clave del nombre
  // (pintura → Pintor oficial, sanitaria → Plomero oficial, …); si no hay
  // pista, Oficial albañil; si tampoco existe, la primera de la tabla.
  // CategoriaLaboral es global (no por empresa). Se lee una sola vez.
  let categoriasLaborales: { nombre: string; categoria: string; jornal: number }[] | null = null;
  const categoriaParaManoObra = async (nombreItem: string) => {
    categoriasLaborales ??= await db.categoriaLaboral.findMany({
      select: { nombre: true, categoria: true, jornal: true },
      orderBy: { nombre: "asc" },
    });
    const texto = nombreItem.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const pistas: [RegExp, string][] = [
      [/pintur|pintad/, "pintor_oficial"],
      [/sanitari|cañer|caner|desag|agua|griferi|plomer/, "plomero_oficial"],
      [/electri|tomacorr|luminar|tablero|cablead/, "electricista_oficial"],
      [/\bgas\b|gasist/, "oficial_gasista"],
      [/demoli|picad|limpieza|retiro|escombr/, "peon"],
    ];
    const codigo = pistas.find(([re]) => re.test(texto))?.[1] ?? "oficial";
    return (
      categoriasLaborales.find((c) => c.categoria === codigo) ??
      categoriasLaborales.find((c) => c.categoria === "oficial") ??
      categoriasLaborales[0] ??
      null
    );
  };

  // Rubro de "Mi biblioteca" (SubrubroEmpresa): copia su APU real al rubro.
  // SubrubroEmpresa no tiene capítulo: va al del catálogo que corresponde a
  // su nombre o, si no hay uno claro, a "Rubros propios" — nunca a "Ítems a
  // verificar", porque es un precio real de la empresa. Devuelve false si el
  // subrubro no existe (o no tiene APU) en la empresa del proyecto.
  const crearRubroDesdeBibliotecaEmpresa = async (item: CapituloConMonto, prefijoId: string) => {
    if (!proyecto.empresaId || prefijoId.length < 8) return false;
    const subrubro = await db.subrubroEmpresa.findFirst({
      where: { empresaId: proyecto.empresaId, id: { startsWith: prefijoId } },
      include: {
        apus: {
          orderBy: { createdAt: "asc" },
          take: 1,
          include: { materiales: true, manoObra: true, equipos: true },
        },
      },
    });
    const apuEmpresa = subrubro?.apus[0];
    if (!subrubro || !apuEmpresa) return false;

    const capituloCatalogo = await capituloCatalogoPorNombre(item.nombreCapitulo ?? subrubro.nombre);
    const capitulo = capituloCatalogo
      ? await obtenerOCrearCapituloReal(capituloCatalogo)
      : await obtenerOCrearCapituloPorNombre(NOMBRE_CAPITULO_RUBROS_PROPIOS);
    const codigo = await siguienteCodigoRubro(capitulo.id);

    const utilidadPct = proyecto.utilidadPctDefault ?? apuEmpresa.utilidadPct;
    // Misma correspondencia que guardar-en-mi-biblioteca, al revés:
    // cantidad ↔ rendimiento, jornal ↔ jornalRef, jornadasHoras ↔ jornadaHs.
    const equipoIdMap = new Map(apuEmpresa.equipos.map((e) => [e.id, randomUUID()]));
    const apu = await db.aPU.create({
      data: {
        gastosGeneralesPct: 0,
        utilidadPct,
        aportesPatronalesPct: sumarAportesPatronalesPct(proyecto.leyesSociales),
        rubro: {
          create: {
            capituloId: capitulo.id,
            codigo,
            descripcion: subrubro.nombre.trim(),
            unidad: subrubro.unidad,
            cantidad: 1,
            precioUnit: 0,
          },
        },
        materiales: {
          create: apuEmpresa.materiales.map((m, i) => ({
            descripcion: m.descripcion,
            unidad: m.unidad,
            rendimiento: m.cantidad,
            precioUnit: m.precioUnit,
            orden: i,
            precioMTOPId: m.precioMTOPId,
          })),
        },
        equipos: {
          create: apuEmpresa.equipos.map((e, i) => ({
            id: equipoIdMap.get(e.id),
            descripcion: e.descripcion,
            unidad: e.unidad,
            rendimiento: e.cantidad,
            costoUnit: e.costoUnit,
            orden: i,
          })),
        },
      },
      include: { rubro: true },
    });
    // La mano de obra después de los equipos: equipoRelacionadoId apunta a ellos.
    if (apuEmpresa.manoObra.length > 0) {
      await db.manoObraAPU.createMany({
        data: apuEmpresa.manoObra.map((mo, i) => ({
          apuId: apu.id,
          categoria: mo.categoria,
          jornadaHs: mo.jornadasHoras ?? 8,
          rendimiento: mo.cantidad,
          jornalRef: mo.jornal,
          orden: i,
          equipoRelacionadoId: mo.equipoId ? equipoIdMap.get(mo.equipoId) ?? null : null,
        })),
      });
    }

    const apuCompleto = await db.aPU.findUniqueOrThrow({
      where: { id: apu.id },
      include: { materiales: true, manoObra: true, equipos: true },
    });
    const costoDirecto = costoDirectoUnitario(apuCompleto);
    // La cantidad que pidió la IA (el monto de Cálculo Rápido es cantidad ×
    // precio propio); sin ella, se despeja del monto como en el catálogo global.
    const montoEnPesos = proyecto.moneda === "USD" ? item.monto * (await obtenerTipoCambio()) : item.monto;
    const cantidad =
      typeof item.cantidad === "number" && item.cantidad > 0
        ? item.cantidad
        : costoDirecto > 0 ? montoEnPesos / costoDirecto : 1;
    await db.rubro.update({
      where: { id: apu.rubro.id },
      data: {
        cantidad: Math.round(cantidad * 100) / 100,
        precioUnit: redondearPrecio(calcularPrecioUnitario(costoDirecto, utilidadPct)),
      },
    });
    return true;
  };

  for (const item of items) {
    try {
      const codigoSubrubro = item.codigoSubrubro?.trim();

      if (codigoSubrubro?.startsWith("MB-")) {
        const copiado = await crearRubroDesdeBibliotecaEmpresa(item, codigoSubrubro.slice(3));
        if (!copiado) await crearRubroEstimado(item);
        continue;
      }

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
      // El costo directo del APU copiado está en pesos; si la estimación (y el
      // proyecto) es en dólares, el monto se pasa a pesos con el dólar BCU
      // guardado (el mismo que usó la estimación) antes de dividir.
      const montoEnPesos = proyecto.moneda === "USD" ? item.monto * (await obtenerTipoCambio()) : item.monto;
      const cantidad = costoDirecto > 0 ? montoEnPesos / costoDirecto : 1;
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
    const message = await crearMensaje({ empresaId: proyecto.empresaId ?? null, funcion: "generar-rubros" }, {
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
      // Tope de gasto / clave de pruebas: los demás rubros fallarían igual
      // (el EventoAdmin ya quedó registrado en crearMensaje).
      if (err instanceof ErrorFuncionNoDisponible) break;
    }
  }
}
