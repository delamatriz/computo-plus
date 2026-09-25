import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

/* ─── Tipos ───────────────────────────────────────────────── */
export interface ObservacionRubroPDF {
  rubroCodigo: string;
  rubroDescripcion: string;
  capituloNombre?: string;
  observacion: string;
  estado: string;
}

export interface FirmantePDF {
  nombre: string;
  rol: string;
}

export interface ParteComitentePDF {
  nombre: string | null;
  razonSocial: string | null;
  rut: string | null;
  telefono: string | null;
  email: string | null;
}

export interface ParteEmpresaPDF {
  nombre: string;
  rut: string;
  matricula: string | null;
  direccion: string | null;
  telefono: string | null;
}

export interface ActaCierrePDFProps {
  empresaNombreHeader: string;
  proyectoNombre: string;
  fechaCierre: string | null; // ISO
  comitente: ParteComitentePDF;
  empresa: ParteEmpresaPDF | null;
  observacionesGenerales: string | null;
  observaciones: ObservacionRubroPDF[];
  firmantes: FirmantePDF[];
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

/* ─── Estilos (mismo lenguaje visual que OrdenCompraPDF) ─────── */
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

  // Partes (comitente / empresa)
  partesRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  parteBloque: {
    width: "50%",
    paddingRight: 12,
  },
  parteNombre: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1E293B",
    marginBottom: 2,
  },
  parteDato: {
    fontSize: 8.5,
    color: "#64748B",
    marginBottom: 1,
  },

  // Bloque de texto libre
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

  // Tabla de observaciones por rubro
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
  filaObs: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F1F5F9",
  },
  filaObsPar: { backgroundColor: "#F8FAFC" },
  filaObsImpar: { backgroundColor: "#FFFFFF" },
  colRubro: { width: "28%" },
  colEstado: { width: "24%" },
  colObservacion: { width: "48%" },
  textoCelda: { fontSize: 8.5, color: "#334155" },
  textoCeldaMuted: { fontSize: 8.5, color: "#94A3B8" },

  // Firmantes
  firmantesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 28,
  },
  firmaBloque: {
    width: "50%",
    paddingRight: 16,
    marginBottom: 28,
  },
  lineaFirma: {
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    marginBottom: 4,
    height: 28,
  },
  firmaNombre: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1E293B",
  },
  firmaRol: {
    fontSize: 8,
    color: "#64748B",
    marginTop: 1,
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
function FilaObservacion({ obs, index }: { obs: ObservacionRubroPDF; index: number }) {
  return (
    <View style={[styles.filaObs, index % 2 === 0 ? styles.filaObsPar : styles.filaObsImpar]} wrap={false}>
      <Text style={[styles.textoCelda, styles.colRubro]}>
        {obs.rubroCodigo ? `${obs.rubroCodigo} · ` : ""}
        {obs.rubroDescripcion || "—"}
      </Text>
      <Text style={[styles.textoCelda, styles.colEstado]}>{obs.estado}</Text>
      <Text style={[styles.textoCelda, styles.colObservacion]}>{obs.observacion || "—"}</Text>
    </View>
  );
}

function BloqueParte({ titulo, nombre, lineas }: { titulo: string; nombre: string; lineas: string[] }) {
  return (
    <View style={styles.parteBloque}>
      <Text style={styles.seccionLabel}>{titulo}</Text>
      <Text style={styles.parteNombre}>{nombre || "—"}</Text>
      {lineas.map((l, i) => (
        <Text key={i} style={styles.parteDato}>{l}</Text>
      ))}
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
export function ActaCierrePDF({
  empresaNombreHeader,
  proyectoNombre,
  fechaCierre,
  comitente,
  empresa,
  observacionesGenerales,
  observaciones,
  firmantes,
}: ActaCierrePDFProps) {
  const nombreComitente = comitente.razonSocial || comitente.nombre || "—";
  const datosComitente = [
    comitente.rut ? `RUT ${comitente.rut}` : null,
    comitente.telefono,
    comitente.email,
  ].filter((v): v is string => Boolean(v));

  const datosEmpresa = empresa
    ? [
        empresa.rut ? `RUT ${empresa.rut}` : null,
        empresa.matricula ? `Matrícula ${empresa.matricula}` : null,
        empresa.direccion,
        empresa.telefono,
      ].filter((v): v is string => Boolean(v))
    : [];

  const sinFirmantes = firmantes.length === 0;
  const lineasFirma: FirmantePDF[] = sinFirmantes
    ? [
        { nombre: "", rol: "Firma comitente" },
        { nombre: "", rol: "Firma empresa constructora" },
      ]
    : firmantes;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.empresaNombre}>{empresaNombreHeader}</Text>
          <Text style={styles.fecha}>Generado el {fechaHoy()}</Text>
        </View>
        <Text style={styles.tituloProyecto}>Acta de Cierre y Recepción de Obra</Text>
        <Text style={styles.subtitulo}>{proyectoNombre}</Text>
        <Text style={styles.subtitulo}>
          Fecha de cierre/recepción: {fechaCierre ? fmtFecha(fechaCierre) : "Sin definir"}
        </Text>
        <View style={styles.separador} />

        {/* Partes */}
        <View style={styles.partesRow}>
          <BloqueParte titulo="Comitente" nombre={nombreComitente} lineas={datosComitente} />
          <BloqueParte titulo="Empresa constructora" nombre={empresa?.nombre || "—"} lineas={datosEmpresa} />
        </View>

        {/* Observaciones generales */}
        {observacionesGenerales && (
          <View style={styles.textoBloque}>
            <Text style={styles.seccionLabel}>Observaciones generales</Text>
            <Text style={styles.textoLibre}>{observacionesGenerales}</Text>
          </View>
        )}

        {/* Observaciones por rubro */}
        <Text style={styles.seccionLabel}>Observaciones por rubro</Text>
        {observaciones.length === 0 ? (
          <View style={styles.textoBloque}>
            <Text style={styles.textoLibre}>
              Sin observaciones cargadas por rubro — recepción sin objeciones registradas.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.filaEncabezado}>
              <Text style={[styles.textoEncabezado, styles.colRubro]}>Rubro</Text>
              <Text style={[styles.textoEncabezado, styles.colEstado]}>Estado</Text>
              <Text style={[styles.textoEncabezado, styles.colObservacion]}>Observación</Text>
            </View>
            {observaciones.map((o, i) => (
              <FilaObservacion key={i} obs={o} index={i} />
            ))}
          </>
        )}

        {/* Firmantes */}
        <View style={styles.firmantesGrid}>
          {lineasFirma.map((f, i) => (
            <View key={i} style={styles.firmaBloque} wrap={false}>
              <View style={styles.lineaFirma} />
              <Text style={styles.firmaNombre}>{f.nombre || " "}</Text>
              <Text style={styles.firmaRol}>{f.rol}</Text>
            </View>
          ))}
        </View>

        <PiePagina proyectoNombre={proyectoNombre} />
      </Page>
    </Document>
  );
}
