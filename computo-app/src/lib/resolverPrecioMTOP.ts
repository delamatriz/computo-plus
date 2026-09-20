// Corregir el precio de un material (a mano en un APU, o vía importación
// masiva) es, en los hechos, la misma resolución que "aceptar" en la Cola
// de Revisión de FEAT-AI-006 (ver resolver/route.ts) — limpia el estado
// pendiente/alerta y marca fechaUltimaVerificacion = ahora, para que
// BadgeVerificacion deje de mostrar "Pendiente de verificar". Extraído acá
// para no duplicar el criterio entre el PATCH individual
// (precios-mtop/route.ts) y la importación masiva (precios-mtop/importar/route.ts).
//
// origenVerificacion: "manual" siempre acá — todo caller de esta función
// es un humano asignando un precio a propósito (edición directa,
// corrección inline desde un APU, o una lista que el usuario subió), nunca
// el buscador automático de FEAT-AI-006 (ver verificarPrecioMercado.ts,
// que escribe "automatico" por su cuenta). Marcarlo acá saca la fila de la
// elegibilidad del botón "Buscar precios actualizados" — ver
// GET /api/configuracion/precios-mercado/elegibles.
//
// precioAnterior: snapshot del valor previo, para poder detectar un salto
// brusco después de los hechos sin necesitar una tabla de historial. El
// caller lo pasa explícitamente (null en un alta nueva, sin valor previo)
// porque esta función no tiene forma propia de leer el estado actual.
export function datosCorreccionPrecio(precioUnitario: number, precioAnterior: number | null) {
  return {
    precioUnitario,
    precioConIva: precioUnitario,
    fechaUltimaVerificacion: new Date(),
    requiereVerificacion: false,
    motivoVerificacion: null,
    precioSugeridoPendiente: null,
    origenVerificacion: "manual",
    precioAnterior,
  };
}
