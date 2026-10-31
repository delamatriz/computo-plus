import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { fechaUruguay } from "@/lib/fechaUruguay";

// Pedido de cotización a un proveedor, armado desde una selección del
// Cómputo Global de Materiales. Documento para el proveedor externo: lleva
// cantidades pero NUNCA nuestros precios — las columnas de precio van vacías
// para que las complete él (mismo criterio que OrdenCompraPDF).

export interface ItemPedidoCotizacionPDF {
  descripcion: string;
  unidad: string;
  cantidad: number;
}

export interface PedidoCotizacionPDFProps {
  empresa: { nombre: string; rut: string | null; telefono: string | null; email: string | null; direccion: string | null };
  proyectoNombre: string;
  direccionObra: string | null;
  proveedor: string;
  fechaLimite: string | null; // YYYY-MM-DD
  nota: string | null;
  items: ItemPedidoCotizacionPDF[];
}

function fmtCantidad(v: number): string {
  return v.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtFechaLimite(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("es-UY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const AZUL = "#1A3A5C";
const ACENTO = "#2563EB";

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 60, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 9, color: "#1E293B" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  empresaNombre: { fontSize: 11, fontFamily: "Helvetica-Bold", color: AZUL },
  empresaDato: { fontSize: 7.5, color: "#64748B", marginTop: 1.5 },
  fecha: { fontSize: 7.5, color: "#94A3B8" },
  titulo: { fontSize: 18, fontFamily: "Helvetica-Bold", color: AZUL, marginTop: 14 },
  separador: { borderBottomWidth: 2, borderBottomColor: ACENTO, marginTop: 10, marginBottom: 14 },

  datosRow: { flexDirection: "row", marginBottom: 14 },
  datoCol: { flex: 1, paddingRight: 10 },
  datoLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  datoValor: { fontSize: 9.5, color: "#334155" },
  datoValorFuerte: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: AZUL },
  datoSecundario: { fontSize: 7.5, color: "#94A3B8", marginTop: 1 },

  intro: { fontSize: 9, color: "#475569", lineHeight: 1.45, marginBottom: 12 },

  filaEncabezado: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, backgroundColor: AZUL },
  textoEncabezado: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#FFFFFF", textTransform: "uppercase" },
  fila: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#E2E8F0" },
  filaPar: { backgroundColor: "#F8FAFC" },
  textoCelda: { fontSize: 8.5, color: "#334155" },
  textoMuted: { fontSize: 8.5, color: "#94A3B8" },
  celdaVacia: { borderBottomWidth: 0.5, borderBottomColor: "#94A3B8", height: 10, marginLeft: 8 },

  colNum: { width: "5%" },
  colDesc: { width: "45%", paddingRight: 6 },
  colUnidad: { width: "8%", textAlign: "center" },
  colCant: { width: "12%", textAlign: "right" },
  colPU: { width: "15%" },
  colTotal: { width: "15%" },

  notaBloque: { marginTop: 14, padding: 9, backgroundColor: "#F8FAFC", borderRadius: 4 },
  textoLibre: { fontSize: 8.5, color: "#334155", lineHeight: 1.4 },

  condiciones: { marginTop: 16 },
  condicionFila: { flexDirection: "row", marginBottom: 7 },
  condicionLabel: { fontSize: 8.5, color: "#475569", width: 150 },
  condicionLinea: { flex: 1, borderBottomWidth: 0.5, borderBottomColor: "#94A3B8" },

  footer: {
    position: "absolute",
    bottom: 26,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#E2E8F0",
    paddingTop: 6,
  },
  textoFooter: { fontSize: 7, color: "#94A3B8" },
});

export function PedidoCotizacionPDF({
  empresa,
  proyectoNombre,
  direccionObra,
  proveedor,
  fechaLimite,
  nota,
  items,
}: PedidoCotizacionPDFProps) {
  const contacto = [empresa.telefono, empresa.email].filter(Boolean).join(" · ");
  return (
    <Document title={`Pedido de cotización — ${proveedor}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.empresaNombre}>{empresa.nombre}</Text>
            {empresa.rut && <Text style={styles.empresaDato}>RUT {empresa.rut}</Text>}
            {contacto !== "" && <Text style={styles.empresaDato}>{contacto}</Text>}
            {empresa.direccion && <Text style={styles.empresaDato}>{empresa.direccion}</Text>}
          </View>
          <Text style={styles.fecha}>{fechaUruguay()}</Text>
        </View>
        <Text style={styles.titulo}>Pedido de Cotización</Text>
        <View style={styles.separador} />

        <View style={styles.datosRow}>
          <View style={styles.datoCol}>
            <Text style={styles.datoLabel}>Proveedor</Text>
            <Text style={styles.datoValorFuerte}>{proveedor}</Text>
          </View>
          <View style={styles.datoCol}>
            <Text style={styles.datoLabel}>Obra</Text>
            <Text style={styles.datoValor}>{proyectoNombre}</Text>
            {direccionObra && <Text style={styles.datoSecundario}>{direccionObra}</Text>}
          </View>
          <View style={styles.datoCol}>
            <Text style={styles.datoLabel}>Cotizar antes del</Text>
            <Text style={styles.datoValor}>{fechaLimite ? fmtFechaLimite(fechaLimite) : "—"}</Text>
          </View>
        </View>

        <Text style={styles.intro}>
          Solicitamos cotización por los siguientes materiales, indicando precio unitario, plazo de entrega y
          condiciones de pago. Cantidades estimadas según cómputo de obra.
        </Text>

        <View style={styles.filaEncabezado} fixed>
          <Text style={[styles.textoEncabezado, styles.colNum]}>#</Text>
          <Text style={[styles.textoEncabezado, styles.colDesc]}>Material</Text>
          <Text style={[styles.textoEncabezado, styles.colUnidad]}>Unidad</Text>
          <Text style={[styles.textoEncabezado, styles.colCant]}>Cantidad</Text>
          <Text style={[styles.textoEncabezado, styles.colPU, { textAlign: "right" }]}>Precio unit.</Text>
          <Text style={[styles.textoEncabezado, styles.colTotal, { textAlign: "right" }]}>Total</Text>
        </View>
        {items.map((it, i) => (
          <View key={i} style={[styles.fila, i % 2 === 1 ? styles.filaPar : {}]} wrap={false}>
            <Text style={[styles.textoMuted, styles.colNum]}>{i + 1}</Text>
            <Text style={[styles.textoCelda, styles.colDesc]}>{it.descripcion}</Text>
            <Text style={[styles.textoMuted, styles.colUnidad]}>{it.unidad}</Text>
            <Text style={[styles.textoCelda, styles.colCant]}>{fmtCantidad(it.cantidad)}</Text>
            <View style={styles.colPU}>
              <View style={styles.celdaVacia} />
            </View>
            <View style={styles.colTotal}>
              <View style={styles.celdaVacia} />
            </View>
          </View>
        ))}

        {nota && (
          <View style={styles.notaBloque} wrap={false}>
            <Text style={styles.datoLabel}>Nota</Text>
            <Text style={styles.textoLibre}>{nota}</Text>
          </View>
        )}

        <View style={styles.condiciones} wrap={false}>
          {["Plazo de entrega", "Condiciones de pago", "Validez de la oferta", "IVA incluido (sí / no)"].map((c) => (
            <View key={c} style={styles.condicionFila}>
              <Text style={styles.condicionLabel}>{c}</Text>
              <View style={styles.condicionLinea} />
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.textoFooter}>{empresa.nombre}</Text>
          <Text style={styles.textoFooter}>
            Pedido de cotización · {proveedor} · {items.length} ítem{items.length !== 1 ? "s" : ""}
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
