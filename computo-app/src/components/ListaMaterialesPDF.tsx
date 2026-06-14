import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

/* ─── Tipos ───────────────────────────────────────────────── */
export interface FilaMaterialPDF {
  descripcion: string;
  unidad: string;
  cantidadTotal: number;
  precioUnit?: number;
}

export interface ListaMaterialesPDFProps {
  nombreProyecto: string;
  filas: FilaMaterialPDF[];
  total: number;
}

/* ─── Formato de números ──────────────────────────────────── */
function fmtNum(v: number): string {
  return v
    .toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMon(v: number): string {
  return `$ ${Math.round(v).toLocaleString("es-UY")}`;
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

  // Filas de material
  filaMaterial: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F1F5F9",
  },
  filaMaterialPar: {
    backgroundColor: "#F8FAFC",
  },
  filaMaterialImpar: {
    backgroundColor: "#FFFFFF",
  },

  // Columnas
  colDescripcion: { width: "46%" },
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

  // Total general
  separadorFinal: {
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
    marginTop: 18,
    marginBottom: 8,
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
    color: "#2563EB",
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
      <Text style={[styles.textoEncabezado, styles.colDescripcion]}>Material</Text>
      <Text style={[styles.textoEncabezado, styles.colUnidad]}>Unidad</Text>
      <Text style={[styles.textoEncabezado, styles.colCantidad]}>Cantidad</Text>
      <Text style={[styles.textoEncabezado, styles.colPrecio]}>Precio unit.</Text>
      <Text style={[styles.textoEncabezado, styles.colTotal]}>Total</Text>
    </View>
  );
}

function FilaMaterial({ fila, index }: { fila: FilaMaterialPDF; index: number }) {
  const sinPrecio = fila.precioUnit == null;
  const total = sinPrecio ? 0 : fila.cantidadTotal * (fila.precioUnit as number);
  return (
    <View style={[styles.filaMaterial, index % 2 === 0 ? styles.filaMaterialPar : styles.filaMaterialImpar]} wrap={false}>
      <Text style={[styles.textoCelda, styles.colDescripcion]}>{fila.descripcion || "—"}</Text>
      <Text style={[styles.textoCelda, styles.colUnidad]}>{fila.unidad || "—"}</Text>
      <Text style={[styles.textoCelda, styles.colCantidad]}>{fmtNum(fila.cantidadTotal)}</Text>
      <Text style={[sinPrecio ? styles.textoCeldaMuted : styles.textoCelda, styles.colPrecio]}>
        {sinPrecio ? "—" : fmtMon(fila.precioUnit as number)}
      </Text>
      <Text style={[sinPrecio ? styles.textoCeldaMuted : styles.textoCelda, styles.colTotal]}>
        {sinPrecio ? "—" : fmtMon(total)}
      </Text>
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
export function ListaMaterialesPDF({ nombreProyecto, filas, total }: ListaMaterialesPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.empresaNombre}>CÓMPUTO+</Text>
          <Text style={styles.fecha}>Generado el {fechaHoy()}</Text>
        </View>
        <Text style={styles.tituloProyecto}>Lista de Materiales</Text>
        <Text style={styles.subtitulo}>{nombreProyecto}</Text>
        <View style={styles.separador} />

        {/* Cuerpo */}
        <EncabezadoColumnas />
        {filas.length === 0 ? (
          <View style={styles.filaMaterial}>
            <Text style={styles.textoCeldaMuted}>Sin materiales cargados</Text>
          </View>
        ) : (
          filas.map((f, i) => <FilaMaterial key={`${f.descripcion}||${f.unidad}`} fila={f} index={i} />)
        )}

        {/* Total general */}
        <View style={styles.separadorFinal} />
        <View style={styles.filaTotalGeneral} wrap={false}>
          <Text style={styles.labelTotalGeneral}>Total materiales</Text>
          <Text style={styles.montoTotalGeneral}>{fmtMon(total)}</Text>
        </View>

        <PiePagina nombreProyecto={nombreProyecto} />
      </Page>
    </Document>
  );
}
