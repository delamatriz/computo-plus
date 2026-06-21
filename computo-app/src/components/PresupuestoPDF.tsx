import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

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
  rubros: RubroPDF[];
}

interface EmpresaPDF {
  nombre: string;
}

export interface ProyectoConCapitulos {
  id: string;
  nombre: string;
  cliente: string | null;
  tipo: string;
  area: number | null;
  direccion: string | null;
  moneda: string;
  empresa: EmpresaPDF | null;
  capitulos: CapituloPDF[];
  gastosGenerales: number;
  incluyeIVA: boolean;
  montoImponibleMO: number | null;
}

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
  colNum: { width: "6%" },
  colDescripcion: { width: "40%" },
  colUnidad: { width: "12%", textAlign: "center" },
  colCantidad: { width: "14%", textAlign: "right" },
  colPrecio: { width: "14%", textAlign: "right" },
  colTotal: { width: "14%", textAlign: "right" },

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
    </View>
  );
}

function FilaRubro({ rubro, index, simbolo }: { rubro: RubroPDF; index: number; simbolo: string }) {
  const total = rubro.cantidad * rubro.precioUnit;
  const sinPrecio = !rubro.precioUnit;
  return (
    <View style={[styles.filaRubro, index % 2 === 0 ? styles.filaRubroPar : styles.filaRubroImpar]} wrap={false}>
      <Text style={[styles.textoCelda, styles.colNum]}>{index + 1}</Text>
      <Text style={[styles.textoCelda, styles.colDescripcion]}>{rubro.descripcion || "—"}</Text>
      <Text style={[styles.textoCelda, styles.colUnidad]}>{rubro.unidad || "—"}</Text>
      <Text style={[styles.textoCelda, styles.colCantidad]}>{fmtNum(rubro.cantidad)}</Text>
      <Text style={[sinPrecio ? styles.textoCeldaMuted : styles.textoCelda, styles.colPrecio]}>
        {sinPrecio ? "—" : fmtMon(rubro.precioUnit, simbolo)}
      </Text>
      <Text style={[sinPrecio ? styles.textoCeldaMuted : styles.textoCelda, styles.colTotal]}>
        {sinPrecio ? "—" : fmtMon(total, simbolo)}
      </Text>
    </View>
  );
}

function BloqueCapitulo({
  capitulo,
  esPrimero,
  simbolo,
}: {
  capitulo: CapituloPDF;
  esPrimero: boolean;
  simbolo: string;
}) {
  const subtotal = capitulo.rubros.reduce((acc, r) => acc + r.cantidad * r.precioUnit, 0);
  return (
    <View>
      <View style={styles.filaCapitulo} wrap={false}>
        <Text style={styles.textoCapitulo}>
          {capitulo.codigo} · {capitulo.nombre}
        </Text>
      </View>
      {(esPrimero || true) && <EncabezadoColumnas />}
      {capitulo.rubros.length === 0 ? (
        <View style={styles.filaRubro}>
          <Text style={styles.textoCeldaMuted}>Sin rubros cargados en este capítulo</Text>
        </View>
      ) : (
        capitulo.rubros.map((r, i) => <FilaRubro key={r.id} rubro={r} index={i} simbolo={simbolo} />)
      )}
      <View style={styles.filaSubtotal} wrap={false}>
        <Text style={styles.textoSubtotalLabel}>SUBTOTAL {capitulo.nombre.toUpperCase()}</Text>
        <Text style={styles.textoSubtotalMonto}>{fmtMon(subtotal, simbolo)}</Text>
      </View>
    </View>
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
  const codigoGastosGenerales = String(proyecto.capitulos.length + 1).padStart(2, "0");

  const datosSubtitulo = [
    proyecto.cliente,
    proyecto.tipo,
    proyecto.area ? `${fmtNum(proyecto.area)} m²` : null,
    proyecto.direccion,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.empresaNombre}>{proyecto.empresa?.nombre || "CÓMPUTO+"}</Text>
          <Text style={styles.fecha}>Generado el {fechaHoy()}</Text>
        </View>
        <Text style={styles.tituloProyecto}>{proyecto.nombre}</Text>
        {datosSubtitulo ? <Text style={styles.subtitulo}>{datosSubtitulo}</Text> : null}
        <View style={styles.separador} />

        {/* Cuerpo — capítulos */}
        {proyecto.capitulos.map((cap, i) => (
          <BloqueCapitulo key={cap.id} capitulo={cap} esPrimero={i === 0} simbolo={simbolo} />
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
        </View>

        <PiePagina nombreProyecto={proyecto.nombre} />
      </Page>
    </Document>
  );
}
