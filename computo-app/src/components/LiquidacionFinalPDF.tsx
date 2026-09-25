import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

/* ─── Tipos ───────────────────────────────────────────────── */
export interface AjusteLiquidacionPDF {
  concepto: string;
  monto: number;
  tipo: string; // "Adicional" | "Descuento"
  referenciaVinculo: string | null;
}

export type EstadoCruceCertificacionPDF = "certificado_de_mas" | "falta_certificar" | "coincide";

export interface CruceCertificacionPDF {
  totalCertificado: number;
  diferencia: number;
  estado: EstadoCruceCertificacionPDF;
}

export interface LiquidacionFinalPDFProps {
  empresaNombreHeader: string;
  proyectoNombre: string;
  fechaLiquidacion: string | null; // ISO
  presupuestoOriginal: number;
  ajustes: AjusteLiquidacionPDF[];
  totalLiquidado: number;
  cruceCertificacion: CruceCertificacionPDF | null;
  observaciones: string | null;
  moneda: string;
}

/* ─── Formato ─────────────────────────────────────────────── */
function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

function fechaHoy(): string {
  const d = new Date();
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtMoneda(v: number, moneda: string): string {
  const fmt = Math.round(v).toLocaleString("es-UY");
  return `${moneda === "USD" ? "US$" : "$"} ${fmt}`;
}

/* ─── Estilos (mismo lenguaje visual que ActaCierrePDF) ──────── */
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

  seccionLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  // Presupuesto original
  presupuestoBloque: {
    marginBottom: 16,
    padding: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 4,
  },
  presupuestoValor: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1A3A5C",
  },
  presupuestoNota: {
    fontSize: 7.5,
    color: "#94A3B8",
    marginTop: 2,
  },

  // Tabla de ajustes
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
  filaAjuste: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F1F5F9",
  },
  filaAjustePar: { backgroundColor: "#F8FAFC" },
  filaAjusteImpar: { backgroundColor: "#FFFFFF" },
  colConcepto: { width: "52%" },
  colTipo: { width: "24%" },
  colMonto: { width: "24%", textAlign: "right" },
  textoCelda: { fontSize: 8.5, color: "#334155" },
  textoCeldaMuted: { fontSize: 8.5, color: "#94A3B8" },
  montoAdicional: { fontSize: 8.5, color: "#059669", fontFamily: "Helvetica-Bold" },
  montoDescuento: { fontSize: 8.5, color: "#DC2626", fontFamily: "Helvetica-Bold" },

  // Total liquidado
  separadorFinal: {
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
    marginTop: 18,
    marginBottom: 10,
  },
  filaTotalGeneral: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
    marginBottom: 16,
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

  // Cruce contra Certificaciones
  cruceBloque: {
    marginBottom: 16,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
  },
  cruceCertificadoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cruceCertificadoLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cruceCertificadoValor: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
  },
  cruceMensaje: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  cruceRojo: { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" },
  cruceAmbar: { borderColor: "#FCD34D", backgroundColor: "#FFFBEB" },
  cruceVerde: { borderColor: "#6EE7B7", backgroundColor: "#ECFDF5" },
  textoRojo: { color: "#B91C1C" },
  textoAmbar: { color: "#B45309" },
  textoVerde: { color: "#047857" },

  // Observaciones
  textoBloque: {
    marginBottom: 14,
    padding: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 4,
  },
  textoLibre: {
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
function FilaAjuste({ ajuste, index, moneda }: { ajuste: AjusteLiquidacionPDF; index: number; moneda: string }) {
  const esAdicional = ajuste.tipo === "Adicional";
  return (
    <View style={[styles.filaAjuste, index % 2 === 0 ? styles.filaAjustePar : styles.filaAjusteImpar]} wrap={false}>
      <View style={styles.colConcepto}>
        <Text style={styles.textoCelda}>{ajuste.concepto || "—"}</Text>
        {ajuste.referenciaVinculo && <Text style={styles.textoCeldaMuted}>{ajuste.referenciaVinculo}</Text>}
      </View>
      <Text style={[styles.textoCelda, styles.colTipo]}>{ajuste.tipo}</Text>
      <Text style={[esAdicional ? styles.montoAdicional : styles.montoDescuento, styles.colMonto]}>
        {esAdicional ? "+" : "-"}{fmtMoneda(ajuste.monto, moneda)}
      </Text>
    </View>
  );
}

function BloqueCruceCertificacion({ cruce, moneda }: { cruce: CruceCertificacionPDF; moneda: string }) {
  const estiloBloque =
    cruce.estado === "certificado_de_mas" ? styles.cruceRojo : cruce.estado === "falta_certificar" ? styles.cruceAmbar : styles.cruceVerde;
  const estiloTexto =
    cruce.estado === "certificado_de_mas" ? styles.textoRojo : cruce.estado === "falta_certificar" ? styles.textoAmbar : styles.textoVerde;
  const mensaje =
    cruce.estado === "certificado_de_mas"
      ? `Certificado de más: ${fmtMoneda(Math.abs(cruce.diferencia), moneda)}`
      : cruce.estado === "falta_certificar"
      ? `Falta certificar: ${fmtMoneda(Math.abs(cruce.diferencia), moneda)}`
      : "Liquidación y certificación coinciden";

  return (
    <View style={[styles.cruceBloque, estiloBloque]}>
      <View style={styles.cruceCertificadoRow}>
        <Text style={styles.cruceCertificadoLabel}>Total certificado</Text>
        <Text style={styles.cruceCertificadoValor}>{fmtMoneda(cruce.totalCertificado, moneda)}</Text>
      </View>
      <Text style={[styles.cruceMensaje, estiloTexto]}>{mensaje}</Text>
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
export function LiquidacionFinalPDF({
  empresaNombreHeader,
  proyectoNombre,
  fechaLiquidacion,
  presupuestoOriginal,
  ajustes,
  totalLiquidado,
  cruceCertificacion,
  observaciones,
  moneda,
}: LiquidacionFinalPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.empresaNombre}>{empresaNombreHeader}</Text>
          <Text style={styles.fecha}>Generado el {fechaHoy()}</Text>
        </View>
        <Text style={styles.tituloProyecto}>Liquidación Final de Obra</Text>
        <Text style={styles.subtitulo}>{proyectoNombre}</Text>
        <Text style={styles.subtitulo}>
          Fecha de liquidación: {fechaLiquidacion ? fmtFecha(fechaLiquidacion) : "Sin definir"}
        </Text>
        <View style={styles.separador} />

        {/* Presupuesto original */}
        <View style={styles.presupuestoBloque}>
          <Text style={styles.seccionLabel}>Presupuesto original</Text>
          <Text style={styles.presupuestoValor}>{fmtMoneda(presupuestoOriginal, moneda)}</Text>
          <Text style={styles.presupuestoNota}>Costo Total del presupuesto al momento de liquidar — valor fijo.</Text>
        </View>

        {/* Ajustes */}
        <Text style={styles.seccionLabel}>Ajustes</Text>
        {ajustes.length === 0 ? (
          <View style={styles.textoBloque}>
            <Text style={styles.textoLibre}>Sin ajustes registrados.</Text>
          </View>
        ) : (
          <>
            <View style={styles.filaEncabezado}>
              <Text style={[styles.textoEncabezado, styles.colConcepto]}>Concepto</Text>
              <Text style={[styles.textoEncabezado, styles.colTipo]}>Tipo</Text>
              <Text style={[styles.textoEncabezado, styles.colMonto]}>Monto</Text>
            </View>
            {ajustes.map((a, i) => (
              <FilaAjuste key={i} ajuste={a} index={i} moneda={moneda} />
            ))}
          </>
        )}

        {/* Total liquidado */}
        <View style={styles.separadorFinal} />
        <View style={styles.filaTotalGeneral} wrap={false}>
          <Text style={styles.labelTotalGeneral}>Total liquidado</Text>
          <Text style={styles.montoTotalGeneral}>{fmtMoneda(totalLiquidado, moneda)}</Text>
        </View>

        {/* Cruce contra Certificaciones */}
        {cruceCertificacion && <BloqueCruceCertificacion cruce={cruceCertificacion} moneda={moneda} />}

        {/* Observaciones */}
        {observaciones && (
          <View style={styles.textoBloque}>
            <Text style={styles.seccionLabel}>Observaciones</Text>
            <Text style={styles.textoLibre}>{observaciones}</Text>
          </View>
        )}

        <PiePagina proyectoNombre={proyectoNombre} />
      </Page>
    </Document>
  );
}
