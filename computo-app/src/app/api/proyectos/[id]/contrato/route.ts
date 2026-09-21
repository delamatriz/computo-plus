import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calcularCostoDirectoAgregado,
  calcularCostosIndirectosAgregados,
  calcularUtilidadAgregada,
  type ApuParaCosto,
} from "@/lib/costoAgregado";

// Precio Final sugerido para prellenar el monto del contrato — misma
// fórmula que "Precio Final" en proyectos/[id]/page.tsx (Costo Directo
// + Costos Indirectos + Utilidad, ×1.22 de IVA), reutilizando
// costoAgregado.ts en vez de reimplementar la cuenta (mismo criterio
// que ya sigue /api/proyectos/[id]/pdf). Es solo una sugerencia inicial
// — el campo monto del contrato queda editable y no se recalcula solo.
async function calcularPrecioFinalSugerido(proyectoId: string): Promise<number | null> {
  const proyecto = await db.proyecto.findUnique({
    where: { id: proyectoId },
    include: {
      capitulos: {
        include: {
          rubros: {
            include: { apu: { include: { materiales: true, manoObra: true, equipos: true } } },
          },
        },
      },
    },
  });
  if (!proyecto) return null;

  const capitulosParaCosto = proyecto.capitulos.map((cap) => ({
    rubros: cap.rubros.map((r) => ({ id: r.id, cantidad: r.cantidad, precioUnit: r.precioUnit })),
  }));
  const apuDataParaCosto: Record<string, ApuParaCosto> = {};
  for (const cap of proyecto.capitulos) {
    for (const r of cap.rubros) {
      if (r.apu) {
        apuDataParaCosto[r.id] = {
          materiales: r.apu.materiales,
          manoObra: r.apu.manoObra,
          equipos: r.apu.equipos,
          aportesPatronalesPct: r.apu.aportesPatronalesPct,
          utilidadPct: r.apu.utilidadPct,
        };
      }
    }
  }

  const costoDirectoAgregado = calcularCostoDirectoAgregado(capitulosParaCosto, apuDataParaCosto);
  const utilidadAgregada = calcularUtilidadAgregada(capitulosParaCosto, apuDataParaCosto);
  const costosIndirectosAgregados = calcularCostosIndirectosAgregados(
    proyecto.modoGastosGenerales,
    proyecto.gastosGeneralesDetallado,
    proyecto.gastosGeneralesPctDefault,
    costoDirectoAgregado.total
  );
  const costoTotalAgregado = costoDirectoAgregado.total + costosIndirectosAgregados + utilidadAgregada;
  return costoTotalAgregado * 1.22;
}

// GET — devuelve el contrato del proyecto (o null si todavía no se
// creó), junto con los datos de "Partes" ya existentes en
// Proyecto/Empresa (de solo lectura, sin duplicar) y el Precio Final
// sugerido para prellenar el monto en el formulario de creación.
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const proyecto = await db.proyecto.findUnique({
      where: { id },
      include: { empresa: true },
    });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const contrato = await db.contratoObra.findUnique({
      where: { proyectoId: id },
      include: { documentos: { orderBy: { createdAt: "asc" } } },
    });

    const precioFinalSugerido = contrato ? null : await calcularPrecioFinalSugerido(id);

    return NextResponse.json({
      contrato,
      partes: {
        cliente: {
          nombre: proyecto.cliente,
          rut: proyecto.clienteRut,
          razonSocial: proyecto.clienteRazonSocial,
          telefono: proyecto.clienteTelefono,
          email: proyecto.clienteEmail,
        },
        empresa: proyecto.empresa
          ? {
              nombre: proyecto.empresa.nombre,
              rut: proyecto.empresa.rut,
              matricula: proyecto.empresa.matricula,
              direccion: proyecto.empresa.direccion,
              telefono: proyecto.empresa.telefono,
              email: proyecto.empresa.email,
            }
          : null,
      },
      precioFinalSugerido,
      monedaProyecto: proyecto.moneda,
    });
  } catch (err) {
    console.error("[GET /api/proyectos/[id]/contrato]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — crea el contrato del proyecto (primera vez). 409 si ya existe
// (usar PATCH para editar uno existente).
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { domicilioComitente, fechaFirma, monto, moneda } = body as {
      domicilioComitente?: string;
      fechaFirma?: string;
      monto?: number | null;
      moneda?: string;
    };

    const proyecto = await db.proyecto.findUnique({ where: { id }, select: { id: true } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const existente = await db.contratoObra.findUnique({ where: { proyectoId: id } });
    if (existente) {
      return NextResponse.json({ error: "Este proyecto ya tiene un contrato" }, { status: 409 });
    }

    const contrato = await db.contratoObra.create({
      data: {
        proyectoId: id,
        domicilioComitente: domicilioComitente?.trim() || null,
        fechaFirma: fechaFirma ? new Date(fechaFirma) : null,
        monto: monto ?? null,
        moneda: moneda === "USD" ? "USD" : "UYU",
      },
      include: { documentos: true },
    });

    return NextResponse.json(contrato, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proyectos/[id]/contrato]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH — edita los campos del contrato ya existente.
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { domicilioComitente, fechaFirma, monto, moneda } = body as {
      domicilioComitente?: string;
      fechaFirma?: string;
      monto?: number | null;
      moneda?: string;
    };

    const existente = await db.contratoObra.findUnique({ where: { proyectoId: id } });
    if (!existente) {
      return NextResponse.json({ error: "Este proyecto todavía no tiene contrato" }, { status: 404 });
    }

    const contrato = await db.contratoObra.update({
      where: { proyectoId: id },
      data: {
        domicilioComitente: domicilioComitente?.trim() || null,
        fechaFirma: fechaFirma ? new Date(fechaFirma) : null,
        monto: monto ?? null,
        moneda: moneda === "USD" ? "USD" : "UYU",
      },
      include: { documentos: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json(contrato);
  } catch (err) {
    console.error("[PATCH /api/proyectos/[id]/contrato]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
