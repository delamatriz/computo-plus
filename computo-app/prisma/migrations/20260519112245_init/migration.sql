-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "logo" TEXT,
    "matricula" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Proyecto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "cliente" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'UYU',
    "tipo" TEXT NOT NULL DEFAULT 'VIVIENDA',
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "descripcion" TEXT,
    "fechaInicio" DATETIME,
    "empresaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Proyecto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Capitulo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#2563EB',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "proyectoId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Capitulo_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Rubro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "cantidad" REAL NOT NULL DEFAULT 0,
    "precioUnitario" REAL NOT NULL DEFAULT 0,
    "tipo" TEXT NOT NULL DEFAULT 'GLOBAL',
    "capituloId" TEXT NOT NULL,
    "recetaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Rubro_capituloId_fkey" FOREIGN KEY ("capituloId") REFERENCES "Capitulo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Rubro_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "Receta" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Receta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidad" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RecetaComponente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "material" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "cantidad" REAL NOT NULL,
    "precio" REAL NOT NULL,
    "recetaId" TEXT NOT NULL,
    CONSTRAINT "RecetaComponente_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "Receta" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CategoriaLaboral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "jornal" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jornalBase" REAL NOT NULL DEFAULT 0,
    "aportesBPS" REAL NOT NULL DEFAULT 0.785,
    "margenEmpresa" REAL NOT NULL DEFAULT 0.20,
    "margenImprevistos" REAL NOT NULL DEFAULT 0.05,
    "iva" REAL NOT NULL DEFAULT 0.22,
    "monedaDefault" TEXT NOT NULL DEFAULT 'UYU',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_rut_key" ON "Empresa"("rut");
