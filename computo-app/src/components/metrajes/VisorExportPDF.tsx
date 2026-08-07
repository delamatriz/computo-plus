// Arma el PDF de "Descargar PDF" del Visor — cabecera de texto (proyecto,
// fecha, escala) + la captura del viewport actual (canvas + anotaciones)
// como imagen debajo. Reusa @react-pdf/renderer, ya instalada y usada en
// el resto de la app (PresupuestoPDF.tsx, ListaMaterialesPDF.tsx) pero
// hasta ahora solo server-side — acá corre en el navegador (pdf(...).toBlob()
// es la API pensada justo para eso). Archivo separado a propósito: Visor.tsx
// lo carga con un import() dinámico dentro del handler del botón, no en su
// propio top-level, así esta librería (y sus assets de fuentes) no viajan
// en el bundle inicial del Visor — solo se piden cuando el usuario realmente
// aprieta "Descargar PDF".
import { Document, Page, View, Text, Image, StyleSheet, pdf } from "@react-pdf/renderer";

const estilos = StyleSheet.create({
  pagina: { padding: 24, fontFamily: "Helvetica" },
  cabecera: { fontSize: 9, color: "#475569", marginBottom: 10 },
  imagen: { width: "100%", height: "auto" },
});

function VisorExportDocument({
  textoCabecera,
  imagenDataUrl,
  orientacion,
}: {
  textoCabecera: string;
  imagenDataUrl: string;
  orientacion: "portrait" | "landscape";
}) {
  return (
    <Document>
      <Page size="A4" orientation={orientacion} style={estilos.pagina}>
        <View>
          <Text style={estilos.cabecera}>{textoCabecera}</Text>
        </View>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- Image acá es el componente de @react-pdf/renderer, no <img> de HTML */}
        <Image src={imagenDataUrl} style={estilos.imagen} />
      </Page>
    </Document>
  );
}

export async function generarPdfVisor(opts: {
  nombreProyecto: string;
  nombreDocumento: string;
  fecha: string;
  escala: string | null;
  imagenDataUrl: string;
  orientacion: "portrait" | "landscape";
}): Promise<Blob> {
  const partes = [opts.nombreProyecto || "Proyecto", opts.fecha];
  if (opts.escala) partes.push(`Escala ${opts.escala}`);
  const textoCabecera = `${partes.join(" | ")} — ${opts.nombreDocumento}`;

  return pdf(
    <VisorExportDocument textoCabecera={textoCabecera} imagenDataUrl={opts.imagenDataUrl} orientacion={opts.orientacion} />
  ).toBlob();
}
