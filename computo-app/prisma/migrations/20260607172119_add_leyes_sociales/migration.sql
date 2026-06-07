-- CreateTable
CREATE TABLE "LeyesSociales" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proyectoId" TEXT NOT NULL,
    "tipoContratante" TEXT NOT NULL DEFAULT 'empresa',
    "montoImponibleMO" REAL NOT NULL DEFAULT 0,
    "aucPct" REAL NOT NULL DEFAULT 0.714,
    "focerPatronalPct" REAL NOT NULL DEFAULT 0.075,
    "fscFocapPct" REAL NOT NULL DEFAULT 0.010,
    "fosvocPct" REAL NOT NULL DEFAULT 0.005,
    "frlPct" REAL NOT NULL DEFAULT 0.002,
    "fondoGarantiaPct" REAL NOT NULL DEFAULT 0.005,
    "snisAdicionalPct" REAL NOT NULL DEFAULT 0.005,
    "focerPersonalPct" REAL NOT NULL DEFAULT 0.030,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeyesSociales_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LeyesSociales_proyectoId_key" ON "LeyesSociales"("proyectoId");
