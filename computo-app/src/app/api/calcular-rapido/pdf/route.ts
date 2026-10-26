import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { requerirSesion } from "@/lib/sesion";
import { EstimacionPDF, type CapituloEstimacionPDF, type EstimacionPDFProps } from "@/components/EstimacionPDF";

// POST — PDF de la estimación de Cálculo Rápido. La estimación no se guarda en
// la base: la pantalla manda sus números y acá se arma el documento. Gastos
// Generales, Beneficio, IVA y Precio Final se recalculan con la misma fórmula
// que la pantalla (y que el presupuesto completo, costoAgregado.ts): suma
// directa sobre el Costo Directo, IVA 22% fijo. No gasta cupo de la prueba.
const IVA = 0.22;
const MAX_CAPITULOS = 80;
const MAX_TEXTO = 3000;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const texto = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  const sesion = await requerirSesion();
  if (sesion instanceof NextResponse) return sesion;
  try {
    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.capitulos)) {
      return NextResponse.json({ error: "Datos de la estimación inválidos" }, { status: 400 });
    }

    const empresa = await db.empresa.findUnique({
      where: { id: sesion.empresaId },
      select: { nombre: true, rut: true, direccion: true, telefono: true, email: true, web: true, logo: true },
    });

    const capitulos: CapituloEstimacionPDF[] = (body.capitulos as unknown[]).slice(0, MAX_CAPITULOS).map((c) => {
      const cap = (c ?? {}) as Record<string, unknown>;
      const fuente = cap.fuente === "empresa" ? "empresa" : cap.fuente === "biblioteca" ? "biblioteca" : null;
      return { nombre: texto(cap.nombre) || "—", monto: num(cap.monto), materiales: num(cap.materiales), manoObra: num(cap.manoObra), fuente };
    });

    const costoDirecto = num(body.costoDirecto);
    const pctGG = num(body.pctGG);
    const pctBeneficio = num(body.pctBeneficio);
    const montoGG = costoDirecto * (pctGG / 100);
    const montoBeneficio = costoDirecto * (pctBeneficio / 100);
    const costoTotal = costoDirecto + montoGG + montoBeneficio;
    const iva = costoTotal * IVA;
    const tc = (body.tipoCambio ?? {}) as Record<string, unknown>;
    const rango = body.rango && typeof body.rango === "object" ? (body.rango as Record<string, unknown>) : null;

    const props: EstimacionPDFProps = {
      empresa: empresa ?? null,
      tipoObra: texto(body.tipoObra) || "—",
      zona: texto(body.zona) || "—",
      nivel: texto(body.nivel) || "—",
      area: num(body.area) > 0 ? num(body.area) : null,
      descripcion: texto(body.descripcion, MAX_TEXTO) || null,
      moneda: body.moneda === "USD" ? "USD" : "UYU",
      tipoCambio: {
        valor: num(tc.valor) > 0 ? num(tc.valor) : 0,
        fecha: typeof tc.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(tc.fecha) ? tc.fecha : null,
        fuente: tc.fuente === "BCU" ? "BCU" : "referencia",
      },
      costoDirecto,
      materiales: num(body.materiales),
      manoObra: num(body.manoObra),
      capitulos,
      pctGG,
      pctBeneficio,
      montoGG,
      montoBeneficio,
      costoTotal,
      iva,
      precioFinal: costoTotal + iva,
      rango: rango ? { minimo: num(rango.minimo), maximo: num(rango.maximo) } : null,
      proporcionBiblioteca:
        typeof body.proporcionBiblioteca === "number" && body.proporcionBiblioteca >= 0 && body.proporcionBiblioteca <= 1
          ? body.proporcionBiblioteca
          : null,
      advertencia: texto(body.advertencia, 600) || null,
    };

    const elemento = React.createElement(EstimacionPDF, props) as Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(elemento);
    const nombreArchivo = `Estimacion-Calculo-Rapido-${new Date().toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      },
    });
  } catch (err) {
    console.error("[POST /api/calcular-rapido/pdf]", err);
    return NextResponse.json({ error: "Error interno generando el PDF" }, { status: 500 });
  }
}
