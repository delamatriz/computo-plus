import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

/* ─── Tipos ───────────────────────────────────────────────── */
export interface ItemOrdenCompraPDF {
  descripcion: string;
  unidad: string;
  cantidad: number;
}

export interface OrdenCompraPDFProps {
  membreteTitulo: string;
  numeroOrden: number;
  fecha: string; // ISO
  fechaEsDePedido: boolean;
  proveedor: string;
  proyectoNombre: string;
  estado: string;
  nota: string;
  items: ItemOrdenCompraPDF[];
}

/* ─── Formato ─────────────────────────────────────────────── */
function fmtNum(v: number): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

function fechaHoy(): string {
  const d = new Date();
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* ─── Estilos (mismo lenguaje visual que ListaMaterialesPDF) ─ */
const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1E293B",
  },

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

  // Datos de la orden
  datosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  datoBloque: {
    width: "50%",
    marginBottom: 8,
  },
  datoLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  datoValor: {
    fontSize: 10,
    color: "#1E293B",
    marginTop: 2,
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

  // Filas de ítem
  filaItem: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F1F5F9",
  },
  filaItemPar: {
    backgroundColor: "#F8FAFC",
  },
  filaItemImpar: {
    backgroundColor: "#FFFFFF",
  },

  colDescripcion: { width: "68%" },
  colUnidad: { width: "16%", textAlign: "center" },
  colCantidad: { width: "16%", textAlign: "right" },

  textoCelda: {
    fontSize: 8.5,
    color: "#334155",
  },
  textoCeldaMuted: {
    fontSize: 8.5,
    color: "#94A3B8",
  },

  // Nota / fallback sin ítems
  notaBloque: {
    marginTop: 4,
    padding: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 4,
  },
  notaLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notaTexto: {
    fontSize: 9,
    color: "#334155",
    lineHeight: 1.4,
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
      <Text style={[styles.textoEncabezado, styles.colDescripcion]}>Descripción</Text>
      <Text style={[styles.textoEncabezado, styles.colUnidad]}>Unidad</Text>
      <Text style={[styles.textoEncabezado, styles.colCantidad]}>Cantidad</Text>
    </View>
  );
}

function FilaItem({ item, index }: { item: ItemOrdenCompraPDF; index: number }) {
  return (
    <View style={[styles.filaItem, index % 2 === 0 ? styles.filaItemPar : styles.filaItemImpar]} wrap={false}>
      <Text style={[styles.textoCelda, styles.colDescripcion]}>{item.descripcion || "—"}</Text>
      <Text style={[styles.textoCelda, styles.colUnidad]}>{item.unidad || "—"}</Text>
      <Text style={[styles.textoCelda, styles.colCantidad]}>{fmtNum(item.cantidad)}</Text>
    </View>
  );
}

function PiePagina({ proyectoNombre }: { proyectoNombre: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.textoFooter}>CÓMPUTO+ — Presupuestación de Obra</Text>
      <Text style={styles.textoFooter}>{proyectoNombre}</Text>
      <Text
        style={styles.textoFooter}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}

/* ─── Documento principal ─────────────────────────────────── */
export function OrdenCompraPDF({
  membreteTitulo,
  numeroOrden,
  fecha,
  fechaEsDePedido,
  proveedor,
  proyectoNombre,
  estado,
  nota,
  items,
}: OrdenCompraPDFProps) {
  const sinItems = items.length === 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.empresaNombre}>{membreteTitulo}</Text>
          <Text style={styles.fecha}>Generado el {fechaHoy()}</Text>
        </View>
        <Text style={styles.tituloProyecto}>Orden de Compra N° {numeroOrden}</Text>
        <Text style={styles.subtitulo}>{proyectoNombre}</Text>
        <View style={styles.separador} />

        {/* Datos de la orden */}
        <View style={styles.datosGrid}>
          <View style={styles.datoBloque}>
            <Text style={styles.datoLabel}>Proveedor</Text>
            <Text style={styles.datoValor}>{proveedor || "—"}</Text>
          </View>
          <View style={styles.datoBloque}>
            <Text style={styles.datoLabel}>{fechaEsDePedido ? "Fecha de pedido" : "Fecha de creación"}</Text>
            <Text style={styles.datoValor}>{fmtFecha(fecha)}</Text>
          </View>
          <View style={styles.datoBloque}>
            <Text style={styles.datoLabel}>Obra</Text>
            <Text style={styles.datoValor}>{proyectoNombre}</Text>
          </View>
          <View style={styles.datoBloque}>
            <Text style={styles.datoLabel}>Estado</Text>
            <Text style={styles.datoValor}>{estado}</Text>
          </View>
        </View>

        {/* Ítems */}
        {sinItems ? (
          <View style={styles.notaBloque}>
            <Text style={styles.notaLabel}>Ítems solicitados</Text>
            <Text style={styles.notaTexto}>
              {nota.trim() ? nota : "Sin ítems cargados en esta orden."}
            </Text>
          </View>
        ) : (
          <>
            <EncabezadoColumnas />
            {items.map((it, i) => (
              <FilaItem key={`${it.descripcion}-${i}`} item={it} index={i} />
            ))}
            {nota.trim() && (
              <View style={styles.notaBloque}>
                <Text style={styles.notaLabel}>Nota</Text>
                <Text style={styles.notaTexto}>{nota}</Text>
              </View>
            )}
          </>
        )}

        <PiePagina proyectoNombre={proyectoNombre} />
      </Page>
    </Document>
  );
}
