-- CreateTable
CREATE TABLE "PrecioMTOP" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidadUnidad" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "cantidad" REAL NOT NULL,
    "precioConIva" REAL NOT NULL,
    "precioUnitario" REAL NOT NULL,
    "numeroLista" INTEGER NOT NULL DEFAULT 599,
    "fechaLista" TEXT NOT NULL DEFAULT '2025-11',
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PrecioMTOP_codigo_key" ON "PrecioMTOP"("codigo");
