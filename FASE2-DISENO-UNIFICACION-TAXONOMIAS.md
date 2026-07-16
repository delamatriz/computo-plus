# Fase 2 — Diseño: unificación de taxonomías de capítulo/subcapítulo

**Estado: documento de diseño. Nada de esto está implementado. Cero cambios de código o de datos de producción hasta que se apruebe un enfoque.**

Fecha: 15/07/2026. Preparado a partir de la auditoría de capítulos de esta sesión (Aberturas, Adherencia, Membranas, Patología de Fachada, Ascensor, Equipamiento/Obra Exterior, rename/delete de capítulo).

---

## 0. Hallazgo clave antes de diseñar nada

El pedido original hablaba de **3** taxonomías paralelas. Auditando el código encontré que en realidad hay **5 lugares independientes** donde un nombre de capítulo puede originarse o validarse, cada uno con su propia lista y su propia lógica de comparación:

| # | Fuente | Dónde vive | Qué contiene | Comparación usada |
|---|---|---|---|---|
| 1 | `CapituloEstandar` | tabla DB | 30 nombres canónicos + manuales | `nombre` exacto (case-sensitive, `@unique`) |
| 2 | `SubrubroEstandar.capitulo`/`.subcapitulo` | tabla DB | 18 capítulos / 31 combinaciones reales | string suelto, sin FK |
| 3 | `CAPITULOS_SAU` | hardcodeado en `page.tsx` | alias → capítulo(s) SAU + recortes de subcapítulo | `.toLowerCase().trim()` exacto |
| 4 | Prompt de `sugerir-capitulos` | hardcodeado en `route.ts` | **lista de 18 nombres, distinta de la #1** (ej. "Instalaciones embutidas", "Calefacción" no existen en ningún otro lado) | ninguna — la IA devuelve texto libre |
| 5 | Hardcodes puntuales | `seguridadAltura.ts`, `rubrosAutomaticos.ts` | 1 nombre fijo ("Seguridad y Trabajos en Altura") + fuzzy-match contra IA | exacto / `includes()` |

**Esto explica el origen real de los nombres "sucios"** que veníamos parchando toda la sesión: "Mampostería y muros", "Revoques y enlucidos", "Instalación sanitaria" (minúscula) no son errores de tipeo del usuario — son literalmente lo que la lista hardcodeada del punto **#4** le devuelve a la IA cuando arma un proyecto nuevo. Mientras esa lista exista y sea distinta de la #1, **el problema se sigue regenerando solo en cada proyecto nuevo creado por IA**, aunque migremos todo lo demás.

Esto no cambia el objetivo del pedido, pero sí el alcance real: unificar bien implica tocar el prompt de IA también, no solo `page.tsx` y las tablas de biblioteca.

---

## 1. Modelo de datos propuesto

La tensión de fondo: el usuario ya puede (recién lo agregamos) renombrar libremente el capítulo de un proyecto — eso es correcto y no se toca. El problema no es "los nombres deberían ser fijos", es que **hoy no hay ningún identificador estable** para conectar "este capítulo de este proyecto" con "esta entrada de la biblioteca", así que todo se resuelve por coincidencia de texto en tiempo de ejecución.

Propuesta: separar **nombre para mostrar** (libre, como ya es) de **identidad de catálogo** (estable, FK).

```prisma
model CapituloCatalogo {
  id            String   @id @default(cuid())
  nombre        String   @unique
  orden         Int
  activo        Boolean  @default(true)
  subcapitulos  SubcapituloCatalogo[]
  subrubros     SubrubroEstandar[]
  capitulosReales Capitulo[]   // proyectos que se linkearon a este catálogo
}

model SubcapituloCatalogo {
  id                 String   @id @default(cuid())
  capituloCatalogoId String
  capituloCatalogo   CapituloCatalogo @relation(fields: [capituloCatalogoId], references: [id])
  nombre             String
  orden              Int
  subrubros          SubrubroEstandar[]
  @@unique([capituloCatalogoId, nombre])
}

model SubrubroEstandar {
  // ... campos existentes ...
  capituloId     String
  capitulo       CapituloCatalogo     @relation(fields: [capituloId], references: [id])
  subcapituloId  String?
  subcapitulo    SubcapituloCatalogo? @relation(fields: [subcapituloId], references: [id])
  // capitulo/subcapitulo (String, String?) actuales: se mantienen en paralelo
  // durante la migración (ver Etapa 2), se eliminan recién en Etapa 6.
}

model Capitulo {
  // ... campos existentes, nombre sigue siendo el campo libre que se muestra ...
  capituloCatalogoId String?              // nullable — no todo capítulo de proyecto tiene un match limpio
  capituloCatalogo   CapituloCatalogo?    @relation(fields: [capituloCatalogoId], references: [id])
}
```

Puntos de diseño:

- **`CapituloCatalogo.nombre` es único** — a diferencia de `CapituloEstandar` hoy, que permite duplicados case-sensitive ("Instalación Sanitaria" y "instalación sanitaria" conviven como dos filas). La migración es la oportunidad de limpiar eso de una vez.
- **`Capitulo.capituloCatalogoId` es nullable.** Un capítulo de proyecto con nombre "Mi fase rara de obra" simplemente no tiene catálogo — "Ver subrubros típicos" no aparece para él, igual que hoy pasa cuando `obtenerMapeoSAU` no encuentra alias. No es una regresión, es el mismo comportamiento actual con una FK en vez de un string-match.
- **`SubrubroEstandar` no pierde el string viejo de entrada** — correr en paralelo columna vieja + FK nueva es lo que hace reversible cada etapa (ver sección 4).

---

## 2. Plan de migración de datos

### 2a. Biblioteca (`SubrubroEstandar`) — 18 capítulos / 31 combinaciones

Semilla de `CapituloCatalogo` a partir de los 18 valores reales que ya existen (no de los 30 de `CapituloEstandar` — esos 30 casi no calzan con la biblioteca real, ver auditoría previa: solo 7/30 tenían match limpio). Concretamente:

1. Script de migración lee `distinct(capitulo)` de `SubrubroEstandar` (18 valores) y `distinct(capitulo, subcapitulo)` (31 combinaciones) — ya los tengo relevados de esta sesión.
2. Crea un `CapituloCatalogo` por cada uno de los 18, un `SubcapituloCatalogo` por cada subcapítulo real (los que hoy son `null` quedan sin subcapítulo, no se inventa ninguno).
3. Setea `capituloId`/`subcapituloId` en cada `SubrubroEstandar` por igualdad exacta de string contra lo recién creado — es 1:1 por construcción, no hay ambigüedad posible en este paso porque el catálogo se generó *desde* estos mismos datos.

Riesgo: **bajo**. No hay pérdida ni duplicación posible — es una copia estructurada de datos que ya existen, no una reconciliación contra una lista externa.

### 2b. Proyectos existentes (HOGAR, Matisse Monet) — la parte delicada

Acá sí hay una decisión real. Dos caminos:

| | **Camino A — solo backfill best-effort, nombre intacto** | **Camino B — migrar también el nombre a canónico** |
|---|---|---|
| Qué hace | Deja `Capitulo.nombre` tal cual está (texto libre, como ya funciona hoy con rename). Agrega `capituloCatalogoId` con un match automático (reusando el alias de `CAPITULOS_SAU` una sola vez, como script de migración, no como dependencia en tiempo de ejecución) y revisión manual de lo que no matcheó. | Además de lo anterior, reemplaza el `nombre` guardado por el nombre canónico del catálogo. |
| Con HOGAR/Matisse Monet | ~23 y ~7 capítulos respectivamente (30 total). Con el alias ya armado, la mayoría matchea limpio; algunos (nombres inventados por el usuario, tipo "Trabajos preliminares") quedan `capituloCatalogoId: null` y listos para revisar a mano — son pocos, la revisión es de minutos. | Igual, pero además "Instalación sanitaria" pasaría a mostrarse como "Instalación Sanitaria" sin que el usuario lo haya pedido. |
| Riesgo | Bajo — nadie ve cambiar nada en la pantalla de un proyecto viejo. | Medio — cambia el PDF/Excel exportado de un proyecto ya entregado a un cliente, sin que nadie lo pidiera. Choca directo con la funcionalidad de rename que acabamos de construir (¿para qué dejamos renombrar libre si la migración va a pisarlo?). |
| Beneficio extra sobre A | Ninguno funcional — el FK ya resuelve la biblioteca sin tocar el nombre. | Ninguno real — es prolijidad cosmética a cambio de tocar datos de proyectos reales sin necesidad. |

**Recomendación: Camino A.** No hay ganancia funcional en forzar el nombre canónico — el problema que estamos resolviendo es "conectar con la biblioteca", y eso lo resuelve el FK solo. Forzar el nombre es open un frente de riesgo (proyectos ya entregados) sin ningún beneficio que lo justifique, y contradice la razón de ser del rename que ya implementamos.

### 2c. ¿Qué queda de `CAPITULOS_SAU`?

**No se puede eliminar del todo — pero sí reducir de ~20 entradas a 2 o 3.** La razón de fondo no es técnica, es del dominio: la nomenclatura SAU agrupa "Albañilería" como un solo capítulo grande que en la práctica uruguaya a veces se reparte en varias fases de proyecto (Muros, Revoques, Pisos, Impermeabilizaciones como capítulos separados). Esa partición **es lógica de negocio real**, no deuda técnica — va a seguir haciendo falta un lugar que diga "estos subcapítulos del catálogo van a esta fase, aquellos a esta otra".

Lo que sí desaparece es todo lo que hoy es puro ruido:
- La resolución de alias por nombre difuso (`"Pisos, Zócalos y Revestimientos"` → mapea a `"Albañilería"` por string) — se reemplaza por el FK `capituloCatalogoId` ya resuelto en la migración 2b.
- Los `subcapitulos`/`excluirSubcapitulos` como arrays de strings a mano — se reemplazan por una tabla chica de "particiones" (ver abajo), y cualquier subcapítulo nuevo que no esté explícitamente particionado cae automático al capítulo "paraguas" sin tocar código (mismo criterio que ya usamos hoy para Albañilería).

Quedaría algo así, del tamaño de ~2-3 filas en vez de ~20:

```prisma
// Solo para capítulos de catálogo que en la práctica se reparten entre
// varios capítulos de proyecto — hoy son 2: Albañilería y Subcontratos-
// Acondicionamientos. Todo subcapítulo de ese capítulo de catálogo que
// NO esté acá cae por defecto en el capítulo de proyecto "paraguas".
model ParticionSubcapitulo {
  id                  String @id @default(cuid())
  subcapituloId       String @unique
  capituloCatalogoDestinoNombre String  // ej. "Pisos, Zócalos y Revestimientos"
}
```

Esto es una reducción real de la deuda (de "20 entradas de alias con lógica ad-hoc, hay que acordarse de tocarlas" a "2-3 filas de datos, se agregan solas cuando se define un subcapítulo nuevo con esa partición"), pero no es "cero configuración" — el dominio no lo permite.

---

## 3. Impacto y riesgo — mapa completo de dependencias

Revisé cada punto de la app que toca alguna de las 5 fuentes. Clasificado por riesgo real de romperse con la migración:

### 🟢 Riesgo bajo — agrupan por `capituloId` (FK real), no por nombre

No dependen de ninguna taxonomía de texto — ya usan la relación real y no se tocan en esta migración:

- `SeccionCronograma.tsx` (Gantt, agrupa por `capitulo.id`)
- `SeccionCertificaciones.tsx` (agrupa por `rubro.capituloId`)
- `SeccionComparativoOfertas.tsx` (agrupa por `capituloId`)
- `SeccionResumenPresupuesto.tsx`, exportación Excel, exportación PDF (`PresupuestoPDF.tsx`, `/api/proyectos/[id]/pdf`), `lista-materiales-pdf`, `leyes-sociales` (suma sobre todos los rubros del proyecto sin filtrar por nombre de capítulo), `actualizar-precios-indice` (itera capítulos por relación, no por nombre)
- `memoria-descriptiva` (solo interpola `cap.nombre` como texto en un prompt de IA, sin lógica de matching)

### 🟡 Riesgo medio — dependen de coincidencia de texto, pero acotado y ya semi-resuelto por el diseño

- **`page.tsx` — `CAPITULOS_SAU`/`obtenerMapeoSAU`/`abrirSubrubrosPanel`**: el corazón de lo que venimos parchando. Se resuelve con las Etapas 3 y 5 de este plan.
- **`/proyectos/nuevo/page.tsx`**: usa `CapituloEstandar` para el checklist de "capítulos sugeridos" al crear proyecto, y `registrarCapituloManual` para agregar nombres libres — sigue funcionando igual, solo que el catálogo detrás cambia de forma (Etapa 1 no le afecta la UI).
- **`/api/subrubros-estandar/route.ts`**: el `GET` filtra por `capitulo` string — pasa a aceptar `capituloId` en paralelo (Etapa 3), no rompe nada existente hasta que se saque el string.
- **`/api/proyectos/[id]/detectar-faltantes/route.ts`**: la IA devuelve un `capitulo` de texto libre («"capitulo" debe coincidir con el nombre de un capítulo existente cuando corresponda, o proponer uno nuevo»). No depende de ningún catálogo — sigue funcionando igual, sin cambios necesarios.

### 🔴 Riesgo alto — hardcodes que se rompen o duplican si el nombre canónico cambia

- **`lib/seguridadAltura.ts`**: `NOMBRE_CAPITULO = "Seguridad y Trabajos en Altura"` fijo, compara `.toLowerCase() ===`. Si el nombre canónico de catálogo para ese concepto cambiara en la migración, esta función dejaría de detectar el capítulo existente y **crearía uno duplicado** en cada proyecto nuevo. Mitigación: no renombrar ese capítulo en el catálogo (dejar exactamente ese string), o mejor, migrar esta función a usar `capituloCatalogoId` también (Etapa 7).
- **`lib/rubrosAutomaticos.ts`**: hace fuzzy-match (`===` + `includes()` en ambos sentidos) entre lo que sugiere la IA y `proyecto.capitulos` reales — no depende del catálogo directamente, pero es la misma clase de lógica ad-hoc que estamos tratando de sacar de `page.tsx`. Candidato a unificar en la Etapa 7, no bloqueante para el resto.
- **`/api/sugerir-capitulos/route.ts`**: prompt de IA con lista hardcodeada de 18 nombres, **distinta** de `CapituloEstandar`. Esta es la fuente real de los nombres "sucios" que vemos en Matisse Monet. Si no se toca, va a seguir generando proyectos nuevos con nombres que no calzan con el catálogo — Etapa 7.

---

## 4. Plan de ejecución por etapas

Cada etapa es aditiva y reversible hasta la 5; la 6 es la única puerta de un solo sentido (borra columnas viejas) y se hace deliberadamente al final, con margen de confianza construido antes.

| Etapa | Qué hace | Riesgo | Verificación antes de seguir | Rollback |
|---|---|---|---|---|
| **1** | Crear tablas `CapituloCatalogo`/`SubcapituloCatalogo`, sembrar desde los 18/31 valores reales de biblioteca (2a). Cero cambio de comportamiento — nadie lee estas tablas todavía. | Nulo | Query de conteo: 18 capítulos, 31 combinaciones, coinciden con la auditoría de esta sesión | `DROP TABLE` — nada depende de ellas aún |
| **2** | Agregar `capituloId`/`subcapituloId` (nullable) a `SubrubroEstandar`, backfill 1:1 (columnas viejas de texto se mantienen intactas). | Bajo | Comparar, para cada fila, que `capituloCatalogo.nombre === capitulo` (string viejo) — 100% deben coincidir por construcción | Poner las columnas nuevas en `null` de nuevo, o `DROP COLUMN` |
| **3** | Cambiar `/api/subrubros-estandar` y `abrirSubrubrosPanel` para resolver por `capituloId`/`subcapituloId` en vez de string — **CAPITULOS_SAU sigue existiendo**, solo cambia qué usa del lado de la biblioteca. | Medio | En vivo, repetir la prueba de esta sesión: HOGAR (paraguas Albañilería, Pisos, Impermeabilizaciones, Equipamiento, Obra Exterior) + Matisse Monet (Mampostería y muros, Revoques y enlucidos) — mismos conteos que hoy | Revertir el commit — las columnas viejas siguen ahí, nada se perdió |
| **4** | Agregar `capituloCatalogoId` (nullable) a `Capitulo` real. Script de backfill: reusa el alias de `CAPITULOS_SAU` **una sola vez**, contra los ~30 capítulos reales de HOGAR + Matisse Monet. Revisión manual de los que queden en `null`. | Bajo | Listado de qué capítulo de cada proyecto matcheó a qué catálogo, revisado a mano antes de continuar | Poner la columna en `null` de nuevo |
| **5** | Reemplazar la resolución por alias de nombre en `abrirSubrubrosPanel`/`obtenerMapeoSAU` por lookup directo de `capituloCatalogoId`, + la tabla chica `ParticionSubcapitulo` para los ~2 casos de reparto (Albañilería, Acondicionamientos). Acá es donde `CAPITULOS_SAU` se reduce de ~20 entradas a 2-3 filas de datos. | **Alto — etapa crítica** | Repetir en vivo la batería completa de pruebas de esta sesión contra los dos proyectos reales, capítulo por capítulo, antes y después. Además probar `/proyectos/nuevo` de punta a punta (crear un proyecto nuevo, que sugiera capítulos, que "Ver subrubros típicos" funcione en el primer uso) | Revertir el commit — `CAPITULOS_SAU` viejo queda en el historial de git, se puede restaurar tal cual |
| **6** | Eliminar las columnas de texto viejas (`SubrubroEstandar.capitulo`/`.subcapitulo` como String) una vez confirmado que nada las lee. | Alto (irreversible sin restore) | Grep exhaustivo de que ningún código lee esas columnas + al menos una semana de uso real sin incidentes desde la Etapa 5 | Solo restore desde backup — por eso se hace al final y sin apuro |
| **7** *(opcional, no bloqueante)* | Unificar `sugerir-capitulos` (prompt IA) y `seguridadAltura.ts` para resolver contra el catálogo nuevo en vez de listas hardcodeadas propias. Resuelve la causa raíz de por qué se siguen generando nombres "sucios" en proyectos nuevos. | Medio | Crear 2-3 proyectos de prueba vía el flujo de IA, confirmar que los capítulos sugeridos ya calzan con el catálogo sin necesitar match difuso | Revertir el commit |

Cada etapa: backup de producción antes de aplicar, script idempotente, verificación en vivo contra HOGAR y Matisse Monet antes de pasar a la siguiente — mismo criterio que usamos en toda la sesión de hoy.

---

## 5. Estimación de alcance

Tomando como vara el ritmo de hoy (cada una de las tareas de esta sesión — Patología de Fachada, dinamizar el paraguas, Equipamiento/Jardín, rename/delete — llevó del orden de una sesión de trabajo enfocada con verificación en vivo incluida):

| Etapas | Sesiones estimadas | Por qué |
|---|---|---|
| 1 + 2 (schema + backfill biblioteca) | 1 sesión | Aditivo puro, sin ambigüedad, ya tengo los 18/31 valores relevados |
| 3 (switch de biblioteca a FK) | 1 sesión | Requiere repetir todas las verificaciones en vivo de hoy, pero la lógica ya está probada en esta sesión |
| 4 (backfill `Capitulo` real) | 1 sesión | Dataset chico (2 proyectos, ~30 capítulos), pero la revisión manual de lo no-matcheado no se puede apurar |
| 5 (switch de runtime, `CAPITULOS_SAU` reducido) | **2 sesiones** | Es la etapa crítica — mayor incertidumbre, más superficie de prueba (dos proyectos reales + flujo de creación de proyecto nuevo) |
| 6 (drop de columnas viejas) | 1 sesión corta, **con espera intermedia** | Técnicamente simple, pero deliberadamente no pegada a la Etapa 5 — conviene dejar pasar tiempo de uso real antes de cerrar la puerta |
| 7 (opcional — IA) | 1 sesión, no bloqueante | Puede hacerse en cualquier momento después de la Etapa 1, no depende de las etapas 3-6 |

**Total: 6-7 sesiones de trabajo del mismo calibre que las de hoy**, sin contar la Etapa 7 si se decide hacerla. No recomendaría comprimirlas en menos tiempo — la Etapa 6 en particular se beneficia de esperar antes de ejecutarse.

---

## Decisiones que quedan para Luis y el usuario

1. ¿Confirman el **Camino A** de la sección 2b (no tocar `nombre` de proyectos existentes, solo backfill de FK)?
2. ¿De acuerdo con reducir `CAPITULOS_SAU` a una tabla `ParticionSubcapitulo` de ~2-3 filas en vez de eliminarlo del todo (sección 2c)? La alternativa sería forzar que ningún capítulo de catálogo se reparta nunca entre varios capítulos de proyecto — pero eso significaría fusionar "Mampostería y muros"/"Revoques y enlucidos"/etc. en un solo "Albañilería" combinado también en Matisse Monet, lo cual sería un cambio de datos en un proyecto real que hoy nadie pidió.
3. ¿La Etapa 7 (unificar el prompt de IA de `sugerir-capitulos` y `seguridadAltura.ts`) entra en el alcance de esta fase, o se deja para después? Sin ella, el problema se sigue regenerando en cada proyecto nuevo creado por IA.
4. ¿Arrancamos por la Etapa 1, o quieren revisar/ajustar el modelo de datos de la sección 1 primero?
