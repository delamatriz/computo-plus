// Corregir el precio de un material (a mano en un APU, o vía importación
// masiva) es, en los hechos, la misma resolución que "aceptar" en la Cola
// de Revisión de FEAT-AI-006 (ver resolver/route.ts) — limpia el estado
// pendiente/alerta y marca fechaUltimaVerificacion = ahora, para que
// BadgeVerificacion deje de mostrar "Pendiente de verificar". Extraído acá
// para no duplicar el criterio entre el PATCH individual
// (precios-mtop/route.ts) y la importación masiva (precios-mtop/importar/route.ts).
export function datosCorreccionPrecio(precioUnitario: number) {
  return {
    precioUnitario,
    precioConIva: precioUnitario,
    fechaUltimaVerificacion: new Date(),
    requiereVerificacion: false,
    motivoVerificacion: null,
    precioSugeridoPendiente: null,
  };
}
