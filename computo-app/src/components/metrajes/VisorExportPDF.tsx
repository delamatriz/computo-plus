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

// paddingTop bien por encima del resto — la cabecera quedaba pegada
// arriba con un padding parejo de 24 en las cuatro direcciones (el
// usuario lo reportó como "apretado"). alignItems:"center" en la
// página + la imagen a 96% (no 100%) en vez de pegada a los bordes
// horizontales del área de contenido — así cabecera + imagen quedan
// centradas como un solo conjunto, con aire visible a los costados.
const estilos = StyleSheet.create({
  pagina: { paddingTop: 56, paddingBottom: 32, paddingHorizontal: 32, fontFamily: "Helvetica", alignItems: "center" },
  cabecera: { fontSize: 9, color: "#475569", marginBottom: 16, textAlign: "center" },
  imagen: { width: "96%", height: "auto" },
  notas: { width: "96%", marginTop: 16, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: "#CBD5E1" },
  notasTitulo: { fontSize: 8, fontWeight: 700, color: "#1A3A5C", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  notasTexto: { fontSize: 8.5, color: "#334155", lineHeight: 1.4 },
});

function VisorExportDocument({
  textoCabecera,
  imagenDataUrl,
  orientacion,
  notas,
}: {
  textoCabecera: string;
  imagenDataUrl: string;
  orientacion: "portrait" | "landscape";
  notas: string | null;
}) {
  return (
    <Document>
      <Page size="A4" orientation={orientacion} style={estilos.pagina}>
        <View>
          <Text style={estilos.cabecera}>{textoCabecera}</Text>
        </View>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- Image acá es el componente de @react-pdf/renderer, no <img> de HTML */}
        <Image src={imagenDataUrl} style={estilos.imagen} />
        {notas && (
          <View style={estilos.notas}>
            <Text style={estilos.notasTitulo}>Notas</Text>
            <Text style={estilos.notasTexto}>{notas}</Text>
          </View>
        )}
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
  notas: string | null;
}): Promise<Blob> {
  const partes = [opts.nombreProyecto || "Proyecto", opts.fecha];
  if (opts.escala) partes.push(`Escala ${opts.escala}`);
  const textoCabecera = `${partes.join(" | ")} — ${opts.nombreDocumento}`;
  // Solo se muestra la sección de Notas si hay texto real cargado — el
  // placeholder del textarea ("Observaciones del relevamiento...") nunca
  // llega acá (es un atributo HTML, no un valor), así que alcanza con
  // chequear que no esté vacío/en blanco.
  const notas = opts.notas?.trim() || null;

  return pdf(
    <VisorExportDocument textoCabecera={textoCabecera} imagenDataUrl={opts.imagenDataUrl} orientacion={opts.orientacion} notas={notas} />
  ).toBlob();
}
