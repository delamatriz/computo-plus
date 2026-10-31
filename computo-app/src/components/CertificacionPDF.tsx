import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { fechaUruguay } from "@/lib/fechaUruguay";

// Certificado de avance de obra — el documento que se le presenta al
// comitente para cobrar. Mismos números que la tabla de
// SeccionCertificaciones.tsx: importe = % × cantidad × precio unitario del
// rubro, con el % de cada certificación INCREMENTAL (el acumulado es la
// suma de las certificaciones anteriores + esta). Ver también
// lib/totalCertificadoAgregado.ts.

/* ─── Tipos ───────────────────────────────────────────────── */
export interface RubroCertificacionPDF {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnit: number;
  pctAnterior: number; // acumulado de certificaciones anteriores
  pctEsta: number; // aporte de esta certificación
}

export interface CapituloCertificacionPDF {
  codigo: string;
  nombre: string;
  rubros: RubroCertificacionPDF[];
}

export interface CertificacionPDFProps {
  empresaNombre: string;
  proyectoNombre: string;
  comitente: string | null;
  direccion: string | null;
  numero: number;
  nombre: string;
  fecha: string; // ISO, fecha "solo día"
  observaciones: string;
  capitulos: CapituloCertificacionPDF[];
  moneda: string;
}

/* ─── Formato ─────────────────────────────────────────────── */
function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
}

function fmtMoneda(v: number, moneda: string): string {
  const fmt = Math.round(v).toLocaleString("es-UY");
  return `${moneda === "USD" ? "US$" : "$"} ${fmt}`;
}

function fmtNum(v: number, decimales = 2): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

function fmtPct(v: number): string {
  if (v === 0) return "—";
  return `${fmtNum(v, 1)}%`;
}

const importe = (r: RubroCertificacionPDF) => r.cantidad * r.precioUnit;

/* ─── Estilos (mismo lenguaje visual que LiquidacionFinalPDF) ── */
const AZUL = "#1A3A5C";
const ACENTO = "#2563EB";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#1E293B",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  empresaNombre: { fontSize: 10, fontFamily: "Helvetica-Bold", color: AZUL },
  generado: { fontSize: 7.5, color: "#94A3B8" },
  titulo: { fontSize: 17, fontFamily: "Helvetica-Bold", color: AZUL, marginTop: 10 },
  subtitulo: { fontSize: 9, color: "#64748B", marginTop: 3 },
  separador: { borderBottomWidth: 2, borderBottomColor: ACENTO, marginTop: 10, marginBottom: 12 },

  datosRow: { flexDirection: "row", marginBottom: 12 },
  datoCol: { flex: 1, paddingRight: 10 },
  datoLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  datoValor: { fontSize: 9, color: "#334155" },

  resumenRow: { flexDirection: "row", marginBottom: 14 },
  resumenCelda: {
    flex: 1,
    padding: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 4,
    marginRight: 6,
  },
  resumenCeldaUltima: { marginRight: 0 },
  resumenCeldaDestacada: { backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE" },
  resumenValor: { fontSize: 11, fontFamily: "Helvetica-Bold", color: AZUL, marginTop: 2 },
  resumenValorDestacado: { color: ACENTO },
  resumenNota: { fontSize: 7, color: "#94A3B8", marginTop: 1 },

  // Tabla
  filaEncabezado: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: AZUL,
  },
  textoEncabezado: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: "#FFFFFF", textTransform: "uppercase" },
  filaCapitulo: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: "#F0F4F8",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CBD5E1",
  },
  textoCapitulo: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: AZUL },
  filaRubro: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F1F5F9",
  },
  textoCelda: { fontSize: 7.5, color: "#334155" },
  textoCeldaMuted: { fontSize: 7.5, color: "#94A3B8" },
  textoCeldaFuerte: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: ACENTO },

  colCodigo: { width: "6%" },
  colRubro: { width: "28%", paddingRight: 4 },
  colUnidad: { width: "5%", textAlign: "center" },
  colCant: { width: "8%", textAlign: "right" },
  colPU: { width: "9%", textAlign: "right" },
  colImporte: { width: "10%", textAlign: "right" },
  colPctAnt: { width: "7%", textAlign: "right" },
  colPctEsta: { width: "7%", textAlign: "right" },
  colPctAcum: { width: "8%", textAlign: "right" },
  colEsta: { width: "12%", textAlign: "right" },

  // Totales
  totalesBloque: { marginTop: 10, marginLeft: "50%", borderTopWidth: 1, borderTopColor: "#CBD5E1", paddingTop: 6 },
  totalFila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalLabel: { fontSize: 8.5, color: "#64748B" },
  totalValor: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#334155" },
  totalFilaFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: AZUL,
  },
  totalLabelFinal: { fontSize: 10, fontFamily: "Helvetica-Bold", color: AZUL, textTransform: "uppercase" },
  totalValorFinal: { fontSize: 12, fontFamily: "Helvetica-Bold", color: ACENTO },
  notaIva: { fontSize: 7, color: "#94A3B8", marginTop: 4, textAlign: "right" },

  textoBloque: { marginTop: 14, padding: 8, backgroundColor: "#F8FAFC", borderRadius: 4 },
  textoLibre: { fontSize: 8.5, color: "#334155", lineHeight: 1.4 },

  // Firmas
  firmasRow: { flexDirection: "row", marginTop: 48 },
  firma: { flex: 1, marginHorizontal: 14, alignItems: "center" },
  firmaLinea: { width: "100%", borderTopWidth: 0.75, borderTopColor: "#475569", marginBottom: 4 },
  firmaRol: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#334155" },
  firmaAclaracion: { fontSize: 7, color: "#94A3B8", marginTop: 2 },

  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#E2E8F0",
    paddingTop: 6,
  },
  textoFooter: { fontSize: 7, color: "#94A3B8" },
});

/* ─── Sub-componentes ─────────────────────────────────────── */
function Encabezado() {
  return (
    <View style={styles.filaEncabezado} fixed>
      <Text style={[styles.textoEncabezado, styles.colCodigo]}>Cód.</Text>
      <Text style={[styles.textoEncabezado, styles.colRubro]}>Rubro</Text>
      <Text style={[styles.textoEncabezado, styles.colUnidad]}>Ud.</Text>
      <Text style={[styles.textoEncabezado, styles.colCant]}>Cantidad</Text>
      <Text style={[styles.textoEncabezado, styles.colPU]}>P. unit.</Text>
      <Text style={[styles.textoEncabezado, styles.colImporte]}>Importe</Text>
      <Text style={[styles.textoEncabezado, styles.colPctAnt]}>% ant.</Text>
      <Text style={[styles.textoEncabezado, styles.colPctEsta]}>% esta</Text>
      <Text style={[styles.textoEncabezado, styles.colPctAcum]}>% acum.</Text>
      <Text style={[styles.textoEncabezado, styles.colEsta]}>Esta cert.</Text>
    </View>
  );
}

function FilaRubro({ r, moneda }: { r: RubroCertificacionPDF; moneda: string }) {
  const pctAcum = Math.min(100, r.pctAnterior + r.pctEsta);
  const montoEsta = (r.pctEsta / 100) * importe(r);
  return (
    <View style={styles.filaRubro} wrap={false}>
      <Text style={[styles.textoCeldaMuted, styles.colCodigo]}>{r.codigo}</Text>
      <Text style={[styles.textoCelda, styles.colRubro]}>{r.descripcion}</Text>
      <Text style={[styles.textoCeldaMuted, styles.colUnidad]}>{r.unidad}</Text>
      <Text style={[styles.textoCelda, styles.colCant]}>{fmtNum(r.cantidad)}</Text>
      <Text style={[styles.textoCelda, styles.colPU]}>{fmtMoneda(r.precioUnit, moneda)}</Text>
      <Text style={[styles.textoCelda, styles.colImporte]}>{fmtMoneda(importe(r), moneda)}</Text>
      <Text style={[styles.textoCeldaMuted, styles.colPctAnt]}>{fmtPct(r.pctAnterior)}</Text>
      <Text style={[r.pctEsta > 0 ? styles.textoCeldaFuerte : styles.textoCeldaMuted, styles.colPctEsta]}>
        {fmtPct(r.pctEsta)}
      </Text>
      <Text style={[styles.textoCelda, styles.colPctAcum]}>{fmtPct(pctAcum)}</Text>
      <Text style={[montoEsta > 0 ? styles.textoCeldaFuerte : styles.textoCeldaMuted, styles.colEsta]}>
        {montoEsta > 0 ? fmtMoneda(montoEsta, moneda) : "—"}
      </Text>
    </View>
  );
}

function ResumenCelda({
  label,
  valor,
  nota,
  destacada,
  ultima,
}: {
  label: string;
  valor: string;
  nota?: string;
  destacada?: boolean;
  ultima?: boolean;
}) {
  return (
    <View
      style={[styles.resumenCelda, destacada ? styles.resumenCeldaDestacada : {}, ultima ? styles.resumenCeldaUltima : {}]}
    >
      <Text style={styles.datoLabel}>{label}</Text>
      <Text style={[styles.resumenValor, destacada ? styles.resumenValorDestacado : {}]}>{valor}</Text>
      {nota && <Text style={styles.resumenNota}>{nota}</Text>}
    </View>
  );
}

/* ─── Documento principal ─────────────────────────────────── */
export function CertificacionPDF({
  empresaNombre,
  proyectoNombre,
  comitente,
  direccion,
  numero,
  nombre,
  fecha,
  observaciones,
  capitulos,
  moneda,
}: CertificacionPDFProps) {
  const rubros = capitulos.flatMap((c) => c.rubros);
  const montoContrato = rubros.reduce((s, r) => s + importe(r), 0);
  const montoAnterior = rubros.reduce((s, r) => s + (r.pctAnterior / 100) * importe(r), 0);
  const montoEsta = rubros.reduce((s, r) => s + (r.pctEsta / 100) * importe(r), 0);
  const montoAcumulado = rubros.reduce(
    (s, r) => s + (Math.min(100, r.pctAnterior + r.pctEsta) / 100) * importe(r),
    0
  );
  const pct = (v: number) => (montoContrato > 0 ? `${fmtNum((v / montoContrato) * 100, 1)}% del contrato` : undefined);
  const nombrePorDefecto = `Certificado Nº${numero}`;

  return (
    <Document title={`Certificado de avance Nº${numero} — ${proyectoNombre}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerRow}>
          <Text style={styles.empresaNombre}>{empresaNombre}</Text>
          <Text style={styles.generado}>Generado el {fechaUruguay()}</Text>
        </View>
        <Text style={styles.titulo}>Certificado de Avance de Obra Nº{numero}</Text>
        {nombre && nombre !== nombrePorDefecto && <Text style={styles.subtitulo}>{nombre}</Text>}
        <View style={styles.separador} />

        <View style={styles.datosRow}>
          <View style={styles.datoCol}>
            <Text style={styles.datoLabel}>Obra</Text>
            <Text style={styles.datoValor}>{proyectoNombre}</Text>
            {direccion && <Text style={styles.generado}>{direccion}</Text>}
          </View>
          <View style={styles.datoCol}>
            <Text style={styles.datoLabel}>Comitente</Text>
            <Text style={styles.datoValor}>{comitente || "—"}</Text>
          </View>
          <View style={styles.datoCol}>
            <Text style={styles.datoLabel}>Fecha de certificación</Text>
            <Text style={styles.datoValor}>{fmtFecha(fecha)}</Text>
          </View>
        </View>

        <View style={styles.resumenRow}>
          <ResumenCelda label="Monto del contrato" valor={fmtMoneda(montoContrato, moneda)} nota="Suma de rubros" />
          <ResumenCelda label="Certificado anterior" valor={fmtMoneda(montoAnterior, moneda)} nota={pct(montoAnterior)} />
          <ResumenCelda label="Esta certificación" valor={fmtMoneda(montoEsta, moneda)} nota={pct(montoEsta)} destacada />
          <ResumenCelda label="Acumulado a la fecha" valor={fmtMoneda(montoAcumulado, moneda)} nota={pct(montoAcumulado)} />
          <ResumenCelda
            label="Saldo a certificar"
            valor={fmtMoneda(montoContrato - montoAcumulado, moneda)}
            nota={pct(montoContrato - montoAcumulado)}
            ultima
          />
        </View>

        <Encabezado />
        {capitulos.map((cap) => {
          const montoCap = cap.rubros.reduce((s, r) => s + (r.pctEsta / 100) * importe(r), 0);
          return (
            <View key={`${cap.codigo}-${cap.nombre}`}>
              <View style={styles.filaCapitulo} wrap={false} minPresenceAhead={20}>
                <Text style={[styles.textoCapitulo, { width: "88%" }]}>
                  {cap.codigo ? `${cap.codigo}. ` : ""}
                  {cap.nombre}
                </Text>
                <Text style={[styles.textoCapitulo, styles.colEsta]}>
                  {montoCap > 0 ? fmtMoneda(montoCap, moneda) : "—"}
                </Text>
              </View>
              {cap.rubros.map((r, i) => (
                <FilaRubro key={`${r.codigo}-${i}`} r={r} moneda={moneda} />
              ))}
            </View>
          );
        })}

        <View style={styles.totalesBloque} wrap={false}>
          <View style={styles.totalFila}>
            <Text style={styles.totalLabel}>Acumulado anterior</Text>
            <Text style={styles.totalValor}>{fmtMoneda(montoAnterior, moneda)}</Text>
          </View>
          <View style={styles.totalFila}>
            <Text style={styles.totalLabel}>Acumulado a la fecha</Text>
            <Text style={styles.totalValor}>{fmtMoneda(montoAcumulado, moneda)}</Text>
          </View>
          <View style={styles.totalFilaFinal}>
            <Text style={styles.totalLabelFinal}>Importe de esta certificación</Text>
            <Text style={styles.totalValorFinal}>{fmtMoneda(montoEsta, moneda)}</Text>
          </View>
          <Text style={styles.notaIva}>Importes sin IVA.</Text>
        </View>

        {observaciones.trim() !== "" && (
          <View style={styles.textoBloque} wrap={false}>
            <Text style={styles.datoLabel}>Observaciones</Text>
            <Text style={styles.textoLibre}>{observaciones}</Text>
          </View>
        )}

        <View style={styles.firmasRow} wrap={false}>
          {["Director de obra", "Contratista", "Comitente"].map((rol) => (
            <View key={rol} style={styles.firma}>
              <View style={styles.firmaLinea} />
              <Text style={styles.firmaRol}>{rol}</Text>
              <Text style={styles.firmaAclaracion}>Firma y aclaración</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.textoFooter}>CÓMPUTO+ — Presupuestación de Obra</Text>
          <Text style={styles.textoFooter}>
            {proyectoNombre} · Certificado Nº{numero}
          </Text>
          <Text
            style={styles.textoFooter}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
