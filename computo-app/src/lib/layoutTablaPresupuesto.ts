// Anchos de columna compartidos entre la fila de Capítulo y la fila de Rubro
// de la tabla del proyecto (proyectos/[id]/page.tsx) Y las tarjetas sueltas
// de la cascada de abajo (Costo Directo, Gastos Generales y Beneficio, Costo
// Total, IVA, Precio Final, Leyes Sociales/BPS — SeccionCostoPrecioFinal.tsx,
// SeccionGastosGeneralesUtilidades.tsx, SeccionLeyesSociales.tsx).
//
// Viven acá, en vez de en page.tsx, para que esos 3 componentes puedan
// importarlas sin generar una dependencia circular (page.tsx ya los importa
// a ellos).
//
// TOTAL y % Incid. existen en la fila de Capítulo y en la fila de Rubro, y
// tienen que quedar alineados verticalmente entre sí — y a su vez con el
// monto de las tarjetas de abajo, que reservan el mismo ancho de cola
// (COL_PCT + COL_ACCION × N) en vez de un valor de píxeles ajustado a mano.
export const COL_TOTAL = "116px";
export const COL_PCT = "80px";
export const COL_ACCION = "28px";
export const COL_ICONO = "64px";
export const GRID_CAPITULO = `minmax(0,1fr) ${COL_TOTAL} ${COL_PCT} ${COL_ACCION} ${COL_ACCION}`;
// minmax(160px,1fr) en vez de minmax(0,1fr) — con un mínimo de 0 y el
// min-w del contenedor apenas más ancho que la suma de columnas fijas
// (bug real visto en mobile, reportado por Luis), Descripción quedaba
// con ~24px reales: el texto del header ("Descripción") no entraba y
// se dibujaba encima de "Unidad" sin que el grid layout tuviera ningún
// error de superposición — simplemente no había ancho para contenerlo.
// 160px mínimo + el resto de las columnas fijas fuerza scroll horizontal
// real en mobile en vez de un ancho inutilizable.
//
// Dos columnas de acción al final, igual que GRID_CAPITULO (trash + un
// segundo slot vacío, sin chevron propio — los rubros no colapsan) — antes
// tenía solo una, así que el TOTAL de rubro quedaba 28px más a la derecha
// que el TOTAL de capítulo.
export const GRID_RUBRO = `${COL_ICONO} minmax(160px,1fr) 76px 96px 116px ${COL_TOTAL} ${COL_PCT} ${COL_ACCION} ${COL_ACCION}`;

// Ancho total reservado después del texto del monto en la tabla — COL_PCT +
// las 2 columnas de acción (ahora iguales en ambos niveles de la tabla), MÁS
// los 8px de padding-right propios de la celda TOTAL (`px-2` en el <div> que
// envuelve cada monto de la tabla — el texto no llega hasta el borde de su
// propia columna, medido por DOM al verificar esta corrección). Las tarjetas
// de la cascada de abajo reservan este mismo ancho después de su propio
// monto, para que el borde derecho de todos los montos (tabla + tarjetas)
// coincida en la misma columna vertical.
export const RESERVA_COLA_TABLA = `calc(8px + ${COL_PCT} + ${COL_ACCION} + ${COL_ACCION})`;
