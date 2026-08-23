// Configura el worker de pdf.js (react-pdf) una sola vez, a nivel de módulo.
// Sin esto, cualquier <Document> de react-pdf revienta con "No
// GlobalWorkerOptions.workerSrc specified" — antes vivía como efecto
// colateral de Visor.tsx, así que solo funcionaba si el usuario ya había
// pasado por /visor de otro proyecto en la misma pestaña. Cualquier
// componente que use <Document>/<Page> de react-pdf debe importar este
// módulo antes (alcanza con el import, no hace falta usar nada de acá).
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();
