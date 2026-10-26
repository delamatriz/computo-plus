import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

// PDF de la estimación de Cálculo Rápido (POST /api/calcular-rapido/pdf).
// La estimación no se guarda en la base: la pantalla manda sus números y la
// ruta recalcula Gastos Generales, Beneficio, IVA y Precio Final con la misma
// fórmula que la pantalla (suma directa sobre el Costo Directo, IVA 22%).

/* ─── Tipos ───────────────────────────────────────────────── */
export interface EmpresaEstimacionPDF {
  nombre: string;
  rut: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  web: string | null;
  logo: string | null;
}

export interface CapituloEstimacionPDF {
  nombre: string;
  monto: number;
  materiales: number;
  manoObra: number;
  /** "biblioteca" (rubro real de la biblioteca), "empresa" (Mi biblioteca) o null (estimado). */
  fuente: "biblioteca" | "empresa" | null;
}

export interface EstimacionPDFProps {
  empresa: EmpresaEstimacionPDF | null;
  tipoObra: string;
  zona: string;
  nivel: string;
  /** m² (camino por m²) o null. */
  area: number | null;
  /** Texto de los trabajos (Reparaciones / Reforma) o null. */
  descripcion: string | null;
  moneda: "UYU" | "USD";
  tipoCambio: { valor: number; fecha: string | null; fuente: "BCU" | "referencia" };
  costoDirecto: number;
  materiales: number;
  manoObra: number;
  capitulos: CapituloEstimacionPDF[];
  pctGG: number;
  pctBeneficio: number;
  montoGG: number;
  montoBeneficio: number;
  costoTotal: number;
  iva: number;
  precioFinal: number;
  /** Solo en el camino por m². */
  rango: { minimo: number; maximo: number } | null;
  /** Fracción 0–1 del total basada en la biblioteca de rubros (solo estimación por descripción). */
  proporcionBiblioteca: number | null;
  advertencia: string | null;
}

/* ─── Formato ─────────────────────────────────────────────── */
function fechaHoy(): string {
  return new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Montevideo" });
}

/* ─── Estilos ─────────────────────────────────────────────── */
const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 56, fontFamily: "Helvetica", fontSize: 9, color: "#1E293B" },

  membrete: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  membreteIzq: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { maxWidth: 70, maxHeight: 40, objectFit: "contain" },
  empresaNombre: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1A3A5C" },
  empresaDato: { fontSize: 7.5, color: "#64748B", marginTop: 1 },
  fecha: { fontSize: 8, color: "#94A3B8" },
  titulo: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#1A3A5C", marginTop: 10 },
  subtitulo: { fontSize: 9, color: "#64748B", marginTop: 3 },
  separador: { borderBottomWidth: 2, borderBottomColor: "#2563EB", marginTop: 12, marginBottom: 14 },

  seccion: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5, marginTop: 12 },
  datosGrid: { flexDirection: "row", flexWrap: "wrap" },
  dato: { width: "50%", marginBottom: 5 },
  datoLabel: { fontSize: 7.5, color: "#94A3B8" },
  datoValor: { fontSize: 9.5, color: "#1E293B", marginTop: 1 },
  descripcion: { fontSize: 9, color: "#334155", lineHeight: 1.4, backgroundColor: "#F8FAFC", padding: 8, borderRadius: 4 },

  costoDirectoBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1A3A5C", borderRadius: 6, paddingVertical: 10, paddingHorizontal: 12, marginTop: 4 },
  costoDirectoLabel: { fontSize: 9, color: "#FFFFFF", fontFamily: "Helvetica-Bold" },
  costoDirectoSub: { fontSize: 7.5, color: "#CBD5E1", marginTop: 2 },
  costoDirectoMonto: { fontSize: 15, color: "#FFFFFF", fontFamily: "Helvetica-Bold" },

  filaEncabezado: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  textoEncabezado: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 },
  fila: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#F1F5F9" },
  filaPar: { backgroundColor: "#F8FAFC" },
  colCapitulo: { width: "46%" },
  colNum: { width: "18%", textAlign: "right" },
  textoCelda: { fontSize: 8.5, color: "#334155" },
  marca: { fontSize: 6.5, color: "#2563EB" },

  totales: { marginTop: 14, marginLeft: "40%" },
  filaTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  labelTotal: { fontSize: 9, color: "#475569" },
  montoTotal: { fontSize: 9, color: "#1E293B" },
  separadorTotal: { borderBottomWidth: 1, borderBottomColor: "#CBD5E1", marginVertical: 4 },
  labelFinal: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1A3A5C" },
  montoFinal: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#2563EB" },

  rango: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, marginLeft: "40%" },
  rangoTexto: { fontSize: 8, color: "#64748B" },

  avisos: { marginTop: 18, borderTopWidth: 0.5, borderTopColor: "#E2E8F0", paddingTop: 8 },
  aviso: { fontSize: 7.5, color: "#64748B", lineHeight: 1.4, marginBottom: 2 },

  footer: { position: "absolute", bottom: 24, left: 56, right: 56, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: "#E2E8F0", paddingTop: 6 },
  textoFooter: { fontSize: 7.5, color: "#94A3B8" },
});

/* ─── Documento ───────────────────────────────────────────── */
export function EstimacionPDF(props: EstimacionPDFProps) {
  const { empresa, moneda } = props;
  const simbolo = moneda === "USD" ? "U$S" : "$";
  const fmt = (v: number) => `${simbolo} ${Math.round(v).toLocaleString("es-UY")}`;
  const fmtPct = (v: number) => `${v.toLocaleString("es-UY", { maximumFractionDigits: 2 })}%`;
  const contacto = empresa ? [empresa.direccion, empresa.telefono, empresa.email, empresa.web].filter(Boolean).join(" · ") : "";
  const fechaTc = props.tipoCambio.fecha ? props.tipoCambio.fecha.split("-").reverse().join("/") : null;

  return (
    <Document title="Estimación de Cálculo Rápido">
      <Page size="A4" style={styles.page}>
        {/* Membrete */}
        <View style={styles.membrete}>
          <View style={styles.membreteIzq}>
            {empresa?.logo ? <Image style={styles.logo} src={empresa.logo} /> : null}
            <View>
              <Text style={styles.empresaNombre}>{empresa?.nombre || "CÓMPUTO+"}</Text>
              {empresa?.rut ? <Text style={styles.empresaDato}>RUT: {empresa.rut}</Text> : null}
              {contacto ? <Text style={styles.empresaDato}>{contacto}</Text> : null}
            </View>
          </View>
          <Text style={styles.fecha}>{fechaHoy()}</Text>
        </View>
        <Text style={styles.titulo}>Estimación de Cálculo Rápido</Text>
        <Text style={styles.subtitulo}>Valores orientativos basados en promedios del mercado uruguayo</Text>
        <View style={styles.separador} />

        {/* Datos de la obra */}
        <Text style={styles.seccion}>Datos de la obra</Text>
        <View style={styles.datosGrid}>
          <View style={styles.dato}>
            <Text style={styles.datoLabel}>Tipo de obra</Text>
            <Text style={styles.datoValor}>{props.tipoObra}</Text>
          </View>
          <View style={styles.dato}>
            <Text style={styles.datoLabel}>Zona</Text>
            <Text style={styles.datoValor}>{props.zona}</Text>
          </View>
          <View style={styles.dato}>
            <Text style={styles.datoLabel}>Nivel de terminación</Text>
            <Text style={styles.datoValor}>{props.nivel}</Text>
          </View>
          {props.area != null ? (
            <View style={styles.dato}>
              <Text style={styles.datoLabel}>Área</Text>
              <Text style={styles.datoValor}>{props.area.toLocaleString("es-UY")} m²</Text>
            </View>
          ) : null}
        </View>
        {props.descripcion ? (
          <View style={{ marginTop: 2 }}>
            <Text style={[styles.datoLabel, { marginBottom: 3 }]}>Trabajos</Text>
            <Text style={styles.descripcion}>{props.descripcion}</Text>
          </View>
        ) : null}

        {/* Costo directo */}
        <Text style={styles.seccion}>Costo directo</Text>
        <View style={styles.costoDirectoBox} wrap={false}>
          <View>
            <Text style={styles.costoDirectoLabel}>Costo Directo</Text>
            <Text style={styles.costoDirectoSub}>
              Materiales {fmt(props.materiales)} · Mano de obra {fmt(props.manoObra)}
            </Text>
          </View>
          <Text style={styles.costoDirectoMonto}>{fmt(props.costoDirecto)}</Text>
        </View>

        {/* Desglose por capítulo */}
        {props.capitulos.length > 0 ? (
          <>
            <Text style={styles.seccion}>Desglose por capítulo</Text>
            <View style={styles.filaEncabezado}>
              <Text style={[styles.textoEncabezado, styles.colCapitulo]}>Capítulo</Text>
              <Text style={[styles.textoEncabezado, styles.colNum]}>Materiales</Text>
              <Text style={[styles.textoEncabezado, styles.colNum]}>Mano de obra</Text>
              <Text style={[styles.textoEncabezado, styles.colNum]}>Total</Text>
            </View>
            {props.capitulos.map((c, i) => (
              <View key={i} style={[styles.fila, i % 2 === 0 ? styles.filaPar : {}]} wrap={false}>
                <View style={styles.colCapitulo}>
                  <Text style={styles.textoCelda}>{c.nombre}</Text>
                  {c.fuente ? (
                    <Text style={styles.marca}>{c.fuente === "empresa" ? "Precio de Mis rubros" : "Biblioteca de rubros de CÓMPUTO+"}</Text>
                  ) : null}
                </View>
                <Text style={[styles.textoCelda, styles.colNum]}>{fmt(c.materiales)}</Text>
                <Text style={[styles.textoCelda, styles.colNum]}>{fmt(c.manoObra)}</Text>
                <Text style={[styles.textoCelda, styles.colNum]}>{fmt(c.monto)}</Text>
              </View>
            ))}
          </>
        ) : null}

        {/* Totales */}
        <View style={styles.totales} wrap={false}>
          <View style={styles.filaTotal}>
            <Text style={styles.labelTotal}>Costo Directo</Text>
            <Text style={styles.montoTotal}>{fmt(props.costoDirecto)}</Text>
          </View>
          <View style={styles.filaTotal}>
            <Text style={styles.labelTotal}>Gastos Generales ({fmtPct(props.pctGG)})</Text>
            <Text style={styles.montoTotal}>{fmt(props.montoGG)}</Text>
          </View>
          <View style={styles.filaTotal}>
            <Text style={styles.labelTotal}>Beneficio ({fmtPct(props.pctBeneficio)})</Text>
            <Text style={styles.montoTotal}>{fmt(props.montoBeneficio)}</Text>
          </View>
          <View style={styles.separadorTotal} />
          <View style={styles.filaTotal}>
            <Text style={styles.labelTotal}>Costo Total</Text>
            <Text style={styles.montoTotal}>{fmt(props.costoTotal)}</Text>
          </View>
          <View style={styles.filaTotal}>
            <Text style={styles.labelTotal}>IVA (22%)</Text>
            <Text style={styles.montoTotal}>{fmt(props.iva)}</Text>
          </View>
          <View style={styles.separadorTotal} />
          <View style={styles.filaTotal}>
            <Text style={styles.labelFinal}>Precio Final</Text>
            <Text style={styles.montoFinal}>{fmt(props.precioFinal)}</Text>
          </View>
        </View>

        {props.rango ? (
          <View style={styles.rango} wrap={false}>
            <Text style={styles.rangoTexto}>Rango mínimo del Costo Directo: {fmt(props.rango.minimo)}</Text>
            <Text style={styles.rangoTexto}>Rango máximo: {fmt(props.rango.maximo)}</Text>
          </View>
        ) : null}

        {/* Avisos */}
        <View style={styles.avisos} wrap={false}>
          {moneda === "USD" ? (
            <Text style={styles.aviso}>
              Tipo de cambio: $ {props.tipoCambio.valor.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} por dólar —{" "}
              {props.tipoCambio.fuente === "BCU" && fechaTc ? `Dólar BCU al ${fechaTc}` : "tipo de cambio de referencia"}.
            </Text>
          ) : null}
          {props.proporcionBiblioteca != null ? (
            <Text style={styles.aviso}>
              {Math.round(props.proporcionBiblioteca * 100)}% del presupuesto basado en precios reales de la biblioteca de rubros.
            </Text>
          ) : null}
          <Text style={styles.aviso}>
            Estimación orientativa: no es una cotización. Materiales con IVA incluido, sin aportes sociales (BPS).
          </Text>
          <Text style={styles.aviso}>
            Gastos Generales, Beneficio e IVA se calculan de forma simple sobre el Costo Directo. Para mayor exactitud, desarrollá un
            proyecto completo.
          </Text>
          {props.advertencia ? <Text style={styles.aviso}>{props.advertencia}</Text> : null}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.textoFooter}>CÓMPUTO+ — Presupuestación de Obra</Text>
          <Text style={styles.textoFooter} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
