import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarPrecioMTOP, type ResultadoVerificacionPrecio } from "@/lib/verificarPrecioMercado";

const TAMANO_TANDA_MAXIMO = 8; // margen sobre las tandas de 4 que arma el cliente — evita que un body manual dispare una corrida larga por request

// Procesa una tanda chica de códigos (4, según el diseño de
// SeccionActualizacionDatos.tsx) de forma secuencial, aplicando el
// resultado de cada uno de una — sin gate de confirmación aparte: el
// umbral de variación YA es la decisión de "esto no necesita humano" (ver
// lib/verificarPrecioMercado.ts). Devuelve un resultado por código,
// apenas termine toda la tanda (unos pocos minutos como mucho).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const codigos: unknown = body?.codigos;

    if (!Array.isArray(codigos) || codigos.length === 0 || !codigos.every((c) => typeof c === "string")) {
      return NextResponse.json({ error: "Falta codigos (array de strings)" }, { status: 400 });
    }
    if (codigos.length > TAMANO_TANDA_MAXIMO) {
      return NextResponse.json({ error: `Máximo ${TAMANO_TANDA_MAXIMO} códigos por tanda` }, { status: 400 });
    }

    const resultados: ResultadoVerificacionPrecio[] = [];

    for (const codigo of codigos as string[]) {
      // Revalida elegibilidad justo antes de procesar — el registro pudo
      // haber cambiado de estado entre que el cliente pidió la lista de
      // elegibles y que le tocó el turno a esta tanda (otra pestaña
      // corriendo la misma pantalla, por ejemplo).
      const item = await db.precioMTOP.findUnique({
        where: { codigo },
        select: { codigo: true, descripcion: true, precioUnitario: true, proveedor: true, motivoVerificacion: true, requiereVerificacion: true },
      });

      if (!item || !item.proveedor || item.motivoVerificacion !== null || item.requiereVerificacion) {
        resultados.push({
          codigo,
          descripcion: item?.descripcion ?? codigo,
          accion: "ya_no_elegible",
          precioAnterior: item?.precioUnitario ?? 0,
          precioNuevo: null,
          variacionPct: null,
          detalle: "Ya no es elegible — otro proceso lo modificó mientras esperaba su turno.",
        });
        continue;
      }

      try {
        const resultado = await verificarPrecioMTOP(codigo, true);
        resultados.push(resultado);
      } catch (err) {
        resultados.push({
          codigo,
          descripcion: item.descripcion,
          accion: "error",
          precioAnterior: item.precioUnitario,
          precioNuevo: null,
          variacionPct: null,
          detalle: `Error inesperado: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    return NextResponse.json({ resultados });
  } catch (err) {
    console.error("[POST /api/configuracion/precios-mercado/procesar-tanda]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
