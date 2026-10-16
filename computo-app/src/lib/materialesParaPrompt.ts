import { db } from "@/lib/db";

// Qué materiales del catálogo (PrecioMTOP) se le muestran a la IA al generar
// un APU. Antes eran los primeros 50 en orden alfabético: la IA no conocía el
// resto, inventaba el material con su propia descripción y ese material
// quedaba sin vínculo al catálogo (y "Guardar en biblioteca" lo rechazaba).
//
// Ahora: un set base de materiales de obra que casi todo rubro húmedo usa
// (aunque la descripción no los nombre: un revoque lleva cemento), más los
// más relevantes para la descripción del rubro. La relevancia se calcula en
// memoria (el catálogo son ~1.000 filas) para poder comparar sin tildes y por
// INICIO de palabra: "poliuretánico" encuentra "poliuretano", "revoques"
// encuentra "revoque", y "cal" no se confunde con "MECAL".

export interface MaterialParaPrompt {
  id: string;
  descripcion: string;
  unidad: string;
  precioUnitario: number;
}

// Descripción EXACTA (tal cual está en PrecioMTOP) de los materiales base —
// las mismas filas que usa la biblioteca de subrubros (ej. el cemento es el
// código 141, no el "ANCAP en Planta", que tiene otro precio). Si alguno
// deja de existir en el catálogo, simplemente no se agrega.
const NOMBRES_BASE = [
  "Cemento portland gris (Montevideo, en bolsa, en obra)",
  "Arena fina (en obra)",
  "Arena gruesa (en obra)",
  "Cal hidratada",
  "Balasto natural (en obra)",
  "Pedregullo lavado (en obra)",
];

// Palabras de la descripción del rubro que no ayudan a encontrar materiales.
const STOPWORDS = new Set([
  "con", "sin", "para", "por", "del", "las", "los", "una", "uno", "que", "sobre", "desde", "entre", "hasta",
  "incluye", "incluido", "incluida", "tipo", "segun", "cada", "todo", "toda", "otros", "otras", "etc",
  "obra", "obras", "material", "materiales", "mano", "trabajo", "trabajos", "colocacion", "suministro",
  "aplicacion", "ejecucion", "zona", "zonas", "nuevo", "nueva", "existente", "general",
]);

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const normalizar = (s: string) => sinTildes(s).toLowerCase().replace(/\s+/g, " ").trim();
const palabras = (s: string) => normalizar(s).split(/[^a-z0-9ñ]+/).filter(Boolean);

// Raíz de cada palabra relevante del rubro (5 letras alcanzan para cubrir
// plurales y derivados sin abrir demasiado).
export function raicesDelRubro(descripcion: string): string[] {
  const raices = palabras(descripcion)
    .filter((p) => p.length >= 3 && !STOPWORDS.has(p) && !/^\d+$/.test(p))
    .map((p) => (p.length > 5 ? p.slice(0, 5) : p));
  return [...new Set(raices)];
}

export async function materialesParaPrompt(descripcionRubro: string, maximo = 80): Promise<MaterialParaPrompt[]> {
  const catalogo = await db.precioMTOP.findMany({
    where: { empresaId: null },
    select: { id: true, descripcion: true, unidad: true, precioUnitario: true },
    orderBy: { descripcion: "asc" },
  });

  // Una sola fila por descripción (hay materiales repetidos por proveedor).
  const vistos = new Set<string>();
  const unicos = catalogo.filter((m) => {
    const k = normalizar(m.descripcion);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  const base = NOMBRES_BASE.map((nombre) => unicos.find((m) => normalizar(m.descripcion) === normalizar(nombre))).filter(
    (m): m is MaterialParaPrompt => !!m
  );
  const idsBase = new Set(base.map((m) => m.id));

  const raices = raicesDelRubro(descripcionRubro);
  const relevantes = unicos
    .filter((m) => !idsBase.has(m.id))
    .map((m) => {
      const pal = palabras(m.descripcion);
      const puntaje = raices.filter((r) => pal.some((p) => p.startsWith(r))).length;
      return { m, puntaje };
    })
    .filter((x) => x.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje || a.m.descripcion.length - b.m.descripcion.length)
    .slice(0, Math.max(0, maximo - base.length))
    .map((x) => x.m);

  return [...base, ...relevantes];
}
