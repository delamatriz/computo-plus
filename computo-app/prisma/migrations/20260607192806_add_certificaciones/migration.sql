-- CreateTable
CREATE TABLE "Certificacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proyectoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT '',
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Certificacion_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CertificacionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificacionId" TEXT NOT NULL,
    "rubroId" TEXT NOT NULL,
    "porcentajeAvance" REAL NOT NULL DEFAULT 0,
    "cantidadEjecutada" REAL,
    CONSTRAINT "CertificacionItem_certificacionId_fkey" FOREIGN KEY ("certificacionId") REFERENCES "Certificacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CertificacionItem_rubroId_fkey" FOREIGN KEY ("rubroId") REFERENCES "Rubro" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CertificacionItem_certificacionId_rubroId_key" ON "CertificacionItem"("certificacionId", "rubroId");
