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
