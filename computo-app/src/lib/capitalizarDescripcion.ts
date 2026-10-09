// Capitalización de descripciones de rubros y subrubros (regla de Luis,
// oct-2026): "oración" — primera letra en mayúscula, el resto en minúscula —
// con excepciones que se respetan:
//
//   - Siglas, en mayúscula (SIGLAS). GL, ML, M2 y M3 se dejan como están
//     escritas: chocan con las unidades gl, ml, m2, m3.
//   - Unidades, en minúscula (UNIDADES).
//   - Números y medidas: toda palabra con un dígito queda tal cual (4x3m,
//     50x50cm, 1.50x1.10m, ø20mm, H-21, N°14, e=20cm, SIKALASTIC-560).
//   - Marcas y nombres propios, con su forma (MARCAS), incluidas las de dos
//     palabras o con guion (Steel Framing, Low-E).
//   - Lo que va después de un guion largo o dentro de un paréntesis se
//     convierte igual que el resto.
//
// Sin dependencias (ni base de datos ni React): la usan el presupuesto al
// mostrar descripciones y el script que unificó la Biblioteca
// (scripts/_historico/unificar-capitalizacion-biblioteca-2026-10.ts).
// Aplicarla dos veces da lo mismo.

export const SIGLAS = new Set([
  "PVC", "DVH", "EPP", "UTE", "OSE", "DNB", "BPS", "SUNCA", "MTOP", "IVA", "SAU", "URSEA",
  "BTU", "LED", "IPN", "PPR", "IP", "DVR", "NVR", "PIR", "PVB", "TPO", "OSB", "SIP", "WPC",
  "PQS", "BIE", "AFFF", "VMC", "MRL", "PH", "TV", "RF", "UNIT",
]);
const SIGLAS_TAL_CUAL = new Set(["GL", "ML", "M2", "M3"]);
export const UNIDADES = new Set(["cm", "mm", "m²", "m³", "ml", "kg", "tn", "kw", "kva", "ø"]);
export const MARCAS = [
  "Durlock", "Summa", "Probba", "Sikalastic", "Elastocolor", "Retak", "Asfalkote", "Cepol",
  "SikaTop", "Sikadur", "Sikafill", "Sika", "Isopanel", "Xypex", "Penetron", "Durock",
  "Inverter", "WiFi", "Zigbee", "Low-E", "Steel Framing", "Uruguay",
  // Parte del nombre de productos Sika: SikaTop Modul, Sikadur-32 Gel.
  "Modul", "Gel",
];
// Marcas de una sola palabra, por su forma en minúscula.
const MARCAS_PALABRA = new Map(MARCAS.filter((m) => /^[\p{L}]+$/u.test(m)).map((m) => [m.toLocaleLowerCase("es"), m]));
// Marcas de varias palabras o con guion: se reponen al final sobre el texto.
const MARCAS_FRASE = MARCAS.filter((m) => !/^[\p{L}]+$/u.test(m));

const L = (s: string) => s.toLocaleLowerCase("es");
const U = (s: string) => s.toLocaleUpperCase("es");
const esLetra = (ch: string) => L(ch) !== U(ch);
const todasMay = (w: string) => [...w].filter(esLetra).every((ch) => ch === U(ch));
const escaparRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Palabras cortas comunes que, en una descripción en mayúsculas, no son siglas
// (solo para las advertencias del script).
const PALABRAS_COMUNES = new Set([
  "a", "al", "con", "de", "del", "el", "en", "la", "las", "lo", "los", "o", "para", "por", "sin", "sobre", "su", "un", "una", "y", "e",
  "tipo", "muro", "losa", "piso", "obra", "mano", "cara", "caras", "dos", "tres", "doble", "simple", "gral", "pie", "pies",
]);

export type ResultadoCapitalizacion = {
  texto: string;
  /** Casos que la regla no pudo resolver con certeza (posibles siglas o marcas no listadas). */
  dudas: string[];
};

/**
 * Aplica la regla y además devuelve las dudas. `siglasDetectadas`: siglas no
 * listadas encontradas en otras descripciones, para avisar cuando aparecen
 * dentro de una descripción en mayúsculas (ahí no se distinguen solas).
 */
export function capitalizarConDudas(desc: string, siglasDetectadas: Set<string> = new Set()): ResultadoCapitalizacion {
  const dudas: string[] = [];
  // "Era toda mayúscula" se mide sin medidas/códigos, unidades ni paréntesis:
  // «VIGA DE FUNDACIÓN (80kg de hierro/m3)» cuenta como toda mayúscula.
  const letrasDesc = desc
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .filter((p) => !/\d/.test(p))
    .flatMap((p) => p.match(/[\p{L}²³]+/gu) ?? [])
    .filter((w) => !UNIDADES.has(L(w)))
    .flatMap((w) => [...w].filter(esLetra));
  const eraTodaMayuscula = letrasDesc.length > 0 && letrasDesc.every((ch) => ch === U(ch));
  let primeraHecha = false;

  const partes = desc.split(/(\s+)/);
  let texto = partes
    .map((parte) => {
      if (parte === "" || /^\s+$/.test(parte)) return parte;
      // Medidas y códigos: cualquier palabra con un dígito queda tal cual.
      if (/\d/.test(parte)) {
        if (!primeraHecha && [...parte].some(esLetra)) primeraHecha = true;
        return parte;
      }
      return parte.replace(/[\p{L}²³]+/gu, (w) => {
        const lw = L(w);
        const uw = U(w);
        let r: string;
        if (SIGLAS.has(uw)) r = uw;
        else if (SIGLAS_TAL_CUAL.has(uw)) r = w;
        else if (UNIDADES.has(lw)) r = lw;
        else if (MARCAS_PALABRA.has(lw)) r = MARCAS_PALABRA.get(lw)!;
        else {
          const letras = [...w].filter(esLetra).length;
          if (/\p{Ll}\p{Lu}/u.test(w)) {
            dudas.push(`«${w}» parece marca (mayúsculas internas)`);
          } else if (!eraTodaMayuscula && letras >= 2 && letras <= 5 && todasMay(w) && !PALABRAS_COMUNES.has(lw)) {
            dudas.push(`«${w}» parece sigla no listada`);
          } else if (eraTodaMayuscula && siglasDetectadas.has(uw)) {
            dudas.push(`«${w}» es sigla en otras descripciones`);
          } else if (primeraHecha && w[0] === U(w[0]) && esLetra(w[0]) && letras >= 3 && !todasMay(w)) {
            dudas.push(`«${w}» parece marca o nombre propio no listado`);
          }
          r = primeraHecha ? lw : U(lw.charAt(0)) + lw.slice(1);
        }
        primeraHecha = true;
        return r;
      });
    })
    .join("");

  // Marcas de varias palabras o con guion, con su forma.
  for (const m of MARCAS_FRASE) {
    texto = texto.replace(new RegExp(`(?<![\\p{L}])${escaparRegExp(m)}(?![\\p{L}])`, "giu"), m);
  }
  // Si una marca quedó al principio, la primera letra ya es la de la marca.
  return { texto, dudas: dudasSinMarcasFrase(dudas) };
}

// Las palabras de una marca de varias palabras ("Steel", "Framing", "Low")
// ya quedan resueltas por la reposición final: no son dudas.
function dudasSinMarcasFrase(dudas: string[]): string[] {
  const palabrasDeFrases = new Set(MARCAS_FRASE.flatMap((m) => m.split(/[^\p{L}]+/u)).map((w) => L(w)));
  return dudas.filter((d) => {
    const w = d.match(/^«(.+?)»/)?.[1];
    return !w || !palabrasDeFrases.has(L(w));
  });
}

/** Descripción con la regla de capitalización (ver comentario del archivo). */
export function capitalizarDescripcion(desc: string): string {
  return capitalizarConDudas(desc).texto;
}
