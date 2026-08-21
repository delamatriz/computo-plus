import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

/* ─── Tipos ───────────────────────────────────────────────── */
interface RubroPDF {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnit: number;
}

interface CapituloPDF {
  id: string;
  nombre: string;
  codigo: string;
  tituloId: string | null;
  rubros: RubroPDF[];
}

// Título — agrupador opcional de capítulos (ver model Titulo en
// schema.prisma). El código "N.M" que se imprime en el PDF se calcula acá
// en el render (BloqueTitulo/BloqueCapitulo), nunca sale de un campo
// guardado — mismo criterio que ya regía para capitulo.codigo, que hoy es
// básicamente basura sin uso real (nunca lo completa el formulario de
// "Agregar capítulo") y se ignora a propósito.
interface TituloPDF {
  id: string;
  nombre: string;
  color: string;
}

interface EmpresaPDF {
  nombre: string;
  rut: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  web: string | null;
  logo: string | null;
}

export interface ProyectoConCapitulos {
  id: string;
  nombre: string;
  subtitulo: string | null;
  cliente: string | null;
  tipo: string;
  area: number | null;
  direccion: string | null;
  moneda: string;
  empresa: EmpresaPDF | null;
  titulos: TituloPDF[];
  capitulos: CapituloPDF[];
  gastosGenerales: number;
  incluyeIVA: boolean;
  montoImponibleMO: number | null;
  fechaInicio?: string | Date | null;
  plazoObra?: number | null;
  diasLaborales?: number | null;
  garantiaFielCumplimiento?: string | null;
  garantiaViciosOcultos?: string | null;
  garantiaResponsabilidad?: string | null;
}

export const TEXTO_LEGAL_RESPONSABILIDAD_DEFAULT =
  "Conforme al artículo 1844 del Código Civil (Ley 19.726): 10 años por defectos estructurales, " +
  "5 años por vicios de menor entidad y 2 años por defectos de terminación y acabado, contados " +
  "desde la recepción de la obra.";

/* ─── Formato de números ──────────────────────────────────── */
function fmtNum(v: number): string {
  return Math.round(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function fmtMon(v: number, simbolo: string): string {
  if (!v) return "—";
  return `${simbolo} ${fmtNum(v)}`;
}

/** Precio unitario: 2 decimales fijos, separador de miles (.) y decimales (,) */
function fmtNumDecimal(v: number): string {
  const [entero, decimales] = v.toFixed(2).split(".");
  return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimales}`;
}

/** Cantidad: hasta 2 decimales sin ceros de más (2.5 -> "2,5", 600 -> "600") — a diferencia de
 *  fmtNum, no redondea al entero, para no perder la cantidad real cargada en el rubro. */
function fmtNumCantidad(v: number): string {
  const redondeado = Math.round(v * 100) / 100;
  const [entero, decimales] = redondeado.toString().split(".");
  const enteroConMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimales ? `${enteroConMiles},${decimales}` : enteroConMiles;
}

function fmtMonDecimal(v: number, simbolo: string): string {
  if (!v) return "—";
  return `${simbolo} ${fmtNumDecimal(v)}`;
}

/** % de incidencia de un monto sobre el subtotal de obra — "—" si el subtotal es 0 (evita división por cero) */
function fmtPctIncidencia(monto: number, subtotalObra: number): string {
  if (subtotalObra <= 0) return "—";
  const [entero, decimal] = ((monto / subtotalObra) * 100).toFixed(1).split(".");
  return `${entero},${decimal}%`;
}

/** Igual que fmtMon pero sin el fallback "—" — para líneas de totales/resumen
 *  donde un monto en cero es un valor real (ej. Gastos Generales sin cargar). */
function fmtMonTotal(v: number, simbolo: string): string {
  return `${simbolo} ${fmtNum(v)}`;
}

function simboloMoneda(moneda: string): string {
  return moneda === "USD" ? "U$S" : "$";
}

function fechaHoy(): string {
  const d = new Date();
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtFecha(valor: string | Date | null | undefined): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* ─── Estilos ─────────────────────────────────────────────── */
const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1E293B",
  },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  empresaNombre: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1A3A5C",
  },
  fecha: {
    fontSize: 8,
    color: "#94A3B8",
  },
  tituloProyecto: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#1A3A5C",
    marginTop: 8,
  },
  subtitulo: {
    fontSize: 9,
    color: "#64748B",
    marginTop: 3,
  },
  separador: {
    borderBottomWidth: 2,
    borderBottomColor: "#2563EB",
    marginTop: 12,
    marginBottom: 16,
  },

  // Título — más peso visual que un capítulo (fondo más oscuro, texto más
  // grande, franja de color a la izquierda con titulo.color) para que se
  // note de un vistazo que agrupa varios capítulos.
  filaTitulo: {
    flexDirection: "row",
    backgroundColor: "#0F2942",
    paddingVertical: 7,
    paddingHorizontal: 8,
    marginTop: 16,
    borderLeftWidth: 4,
  },
  textoTitulo: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  filaSubtotalTitulo: {
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: "#E2E8F0",
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  textoSubtotalTituloLabel: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#1A3A5C",
    marginRight: 12,
  },
  textoSubtotalTituloMonto: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#1A3A5C",
  },

  // Capítulo
  filaCapitulo: {
    flexDirection: "row",
    backgroundColor: "#1A3A5C",
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginTop: 12,
  },
  textoCapitulo: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  // Encabezado de columnas
  filaEncabezado: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  textoEncabezado: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Filas de rubro
  filaRubro: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F1F5F9",
  },
  filaRubroPar: {
    backgroundColor: "#F8FAFC",
  },
  filaRubroImpar: {
    backgroundColor: "#FFFFFF",
  },

  // Subtotal
  filaSubtotal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: "#F0F4F8",
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  textoSubtotalLabel: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#1A3A5C",
    marginRight: 12,
  },
  textoSubtotalMonto: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#1A3A5C",
  },

  // Columnas
  colNum: { width: "5%" },
  colDescripcion: { width: "33%" },
  colUnidad: { width: "10%", textAlign: "center" },
  colCantidad: { width: "13%", textAlign: "right" },
  colPrecio: { width: "13%", textAlign: "right" },
  colTotal: { width: "13%", textAlign: "right" },
  colIncidencia: { width: "13%", textAlign: "right" },

  textoCelda: {
    fontSize: 8.5,
    color: "#334155",
  },
  textoCeldaMuted: {
    fontSize: 8.5,
    color: "#94A3B8",
  },

  // Capítulo de Gastos Generales — mismo estilo de header que un capítulo de obra,
  // pero de una sola línea (sin tabla de rubros ni desglose interno).
  filaGastosGenerales: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1A3A5C",
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginTop: 12,
  },
  montoGastosGenerales: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },

  // Líneas finales — subtotal, gastos generales, IVA, leyes sociales, total
  bloqueFinal: {
    marginTop: 14,
  },
  separadorFinal: {
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
    marginTop: 10,
    marginBottom: 10,
  },
  filaResumenLinea: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  labelResumenLinea: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#1A3A5C",
  },
  montoResumenLinea: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#1A3A5C",
  },
  separadorTotal: {
    borderBottomWidth: 2,
    borderBottomColor: "#1A3A5C",
    marginTop: 10,
    marginBottom: 10,
  },
  filaTotalGeneral: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  labelTotalGeneral: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1A3A5C",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  montoTotalGeneral: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#1A3A5C",
  },

  // Plazo de obra
  filaPlazo: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  labelPlazo: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#64748B",
  },
  montoPlazo: {
    fontSize: 8.5,
    color: "#334155",
  },

  // Garantías
  bloqueGarantias: {
    marginTop: 18,
  },
  separadorGarantias: {
    borderTopWidth: 0.5,
    borderTopColor: "#CBD5E1",
    marginBottom: 10,
  },
  tituloGarantias: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1A3A5C",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  itemGarantia: {
    marginBottom: 8,
  },
  labelGarantia: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#64748B",
    marginBottom: 2,
  },
  textoGarantia: {
    fontSize: 8,
    color: "#475569",
    lineHeight: 1.4,
  },

  // Portada
  portadaPage: {
    paddingTop: 80,
    paddingHorizontal: 64,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1E293B",
    justifyContent: "flex-start",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#E2E8F0",
    paddingTop: 6,
  },
  textoFooter: {
    fontSize: 7.5,
    color: "#94A3B8",
  },
});

/* ─── Sub-componentes ─────────────────────────────────────── */
function EncabezadoColumnas() {
  return (
    <View style={styles.filaEncabezado}>
      <Text style={[styles.textoEncabezado, styles.colNum]}>#</Text>
      <Text style={[styles.textoEncabezado, styles.colDescripcion]}>Descripción</Text>
      <Text style={[styles.textoEncabezado, styles.colUnidad]}>Unidad</Text>
      <Text style={[styles.textoEncabezado, styles.colCantidad]}>Cantidad</Text>
      <Text style={[styles.textoEncabezado, styles.colPrecio]}>Precio unit.</Text>
      <Text style={[styles.textoEncabezado, styles.colTotal]}>Total</Text>
      <Text style={[styles.textoEncabezado, styles.colIncidencia]}>% Incid.</Text>
    </View>
  );
}

function FilaRubro({
  rubro,
  index,
  simbolo,
  subtotalObra,
}: {
  rubro: RubroPDF;
  index: number;
  simbolo: string;
  subtotalObra: number;
}) {
  const total = rubro.cantidad * rubro.precioUnit;
  const sinPrecio = !rubro.precioUnit;
  return (
    <View style={[styles.filaRubro, index % 2 === 0 ? styles.filaRubroPar : styles.filaRubroImpar]} wrap={false}>
      <Text style={[styles.textoCelda, styles.colNum]}>{index + 1}</Text>
      <Text style={[styles.textoCelda, styles.colDescripcion]}>{rubro.descripcion || "—"}</Text>
      <Text style={[styles.textoCelda, styles.colUnidad]}>{rubro.unidad || "—"}</Text>
      <Text style={[styles.textoCelda, styles.colCantidad]}>{fmtNumCantidad(rubro.cantidad)}</Text>
      <Text style={[sinPrecio ? styles.textoCeldaMuted : styles.textoCelda, styles.colPrecio]}>
        {sinPrecio ? "—" : fmtMonDecimal(rubro.precioUnit, simbolo)}
      </Text>
      <Text style={[sinPrecio ? styles.textoCeldaMuted : styles.textoCelda, styles.colTotal]}>
        {sinPrecio ? "—" : fmtMon(total, simbolo)}
      </Text>
      <Text style={[sinPrecio ? styles.textoCeldaMuted : styles.textoCelda, styles.colIncidencia]}>
        {sinPrecio ? "—" : fmtPctIncidencia(total, subtotalObra)}
      </Text>
    </View>
  );
}

function BloqueCapitulo({
  capitulo,
  codigo,
  simbolo,
  subtotalObra,
}: {
  capitulo: CapituloPDF;
  codigo: string;
  simbolo: string;
  subtotalObra: number;
}) {
  const subtotal = capitulo.rubros.reduce((acc, r) => acc + r.cantidad * r.precioUnit, 0);
  return (
    <View>
      <View style={styles.filaCapitulo} wrap={false}>
        <Text style={styles.textoCapitulo}>
          {codigo} · {capitulo.nombre}
        </Text>
      </View>
      <EncabezadoColumnas />
      {capitulo.rubros.length === 0 ? (
        <View style={styles.filaRubro}>
          <Text style={styles.textoCeldaMuted}>Sin rubros cargados en este capítulo</Text>
        </View>
      ) : (
        capitulo.rubros.map((r, i) => (
          <FilaRubro key={r.id} rubro={r} index={i} simbolo={simbolo} subtotalObra={subtotalObra} />
        ))
      )}
      <View style={styles.filaSubtotal} wrap={false}>
        <Text style={styles.textoSubtotalLabel}>SUBTOTAL {capitulo.nombre.toUpperCase()}</Text>
        <Text style={styles.textoSubtotalMonto}>{fmtMon(subtotal, simbolo)}</Text>
        <Text style={[styles.textoSubtotalMonto, { width: 50, marginLeft: 12, textAlign: "right" }]}>
          {fmtPctIncidencia(subtotal, subtotalObra)}
        </Text>
      </View>
    </View>
  );
}

// Envuelve varios BloqueCapitulo bajo un mismo título — el código de cada
// capítulo hijo se calcula acá ("N.M", título N / capítulo M dentro de ese
// título), no viene de la base. El subtotal del título es la suma de sus
// capítulos únicamente (Total General del proyecto no cambia: sigue
// sumando TODOS los capítulos, tengan título o no — ver subtotalObra en
// PresupuestoPDF más abajo).
function BloqueTitulo({
  titulo,
  numero,
  capitulos,
  simbolo,
  subtotalObra,
}: {
  titulo: TituloPDF;
  numero: number;
  capitulos: CapituloPDF[];
  simbolo: string;
  subtotalObra: number;
}) {
  const subtotalTitulo = capitulos.reduce(
    (acc, cap) => acc + cap.rubros.reduce((a, r) => a + r.cantidad * r.precioUnit, 0),
    0
  );
  return (
    <View>
      <View style={[styles.filaTitulo, { borderLeftColor: titulo.color }]} wrap={false}>
        <Text style={styles.textoTitulo}>
          {numero} · {titulo.nombre}
        </Text>
      </View>
      {capitulos.map((cap, cIdx) => (
        <BloqueCapitulo
          key={cap.id}
          capitulo={cap}
          codigo={`${numero}.${cIdx + 1}`}
          simbolo={simbolo}
          subtotalObra={subtotalObra}
        />
      ))}
      <View style={styles.filaSubtotalTitulo} wrap={false}>
        <Text style={styles.textoSubtotalTituloLabel}>SUBTOTAL TÍTULO {numero}</Text>
        <Text style={styles.textoSubtotalTituloMonto}>{fmtMon(subtotalTitulo, simbolo)}</Text>
        <Text style={[styles.textoSubtotalTituloMonto, { width: 50, marginLeft: 12, textAlign: "right" }]}>
          {fmtPctIncidencia(subtotalTitulo, subtotalObra)}
        </Text>
      </View>
    </View>
  );
}

const TIPO_OBRA_LABELS: Record<string, string> = {
  REPARACIONES: "Reparaciones",
  REFORMA: "Reforma / Ampliación",
  VIVIENDA: "Vivienda unifamiliar",
  PH: "Propiedad Horizontal",
  COMERCIAL: "Local comercial",
  INDUSTRIAL: "Industrial",
};

function labelTipoObra(tipo: string): string {
  return TIPO_OBRA_LABELS[tipo] || tipo;
}

function LabelSeccionPortada({ texto }: { texto: string }) {
  return (
    <Text style={{ fontSize: 8, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 9 }}>
      {texto}
    </Text>
  );
}

function SeparadorFinoPortada() {
  return <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#CBD5E1", marginTop: 18, marginBottom: 18 }} />;
}

function FilaDatoObra({ label, valor }: { label: string; valor: string | null | undefined }) {
  if (!valor) return null;
  return (
    <View style={{ flexDirection: "row", marginBottom: 8 }}>
      <Text style={{ fontSize: 9, color: "#94A3B8", width: 120 }}>{label}</Text>
      <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1E293B", flex: 1 }}>{valor}</Text>
    </View>
  );
}

function Portada({ proyecto }: { proyecto: ProyectoConCapitulos }) {
  const empresa = proyecto.empresa;
  const datosContacto = empresa
    ? [empresa.direccion, empresa.telefono, empresa.email, empresa.web].filter(Boolean).join("  ·  ")
    : "";
  const fechaInicio = fmtFecha(proyecto.fechaInicio);
  const hayPlazo = proyecto.plazoObra != null || proyecto.diasLaborales != null;

  return (
    <Page size="A4" style={styles.portadaPage}>
      {empresa && (
        <View style={{ alignItems: "center" }}>
          {empresa.logo ? (
            <Image
              style={{ maxWidth: 120, maxHeight: 60, objectFit: "contain", marginTop: 40, marginBottom: 10 }}
              src={empresa.logo}
            />
          ) : (
            <View style={{ marginTop: 40 }} />
          )}
          <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: "#1A3A5C", textAlign: "center" }}>
            {empresa.nombre}
          </Text>
          {empresa.rut ? (
            <Text style={{ fontSize: 10, color: "#64748B", textAlign: "center", marginTop: 4 }}>
              RUT: {empresa.rut}
            </Text>
          ) : null}
          {datosContacto ? (
            <Text style={{ fontSize: 9, color: "#94A3B8", textAlign: "center", marginTop: 4 }}>
              {datosContacto}
            </Text>
          ) : null}
        </View>
      )}

      <View style={{ borderBottomWidth: 2, borderBottomColor: "#1A3A5C", marginTop: 16, marginBottom: 16 }} />

      <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: "#1A3A5C", textAlign: "center" }}>
        PRESUPUESTO DE OBRA
      </Text>

      <SeparadorFinoPortada />

      <View>
        <LabelSeccionPortada texto="Proyecto" />
        <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: "#1E293B" }}>
          {proyecto.nombre}
        </Text>
        {proyecto.subtitulo ? (
          <Text style={{ fontSize: 11, fontFamily: "Helvetica-Oblique", color: "#64748B", marginTop: 4 }}>
            {proyecto.subtitulo}
          </Text>
        ) : null}
      </View>

      <SeparadorFinoPortada />

      <View>
        <LabelSeccionPortada texto="Datos de la obra" />
        <FilaDatoObra label="Cliente" valor={proyecto.cliente} />
        <FilaDatoObra label="Tipo de obra" valor={labelTipoObra(proyecto.tipo)} />
        <FilaDatoObra label="Ubicación" valor={proyecto.direccion} />
        <FilaDatoObra label="Fecha de inicio" valor={fechaInicio} />
      </View>

      <SeparadorFinoPortada />

      <View>
        <FilaDatoObra label="Fecha de emisión" valor={fechaHoy()} />
        {hayPlazo && (
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            <Text style={{ fontSize: 9, color: "#94A3B8", width: 120 }}>Plazo de ejecución</Text>
            <View style={{ flex: 1 }}>
              {proyecto.plazoObra != null && (
                <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1E293B" }}>
                  {fmtNum(proyecto.plazoObra)} días corridos
                </Text>
              )}
              {proyecto.diasLaborales != null && (
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: "Helvetica-Bold",
                    color: "#1E293B",
                    marginTop: proyecto.plazoObra != null ? 2 : 0,
                  }}
                >
                  {fmtNum(proyecto.diasLaborales)} días laborales
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    </Page>
  );
}

function PiePagina({ nombreProyecto }: { nombreProyecto: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.textoFooter}>CÓMPUTO+ — Presupuestación de Obra</Text>
      <Text style={styles.textoFooter}>{nombreProyecto}</Text>
      <Text
        style={styles.textoFooter}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}

/* ─── Documento principal ─────────────────────────────────── */
export function PresupuestoPDF({ proyecto }: { proyecto: ProyectoConCapitulos }) {
  const simbolo = simboloMoneda(proyecto.moneda);
  const subtotalObra = proyecto.capitulos.reduce(
    (acc, cap) => acc + cap.rubros.reduce((a, r) => a + r.cantidad * r.precioUnit, 0),
    0
  );
  const subtotal = subtotalObra + proyecto.gastosGenerales;
  const montoIVA = subtotal * 0.22;
  const leyesSocialesPropietario = proyecto.montoImponibleMO != null ? proyecto.montoImponibleMO * 0.714 : null;
  const totalGeneral = subtotal + montoIVA + (leyesSocialesPropietario ?? 0);

  // Un título vacío (sin capítulos asignados) no imprime bloque ni consume
  // numeración — los números de título siempre reflejan lo que realmente
  // se ve en el PDF, recalculados en cada regeneración.
  const titulosConCapitulos = proyecto.titulos
    .map((titulo) => ({ titulo, capitulos: proyecto.capitulos.filter((c) => c.tituloId === titulo.id) }))
    .filter((t) => t.capitulos.length > 0);
  const capitulosSueltos = proyecto.capitulos.filter((c) => c.tituloId == null);

  // Gastos Generales es un bloque más al mismo nivel que un Título o un
  // capítulo suelto — su código es el próximo número de bloque, sin
  // importar la mezcla de títulos y capítulos sueltos que haya.
  const codigoGastosGenerales = String(titulosConCapitulos.length + capitulosSueltos.length + 1).padStart(2, "0");

  const datosSubtitulo = [proyecto.cliente, proyecto.tipo, proyecto.direccion]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Document>
      <Portada proyecto={proyecto} />

      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.empresaNombre}>{proyecto.empresa?.nombre || "CÓMPUTO+"}</Text>
          <Text style={styles.fecha}>Generado el {fechaHoy()}</Text>
        </View>
        <View style={{ flexDirection: "column", flex: 1 }}>
          <Text style={styles.tituloProyecto}>{proyecto.nombre}</Text>
          {proyecto.subtitulo ? (
            <Text style={{ fontSize: 10, color: "#64748B", marginTop: 6 }}>{proyecto.subtitulo}</Text>
          ) : null}
        </View>
        {datosSubtitulo ? <Text style={styles.subtitulo}>{datosSubtitulo}</Text> : null}
        <View style={styles.separador} />

        {/* Cuerpo — títulos (con sus capítulos anidados, numerados N.M) seguidos
            de los capítulos sueltos sin título, numerados 01, 02... como siempre */}
        {titulosConCapitulos.map(({ titulo, capitulos }, tIdx) => (
          <BloqueTitulo
            key={titulo.id}
            titulo={titulo}
            numero={tIdx + 1}
            capitulos={capitulos}
            simbolo={simbolo}
            subtotalObra={subtotalObra}
          />
        ))}
        {capitulosSueltos.map((cap, i) => (
          <BloqueCapitulo
            key={cap.id}
            capitulo={cap}
            codigo={String(i + 1).padStart(2, "0")}
            simbolo={simbolo}
            subtotalObra={subtotalObra}
          />
        ))}

        {/* Subtotal de obra, antes de sumar Gastos Generales */}
        <View style={styles.bloqueFinal} wrap={false}>
          <View style={styles.separadorFinal} />
          <View style={styles.filaResumenLinea}>
            <Text style={styles.labelResumenLinea}>Subtotal</Text>
            <Text style={styles.montoResumenLinea}>{fmtMonTotal(subtotalObra, simbolo)}</Text>
          </View>
        </View>

        {/* Capítulo de Gastos Generales — una sola línea, sin desglose interno */}
        <View style={styles.filaGastosGenerales} wrap={false}>
          <Text style={styles.textoCapitulo}>
            {codigoGastosGenerales} · GASTOS GENERALES
          </Text>
          <Text style={styles.montoGastosGenerales}>{fmtMonTotal(proyecto.gastosGenerales, simbolo)}</Text>
        </View>

        {/* Líneas finales — SUBTOTAL (obra + GG), IVA, leyes sociales, total */}
        <View style={styles.bloqueFinal} wrap={false}>
          <View style={styles.separadorFinal} />
          <View style={styles.filaResumenLinea}>
            <Text style={styles.labelResumenLinea}>SUBTOTAL</Text>
            <Text style={styles.montoResumenLinea}>{fmtMonTotal(subtotal, simbolo)}</Text>
          </View>

          <View style={styles.filaResumenLinea}>
            <Text style={styles.labelResumenLinea}>IVA (22%)</Text>
            <Text style={styles.montoResumenLinea}>{fmtMonTotal(montoIVA, simbolo)}</Text>
          </View>

          {leyesSocialesPropietario != null && (
            <View style={styles.filaResumenLinea}>
              <Text style={styles.labelResumenLinea}>Leyes sociales — Aporte propietario</Text>
              <Text style={styles.montoResumenLinea}>{fmtMonTotal(leyesSocialesPropietario, simbolo)}</Text>
            </View>
          )}

          <View style={styles.separadorTotal} />
          <View style={styles.filaTotalGeneral}>
            <Text style={styles.labelTotalGeneral}>Total presupuesto</Text>
            <Text style={styles.montoTotalGeneral}>{fmtMonTotal(totalGeneral, simbolo)}</Text>
          </View>

          {proyecto.diasLaborales != null && (
            <View style={styles.filaPlazo}>
              <Text style={styles.labelPlazo}>Plazo de obra</Text>
              <Text style={styles.montoPlazo}>
                {proyecto.plazoObra != null ? `${fmtNum(proyecto.plazoObra)} días corridos / ` : ""}
                {fmtNum(proyecto.diasLaborales)} días laborales
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bloqueGarantias} wrap={false}>
          <View style={styles.separadorGarantias} />
          <Text style={styles.tituloGarantias}>Garantías</Text>

          {proyecto.garantiaFielCumplimiento ? (
            <View style={styles.itemGarantia}>
              <Text style={styles.labelGarantia}>Garantía de fiel cumplimiento</Text>
              <Text style={styles.textoGarantia}>{proyecto.garantiaFielCumplimiento}</Text>
            </View>
          ) : null}

          {proyecto.garantiaViciosOcultos ? (
            <View style={styles.itemGarantia}>
              <Text style={styles.labelGarantia}>Garantía por vicios ocultos</Text>
              <Text style={styles.textoGarantia}>{proyecto.garantiaViciosOcultos}</Text>
            </View>
          ) : null}

          <View style={styles.itemGarantia}>
            <Text style={styles.labelGarantia}>
              Responsabilidad por defectos de construcción (Art. 1844)
            </Text>
            <Text style={styles.textoGarantia}>
              {proyecto.garantiaResponsabilidad || TEXTO_LEGAL_RESPONSABILIDAD_DEFAULT}
            </Text>
          </View>
        </View>

        <PiePagina nombreProyecto={proyecto.nombre} />
      </Page>
    </Document>
  );
}
