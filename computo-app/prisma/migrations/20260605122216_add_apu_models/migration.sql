/*
  Warnings:

  - You are about to drop the column `precioUnitario` on the `Rubro` table. All the data in the column will be lost.
  - You are about to drop the column `recetaId` on the `Rubro` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Proyecto" ADD COLUMN "area" REAL;
ALTER TABLE "Proyecto" ADD COLUMN "direccion" TEXT;

-- CreateTable
CREATE TABLE "APU" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gastosGeneralesPct" REAL NOT NULL DEFAULT 15,
    "utilidadPct" REAL NOT NULL DEFAULT 10,
    "rubroId" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "APU_rubroId_fkey" FOREIGN KEY ("rubroId") REFERENCES "Rubro" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaterialAPU" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "rendimiento" REAL NOT NULL,
    "precioUnit" REAL NOT NULL DEFAULT 0,
    "dosificacion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "apuId" TEXT NOT NULL,
    CONSTRAINT "MaterialAPU_apuId_fkey" FOREIGN KEY ("apuId") REFERENCES "APU" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComponenteAPU" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "rendimientoPorUnidad" REAL NOT NULL,
    "precioUnit" REAL NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "materialId" TEXT NOT NULL,
    CONSTRAINT "ComponenteAPU_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialAPU" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManoObraAPU" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoria" TEXT NOT NULL,
    "jornadaHs" REAL NOT NULL DEFAULT 8,
    "rendimiento" REAL NOT NULL,
    "jornalRef" REAL NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "apuId" TEXT NOT NULL,
    CONSTRAINT "ManoObraAPU_apuId_fkey" FOREIGN KEY ("apuId") REFERENCES "APU" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipoAPU" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "rendimiento" REAL NOT NULL,
    "costoUnit" REAL NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "apuId" TEXT NOT NULL,
    CONSTRAINT "EquipoAPU_apuId_fkey" FOREIGN KEY ("apuId") REFERENCES "APU" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Rubro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "cantidad" REAL NOT NULL DEFAULT 0,
    "precioUnit" REAL NOT NULL DEFAULT 0,
    "tipo" TEXT NOT NULL DEFAULT 'GLOBAL',
    "capituloId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Rubro_capituloId_fkey" FOREIGN KEY ("capituloId") REFERENCES "Capitulo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Rubro" ("cantidad", "capituloId", "codigo", "createdAt", "descripcion", "id", "tipo", "unidad", "updatedAt") SELECT "cantidad", "capituloId", "codigo", "createdAt", "descripcion", "id", "tipo", "unidad", "updatedAt" FROM "Rubro";
DROP TABLE "Rubro";
ALTER TABLE "new_Rubro" RENAME TO "Rubro";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "APU_rubroId_key" ON "APU"("rubroId");
