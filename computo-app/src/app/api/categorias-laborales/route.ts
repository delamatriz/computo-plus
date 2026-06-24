import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const categorias = await db.categoriaLaboral.findMany({
      orderBy: { nombre: "asc" },
    });
    return NextResponse.json(categorias);
  } catch (err) {
    console.error("[GET /api/categorias-laborales]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const cambios: { id: string; jornal: number }[] = body.categorias;

    if (!Array.isArray(cambios)) {
      return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
    }

    await Promise.all(
      cambios.map((c) =>
        db.categoriaLaboral.update({
          where: { id: c.id },
          data: { jornal: c.jornal },
        })
      )
    );

    const categorias = await db.categoriaLaboral.findMany({
      orderBy: { nombre: "asc" },
    });
    return NextResponse.json(categorias);
  } catch (err) {
    console.error("[PATCH /api/categorias-laborales]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
