# CURRENT_SPRINT

## Backups de la base de datos (producción)

Contexto: la base gratuita de Render expiró y estuvo a punto de perder
datos. Se migró a un plan pago (**Basic-256mb**), que además de más
recursos habilita backups automáticos. Como capa extra, no dependemos
solo de eso — hay un script de backup manual para correr a mano.

### 1. Backup automático de Render (ya viene con el plan pago)

No hay que activar nada — es automático desde que la instancia dejó de
ser Free. Se ve y se gestiona en el dashboard de Render → tu base de
datos → pestaña **"Recovery"**:

- **Point-in-Time Recovery (PITR)** — restaura la base a cualquier
  momento dentro de la ventana de recuperación. La ventana depende del
  **plan de workspace** de la cuenta (no del tipo de instancia de la
  base): *Hobby* → últimos 3 días, *Pro o superior* → últimos 7 días.
  Revisar qué plan de workspace tiene la cuenta para saber cuál aplica.
- **Backups lógicos (export manual)** — botón "Create export" en la
  misma pestaña. Se retienen 7 días, sin importar el plan de workspace.

Para un incidente reciente (borrado accidental, migración que salió
mal hace poco), el PITR de Render suele ser el camino más simple —
restaura desde el dashboard sin tocar nada manualmente.

### 2. Backup manual (capa extra, no depende de Render)

Script: [`computo-app/scripts/backup-db.ts`](computo-app/scripts/backup-db.ts).
Hace un `pg_dump` completo (esquema + datos) de la base apuntada por
`DATABASE_URL` y lo guarda con fecha y hora en el nombre.

```bash
cd computo-app
npx tsx scripts/backup-db.ts
```

- El archivo queda en `computo-app/backups/computo-plus-<fecha>.sql`
  (esa carpeta está en `.gitignore` — los dumps no se versionan).
- Requiere `pg_dump` instalado (PostgreSQL 18 client tools). Si no
  está en el PATH, definir `PG_DUMP_PATH` con la ruta completa al
  ejecutable.

**⚠️ Correr este script antes de cualquier cambio grande en la base**
(migraciones de esquema, scripts de corrección masiva, etc.) — por
ejemplo, antes de la migración de modo de costeo Alquilado/Propio de
equipos.

### 3. Cómo restaurar desde un backup manual (procedimiento a alto nivel)

1. Preferir primero el PITR de Render (punto 1) si aplica — es más
   rápido y no requiere pasos manuales.
2. Si hace falta restaurar desde un archivo `.sql` de
   `computo-app/backups/`:
   - Crear una base nueva (o vaciar la existente — con cuidado, esto
     borra lo que haya) donde se va a restaurar.
   - Ejecutar: `psql "<DATABASE_URL de destino>" < backups/computo-plus-<fecha>.sql`
   - Actualizar `DATABASE_URL` en `.env`/`.env.local` (y en Render, si
     corresponde) para que apunte a esa base.
   - Verificar en la app que los datos se vean correctos antes de dar
     por terminada la restauración.

## Pendientes de producto (sin definir modelo — no bloqueantes)

### Ensayos de laboratorio en obras de gran porte

Para obras de mayor escala, incorporar al presupuesto el costo de ensayos
de control de calidad:
- Ensayo de probetas de hormigón a compresión (UNIT-NM 101) — por lote de
  hormigonado, edades típicas 7 y 28 días, cobrado por laboratorio (LATU
  u otros)
- Eventualmente: control de acero (tracción de barras), ensayo de suelos
  (ya está listado en capítulos pendientes)

Nota de modelado: estos costos no escalan linealmente por m3 de hormigón —
escalan por cantidad de lotes/elementos críticos. Se parecen más a un ítem
global/por lote que a un rendimiento por unidad de rubro.

Decisión de producto pendiente: ¿se carga como rubro editable manual
(el arquitecto lo agrega si la obra lo amerita), o se sugiere
automáticamente cuando el volumen de hormigón estructural supera un
umbral? Definir umbral de "gran porte" si se va por la segunda opción.

Estado: 🔲 Anotado, sin definir modelo. No es bloqueante para el sprint
actual.

## Jornales SUNCA — RESUELTO

Los 5 jornales base (Peón, Medio oficial, Oficial, Oficial especializado,
Capataz) y todas las categorías extendidas (Ayudante, Peón práctico,
trabajo en altura, oficios especializados, etc.) están actualizados según
el convenio Grupo 9 Subgrupo 01, ajuste 1° abril 2025 (+5,95%), vigencia
abril 2025 - marzo 2026. Aplicado en commit 4eaec8b (4 de julio de 2026),
incluyendo recálculo de jornalRef en 22 rubros de proyectos reales ya
existentes. Configuracion.convenioFechaVigente = 2025-04-01.

Fuente verificada por dos caminos independientes: Acta de ajuste salarial
Grupo 9.01 (MTSS) y fuentes secundarias cruzadas, ambas coincidentes en
los valores de Cat. V y VII.

⚠️ Pendiente de seguimiento (no bloqueante): el convenio 2023-2026 venció
el 31 de marzo de 2026. El SUNCA aprobó su plataforma reivindicativa el
27 de mayo de 2026; las negociaciones con las cámaras empresariales
(CCU, APPCU, Liga de la Construcción, CICE) siguen en curso ante la
Dinatra/MTSS. Hasta que se firme un nuevo convenio, los valores de abril
2025 siguen vigentes. Revisar y actualizar en cuanto se cierre el
convenio 2026.

## Radar de materiales nuevos y tendencias de mercado

**✅ COMPLETADO — 5 de 5 items agregados a biblioteca (11/07/2026)**

Productos/técnicas que estaban ganando terreno en obra y que la
biblioteca no cubría como subrubro estándar — los 5 items relevados ya
están cargados. Quedan solo dos pendientes menores (mallas de refuerzo
puntuales, ver nota consolidada más abajo) y un ítem fuera de alcance
del radar original (revoque grueso/fino premezclados por separado, sin
combinar).

- [x] ✅ Revoques premezclados 2 en 1 / 3 en 1 (URUMIX, Weber Promex E,
      Ultramix, etc.) — reemplazan grueso+fino(+hidrófugo) en una sola
      aplicación de ~15mm. Consumo real relevado: 25-30 kg/m2 exterior.
      **Agregado a biblioteca (11/07/2026)**: códigos 6.2.5b (REVOQUE
      MONOCAPA INTERIOR 2 EN 1, junto a 6.2.4/6.2.5) y 6.2.10b (REVOQUE
      MONOCAPA EXTERIOR 3 EN 1, junto a 6.2.10) — conviven con los
      tradicionales, no los reemplazan. Mano de obra: reducción del 33%
      (dato de fábrica confirmado solo para el 3en1, extrapolado por
      analogía al 2en1 — estimación, no dato de fabricante para ese
      producto puntual) sobre la mano de obra combinada grueso+fino ya
      validada en biblioteca.
      Malla de fibra de vidrio: ver nota consolidada de mallas pendientes
      más abajo, junto a la de 6.8.3.

- [ ] Revoque grueso y fino premezclados por separado (no combinado) —
      según relevamiento de Luis, hoy casi no se arma la mezcla en obra;
      se compra premezclada aunque sea por capas separadas.

- [x] ✅ Puentes de adherencia químicos (ej. SikaTop Modul) — para unir
      revoque/mortero nuevo sobre superficie vieja o poco porosa.
      Insumo líquido, consumo bajo (referencias de productos similares
      Sika rondan 0,15-0,175 kg/m2).
      **Agregado a biblioteca (11/07/2026)**: dos códigos distintos, no
      variantes de lo mismo — 6.8.1 PUENTE DE ADHERENCIA PARA MORTERO
      (SikaTop Modul, $133,07/m2) y 6.8.2 PUENTE DE ADHERENCIA PARA
      HORMIGÓN (Sikadur 32 Gel, $1.324,12/m2 — uso acotado a
      reparaciones puntuales, no superficies grandes). Nuevo subcapítulo
      "Puentes de Adherencia" en Albañilería.
      **Pendiente**: SikaTop Modul también puede usarse como aditivo en
      el agua de amasado del mortero (dosificación por volumen de
      mezcla, no por m2) — no cubierto por el código actual, evaluar
      como ítem aparte si se necesita.

- [x] ✅ Puentes de impermeabilización cementicios (ej. SikaTop Seal-107) —
      revestimiento impermeable bicomponente, bolsa 25kg + líquido.
      Uso: subsuelos, muros de contención, fosos de ascensor, piscinas,
      cubiertas con agua. Se cruza con capítulos pendientes de
      Impermeabilizaciones y Ascensor.
      **Agregado a biblioteca (11/07/2026)**: 6.8.3 PUENTE DE
      IMPERMEABILIZACIÓN (SikaTop Seal-107, $911,80/m2) — aplicación a
      llana (2 capas, dentada + lisa), presión normal de agua (fosos de
      ascensor, muros de contención, subsuelos residenciales — no
      tanques bajo alta columna de agua). Agrupado junto a 6.8.1/6.8.2
      en el subcapítulo "Puentes de Adherencia". Aplicación con
      pinceleta es alternativa válida para superficies chicas o
      retoques (mismo consumo de material por fórmula, mano de obra
      distinta) — no modelada como código aparte.

**Pendiente de decisión de diseño (consolidado) — mallas de refuerzo
puntuales**: dos casos con el mismo tipo de decisión repetida, para
resolver juntos en vez de por separado:
- Malla de fibra de vidrio (revoque monocapa 3en1, código 6.2.10b) —
  se usa en encuentros entre materiales distintos (mampostería-hormigón),
  no en toda la superficie.
- Malla Tejido-107 (puente de impermeabilización SikaTop Seal-107,
  código 6.8.3) — se usa en encuentros de planos (bandas de 30-40cm),
  no en toda la superficie. Sin precio de referencia relevado.

En ambos casos falta decidir si se modelan como línea opcional dentro
del mismo código o como subrubro aparte — ninguno de los dos está
incluido en su código base actual.

- [x] ✅ Membranas líquidas impermeabilizantes (ej. SikaFill-100/Elástico/400,
      Sikalastic-560) — impermeabilización de techos/terrazas, aplicación
      en frío, monocomponente. Rendimiento: 0,8-1,5 kg/m2 sin refuerzo,
      2,8-3 kg/m2 con malla de refuerzo (fisuras/detalles). Cruza directo
      con el capítulo pendiente de Impermeabilizaciones.
      **Agregado a biblioteca (11/07/2026)**: tres códigos nuevos, nuevo
      subcapítulo "Membranas Líquidas" en Albañilería —
      6.9.1 MEMBRANA LÍQUIDA SIKAFILL ELÁSTICO (techos/terrazas,
      $1.017,28/m2), 6.9.2 MEMBRANA LÍQUIDA SIKALASTIC-560 SISTEMA
      COMPLETO con refuerzo Sika Tex-TRAMA ($1.248,97/m2) y 6.9.3
      MEMBRANA LÍQUIDA SIKALASTIC-560 BÁSICO sin refuerzo ($784,77/m2).
      Sika Tex-TRAMA se incluyó como línea de material en 6.9.2 (a
      diferencia de las mallas puntuales de abajo) porque es parte del
      sistema estándar recomendado oficialmente por Sika para el 560.
      **Precio completado (12/07/2026)**: $2.979/rollo (25m x 1,05m,
      26,25 m2 de cobertura) → $113,49/m2 de malla, cargado en
      PrecioMTOP (código MAT-SIKA-TEXTRAMA).

  Nota general: ninguno de estos productos tiene dosificación en el MTOP
  2006 (son productos de marca posteriores/no contemplados). Se modelan
  como insumo único (producto comercial) + rendimiento de ficha técnica,
  no como descomposición cemento/arena/cal. Precio de referencia: no está
  en Lista MTOP N°599, requiere relevamiento de precio de mercado real al
  momento de cargarlos.

## Patología de fachada — nuevo subcapítulo en Albañilería (15/07/2026)

**✅ COMPLETADO** — flujo completo de patología de fachada: Hidrolavado
(diagnóstico/limpieza previa) → Saneado (retiro de partes flojas) →
Tratamiento de hierros expuestos → Limpieza final de obra. Nuevo
subcapítulo "Patología de Fachada" en Albañilería (siguiente numeración
libre después de 6.9 Membranas Líquidas). Script:
[`computo-app/scripts/seed-patologia-fachada.ts`](computo-app/scripts/seed-patologia-fachada.ts).

- **Equipo nuevo en catálogo**: Hidrolavadora — $1.200/día (referencia
  UY, equipo semi-profesional tipo Karcher HD 6/15). Código
  `EQ-HIDROLAVADORA`, unidad "día" (mismo criterio que "Andamio
  tubular", que ya usa "m2/mes" en vez de horas).

- **6.10.1 HIDROLAVADO DE FACHADA** (M2) — sin materiales. Equipo:
  Hidrolavadora, 1 día cada 110 m2. Mano de obra: Oficial albañil y
  Peón, 0,0727 hs/m2 cada uno (coincide con el rendimiento del equipo:
  ambos trabajan al ritmo de ~110 m2/día). $59,40/m2.

- **6.10.2 SANEADO DE REVOQUES Y HORMIGONES EN FACHADA** (M2) — sin
  materiales ni equipos cargados en el código base (silleta con
  arnés/andamio/balancín se agregan aparte según la obra, vía el
  buscador de equipos ya disponible en el catálogo). Mano de obra:
  Oficial trabajo en altura y Peón, 0,4571 hs/m2 cada uno. La línea de
  Peón usa la categoría "Peón" (jornal normal, sin recargo) — el
  convenio SUNCA no tiene variante de altura para Peón (ver
  seed-jornales-sunca-2025.ts), solo Oficial y Medio oficial reciben el
  10%. La nota del código aclara que la tarea es en altura. $304,16/m2.

- **6.10.3 TRATAMIENTO DE HIERROS EXPUESTOS (SikaTop Armatec-108)** (ML)
  — material 0,17 kg/ml (kit 5kg, $810/kg). Mano de obra: Oficial
  albañil, 0,175 hs/ml. $240,95/ml.

- **6.10.4 LIMPIEZA FINAL DE OBRA (entrega)** (M2) — insumos cargados
  como una sola línea genérica "Insumos de limpieza final" ($17,50/m2,
  punto medio del rango $15-20 — bolsas de residuos + líquido
  limpiavidrios + paños sin desglosar). Mano de obra: Peón, 0,1778
  hs/m2. No incluye retiro de escombros (tarea aparte). $65,84/m2.

Todos los rendimientos de mano de obra y equipos son estimaciones
cruzadas con fichas técnicas/precios de mercado, no datos de la Lista
MTOP (no existen en ese documento) — mismo criterio que los productos
Sika de sesiones anteriores.

**Cambio de código acompañante (15/07/2026, ya resuelto de raíz — ver
sección siguiente)**: en su momento hubo que sumar "Patología de
Fachada" a mano al whitelist de subcapítulos de la entrada paraguas de
Albañilería en `page.tsx` — mismo paso manual que ya había hecho falta
para Aberturas, Puentes de Adherencia y Membranas Líquidas. Se dinamizó
ese mismo día para que no vuelva a hacer falta (ver abajo).

## Subcapítulos de Albañilería en "Ver subrubros típicos" — dinamizado (15/07/2026)

**✅ COMPLETADO.** `CAPITULOS_SAU` en
[page.tsx:96-156](computo-app/src/app/proyectos/[id]/page.tsx:96) es un
mapeo hardcodeado entre el nombre de capítulo del proyecto y
`SubrubroEstandar.capitulo`/`subcapitulo`. Cada vez que se agregaba un
subcapítulo nuevo a la biblioteca de Albañilería (Aberturas, Adherencia,
Membranas, Patología de Fachada — las 4 veces de esta sesión), había que
acordarse de sumarlo a mano a la lista fija de la entrada paraguas
"Albañilería", o quedaba invisible en "Ver subrubros típicos".

Diagnóstico previo (antes de tocar código): de los 30 capítulos del
catálogo estándar (`CapituloEstandar`), solo 7 (23%) coinciden textualmente
con `SubrubroEstandar.capitulo`; 12 requieren el alias de `CAPITULOS_SAU`
para resolver mismatches de texto (ej. "Estructura de Hormigón Armado"
vs. "Estructura"), y 11 todavía no tienen biblioteca cargada. Además el
nombre de capítulo de proyecto es texto libre (`registrarCapituloManual`
en `/proyectos/nuevo`) — confirmado con variantes reales en los dos
proyectos existentes (HOGAR, Matisse Monet): "Trabajos preliminares",
"Instalación sanitaria" en minúscula, "Mampostería y muros", "Herrería y
metálica", "Revoques y enlucidos", "Pintura". Por eso **el array de
alias (`capitulos: string[]`) se dejó intacto** — resuelve un problema
real de datos sucios que una consulta dinámica por nombre exacto no
resolvería.

Lo que sí se dinamizó es la lista `subcapitulos` de la entrada paraguas
de Albañilería ([page.tsx:135-142](computo-app/src/app/proyectos/[id]/page.tsx:135)):
en vez de listar a mano qué subcapítulos mostrar, ahora se calcula
`excluirSubcapitulos` — Pisos/Revestimientos e Impermeabilizaciones,
los únicos dos recortes angostos que **coexisten** con "Albañilería"
como capítulo de proyecto aparte dentro de un mismo proyecto (HOGAR
tiene los tres capítulos a la vez). Todo lo demás (Muros, Revoques,
Aberturas, Adherencia, Membranas, Patología de Fachada, y cualquier
subcapítulo nuevo que se agregue a futuro) pasa automáticamente por el
paraguas sin tocar código.

⚠️ Ojo con esto si se toca de nuevo: en un primer intento se excluyeron
también Muros y Revoques (por tener sus propias entradas "Mampostería y
muros"/"Revoques y enlucidos" en `CAPITULOS_SAU`), pero se detectó que
esos dos alias son usados por Matisse Monet, que **no** tiene un
capítulo "Albañilería" combinado — mientras que HOGAR sí lo tiene y no
tiene capítulos separados de Muros/Revoques. Cada proyecto usa un
esquema de nombres u otro, nunca los dos a la vez, así que no hay
duplicación real que evitar ahí — excluirlos del paraguas rompía HOGAR
(pasaba de mostrar ~54 códigos a 12, perdiendo Muros y Revoques sin que
ningún otro capítulo los mostrara). Verificado con los dos proyectos
reales: HOGAR (paraguas=48, Pisos=34, Impermeabilizaciones=15, sin
duplicados) y Matisse Monet (Mampostería y muros=18, Revoques y
enlucidos=18). Probado también agregando un subcapítulo de prueba
temporal a la base — apareció solo en el paraguas sin cambios de código,
y se borró después.

## Botón "Agregar capítulo" — RESUELTO (15/07/2026)

**✅ COMPLETADO.** El botón al pie del presupuesto
([page.tsx:3464](computo-app/src/app/proyectos/[id]/page.tsx:3464)) no
tenía `onClick` — no hacía nada al clickearlo. Se cableó reusando el
patrón ya existente en `SeccionPartidasFaltantes.tsx` (mismo endpoint
`POST /api/proyectos/[id]/capitulos`, sin tocar el backend): pide el
nombre con `window.prompt()` (sin modal nuevo — arreglo acotado, no
amerita más), si se cancela o queda vacío no hace nada, si hay texto
crea el capítulo y hace `window.location.reload()`. Verificado en HOGAR:
cancelar no crea nada, con nombre se creó al final (orden correcto) y
se confirmó visualmente antes de borrarlo.

⚠️ **Hallazgo nuevo detectado al verificar**: no existe ningún endpoint
`DELETE` para capítulos (`/api/capitulos/[id]/route.ts` solo tiene
`PATCH` para fechaInicio/fechaFin) — tuve que borrar el capítulo de
prueba directo en la base con un script. Si se crea un capítulo por
error (nombre mal tipeado, etc.) hoy no hay forma de eliminarlo desde
la UI. Ya estaba anotado que tampoco se puede renombrar uno después de
creado — juntando ambos: la única forma de "arreglar" un capítulo mal
creado hoy es manualmente en la base.

## "Equipamiento" vs. "Obra Exterior / Jardín" — RESUELTO (15/07/2026)

**✅ COMPLETADO.** Ambos capítulos de proyecto mapeaban al mismo capítulo
de biblioteca ("Subcontratos - Acondicionamientos") sin ningún recorte
por subcapítulo — mostraban exactamente la misma lista completa de 32
códigos, mezclando equipamiento de baño/cocina con césped/piscina/deck.
Luis confirmó que el problema era de contenido, no solo de mapeo: no
había ninguna separación limpia esperando ser aprovechada. Script:
[`computo-app/scripts/reclasificar-acondicionamientos.ts`](computo-app/scripts/reclasificar-acondicionamientos.ts).

Diagnóstico de los 32 códigos: 16 claramente Equipamiento (baño, cocina,
mesadas, grifería), 7 claramente Obra Exterior/Jardín (césped, deck,
piscina, toldo, etc.), 3 limítrofes de interior (piso técnico, cortinas
blackout/veneciana — se optó por Equipamiento) y **6 que no eran ni una
cosa ni la otra**: estaban en el capítulo equivocado por completo.

**PASO A — movidos a su capítulo real** (verificado antes: ninguno
estaba clonado en un Rubro de HOGAR ni Matisse Monet, cero impacto en
proyectos reales):
- 7.2.8 (Cámara de inspección) → Instalación Sanitaria
- 7.2.17 (Puesta eléctrica/datos) → Instalación Eléctrica
- 7.2.19, 7.2.20 (Equipos Split) → Instalación Térmica / Aire Acondicionado
- 7.2.30, 7.2.31 (Ascensores) → Ascensor (primer subrubro que existe bajo
  ese capítulo — no tenía ninguno antes)

✅ **Duplicado detectado — RESUELTO (15/07/2026).** 7.2.8 "CÁMARA DE
INSPECCIÓN CON TAPA Y CONTRATAPA 60x60cm" quedó en Instalación
Sanitaria junto a `sanitaria-014` ("...con sifón desconector") y
`sanitaria-015` ("...sin sifón"). Comparé los tres APUEstandar
completos: **7.2.8 y sanitaria-015 son el mismo producto** (mismos 4
materiales con los mismos rendimientos exactos, misma mano de obra
0,5/0,5 — la única diferencia era cosmética: unidad "GL" vs "U" y que
sanitaria-015 nunca tuvo precio calculado). `sanitaria-014` (con sifón
desconector) es un producto distinto y legítimo (material extra real +
mano de obra más lenta, 0,4) — no se toca. Ninguno de los tres estaba
en uso en Rubros reales de HOGAR ni Matisse Monet.

Se desactivó `sanitaria-015` (`activo: false`, no se borró — mismo
criterio que los duplicados de contrapiso/demolición de sesiones
anteriores). 7.2.8 queda como única fuente de verdad activa para la
cámara sin sifón. Script:
[`computo-app/scripts/desactivar-duplicado-camara-inspeccion.ts`](computo-app/scripts/desactivar-duplicado-camara-inspeccion.ts).

**PASO B — subcapitulo dentro de "Subcontratos - Acondicionamientos"**
(26 códigos restantes): "Equipamiento" (19) y "Obra Exterior / Jardín"
(7) — antes 0 de los 32 tenían subcapitulo cargado.

**PASO C — `CAPITULOS_SAU`** ([page.tsx:159-166](computo-app/src/app/proyectos/[id]/page.tsx:159)):
se agregó `subcapitulos: ["Equipamiento"]` y `subcapitulos: ["Obra
Exterior / Jardín"]` a las entradas existentes (mismo patrón liviano que
Pisos/Impermeabilizaciones), y una entrada nueva `{ alias: ["Ascensor"],
capitulos: ["Ascensor"] }` que no existía — sin ella, los 2 ascensores
movidos hubiesen quedado bien guardados pero invisibles en "Ver
subrubros típicos" (mismo problema resuelto antes para Patología de
Fachada).

Verificado en HOGAR: "Equipamiento" = 19 códigos (todos con subcapítulo
"Equipamiento", sin mezcla), "Obra Exterior / Jardín" = 7 códigos (todos
"Obra Exterior / Jardín"), Instalación Sanitaria pasó de 20 a 21 códigos
sin romper los existentes, Instalación Eléctrica y Térmica igual.
Probado también creando un capítulo "Ascensor" temporal en HOGAR (con el
botón recién arreglado) — mostró los 2 códigos correctamente — y se
borró después.

## Fase 2 — Unificación de taxonomías de capítulo (16/07/2026)

Ver [`FASE2-DISENO-UNIFICACION-TAXONOMIAS.md`](FASE2-DISENO-UNIFICACION-TAXONOMIAS.md)
para el diseño completo (Etapas 1-7). Etapas 1 y 2 (catálogo canónico
`CapituloCatalogo`/`SubcapituloCatalogo` + backfill de FK en
`SubrubroEstandar`) ya cerradas en sesiones anteriores.

- [x] Fase 2 — Etapa 3: filtro server-side por capituloId/subcapituloId en
  /api/subrubros-estandar y abrirSubrubrosPanel, con fallback a string
  (commit ec8e8d5)
- [x] Deuda técnica — helper crearSubrubroEstandar() centralizado en
  src/lib/subrubroEstandar.ts; migrados los 2 bulk loaders reusables
  (seed-subrubros-sau.ts, seed-subrubros-faltantes.ts) para resolver
  capituloId/subcapituloId automáticamente al crear. Los 10 scripts
  históricos de biblioteca no se tocaron (ya cumplieron su función).
- [x] Fase 2 — Etapa 4: capituloCatalogoId (nullable) agregado a Capitulo
  real + lados inversos en CapituloCatalogo/SubcapituloCatalogo + modelo
  ParticionSubcapitulo creado (con FK reales, corregido respecto al boceto
  original del documento de diseño — ver nota abajo). Backfill aplicado:
  25/30 capítulos reales matcheados (19 HOGAR + 6 Matisse Monet), 5 en null
  sin forzar (Imprevistos x2, Conexiones de Servicios, Seguridad y Trabajos
  en Altura, Gastos Generales de Obra). Cero cambio de comportamiento en
  runtime — puramente aditivo. Commit 056e8a5.

- [x] Brecha de biblioteca detectada durante Etapa 4: la biblioteca hoy solo
  tiene capítulo de catálogo para carpintería metálica (dentro de
  "Subcontratos - Carpinterías"). No existe capítulo separado para Herrería
  Estructural ni Herrería de Obra (hierro estructural — pilares, vigas,
  pórticos / varillas y estribos de hormigón armado). **RESUELTO
  (18/07/2026)** — ver "Herrería de Obra + Estructura Metálica" más abajo.

- [x] Fase 2 — Etapa 5: switch de runtime en abrirSubrubrosPanel — resuelve
  por Capitulo.capituloCatalogoId + ParticionSubcapitulo en vez de alias de
  nombre, con fallback intacto a CAPITULOS_SAU cuando la FK es null.
  ParticionSubcapitulo corregida a capituloRealDestino (string) en vez de
  FK a CapituloCatalogo — un mismo catálogo se reparte entre varios
  capítulos reales (Albañilería → Pisos/Impermeabilizaciones/Muros/
  Revoques; Subcontratos-Carpinterías → Herrería; Subcontratos-
  Acondicionamientos → Equipamiento/Obra Exterior), poblada con esos 7
  casos. `resolverCapituloCatalogoId()` (src/lib/capituloCatalogoResolver.ts)
  cierra el agujero de creación: POST /api/proyectos y POST
  /api/proyectos/[id]/capitulos ahora resuelven la FK en el momento de
  crear el capítulo, ya no depende solo de backfill posterior.
  `CAPITULOS_SAU`/`obtenerMapeoSAU` se movieron a src/lib/capitulosSau.ts
  (módulo compartido cliente/servidor) — el array en sí **no se tocó**,
  sigue con sus ~24 entradas intacto como red de seguridad; el recorte
  real queda para una revisión aparte, en otra sesión.
  Bug encontrado y corregido en el camino: la exclusión del paraguas
  inicialmente excluía un subcapítulo con solo que existiera su fila en
  `ParticionSubcapitulo`, sin chequear si el capítulo real de destino
  existía en el proyecto actual — rompía Albañilería en HOGAR (48→12,
  perdía todo Muros/Revoques porque HOGAR no tiene esos capítulos
  separados). Corregido: solo excluye si el destino existe como capítulo
  real en el proyecto que se está viendo. Verificado en vivo: 8/8 checks
  de paraguas/partición (Albañilería=48, Impermeabilizaciones=15,
  Equipamiento=19, Obra Exterior=7, Mampostería y muros=18, Revoques y
  enlucidos=18, Carpintería incluye Hierro, Herrería y metálica=solo
  Hierro) + 4/4 checks de resolución al crear vía POST directo (match,
  no-match sin bloquear, alta de capítulo en proyecto existente).
  Commit 3460ce7.

  ⚠️ **Hallazgo aparte, no bloqueante**: `/proyectos/nuevo` queda
  colgado en "Cargando…" en el entorno de desarrollo local (Suspense
  alrededor de `useSearchParams()` que nunca resuelve — cero requests al
  servidor más allá del HTML inicial). Confirmado ajeno a la Etapa 5 (el
  archivo no importa nada de lo tocado esta sesión) y reproducible tras
  reiniciar el server y borrar `.next` por completo. Por eso el Paso 1 se
  verificó pegándole directo a los endpoints (`POST /api/proyectos` y
  `POST /api/proyectos/[id]/capitulos`) en vez de a través de esa página.
  Intenté confirmar si también se reproduce en producción
  (computo-plus.onrender.com) pero el navegador de la sesión dio timeout
  las 4 veces que lo intenté — quedó sin confirmar. `curl` sí mostró que
  producción responde (200 en ~22s) y devuelve el mismo shell inicial con
  "Cargando…", pero eso no prueba nada por sí solo (es el comportamiento
  normal de un Suspense boundary antes de hidratar). **Pendiente**:
  confirmar a mano en un navegador real si `/proyectos/nuevo` carga en
  producción o se cuelga igual que en dev, para decidir si es prioridad.

- [x] Fase 2 — Etapa 6a: migradas las 3 dependencias ACTIVAS (no fallback,
  no históricas) que un diagnóstico previo encontró leyendo/escribiendo
  `SubrubroEstandar.capitulo`/`.subcapitulo` (string) como campo de
  negocio real, paso previo obligatorio antes de poder borrar esas
  columnas en la Etapa 6b:
  - `POST /api/subrubros-estandar` (guarda en background los rubros que
    el usuario crea, vía `guardarEnBibliotecaGlobal`): la validación
    contra la biblioteca, el fallback "Sin clasificar" y el dedup pasan a
    basarse en `capituloId` (resuelto con el mismo
    `resolverCapituloCatalogoId()` de la Etapa 5), no en comparar strings
    a mano. Dos rubros sin match siguen dedupeando entre sí — mismo
    bucket `capituloId: null` que antes compartía el string "Sin
    clasificar", mismo comportamiento de siempre.
  - `esImplantacion` (separa equipos de obra en su propia sección dentro
    del panel de "Implantación y Replanteo"): compara `capituloId` contra
    el id de ese capítulo resuelto una vez desde el catálogo ya cacheado,
    con fallback silencioso al string si no se pudiera resolver.
  - Label de subcapítulo bajo cada subrubro en el panel: ahora muestra
    `subcapituloNombre`, resuelto vía la relación `subcapituloCatalogo`
    en el GET, no el string directo.
  Las columnas `capitulo`/`subcapitulo` de `SubrubroEstandar` **siguen
  existiendo** — se siguen escribiendo igual que siempre, en paralelo. Se
  eliminan recién en la Etapa 6b (sesión aparte). Verificado en vivo:
  POST directo (match con capituloId resuelto, dedup por capituloId,
  no-match sin bloquear con warning logueado), panel de Implantación y
  Replanteo (separación de equipos intacta), labels de subcapítulo en
  Pisos (Contrapisos / Pisos, Zócalos y Otros). `tsc`/build limpios.
  Commit b3c1f27.

  Nota para la Etapa 6b: el diagnóstico previo a la 6a también encontró
  que borrar las columnas string va a romper la compilación de ~50
  scripts históricos en `scripts/`/`prisma/` que las leen (sobre todo
  para `console.log` informativo) — hay que decidir si se borran, se
  excluyen del build, o se corrigen antes de tocar el schema.

- [x] Fase 2 — Etapa 6b: eliminadas `SubrubroEstandar.capitulo`/
  `.subcapitulo` (String) del schema — `capituloId`/`subcapituloId` (FK a
  `CapituloCatalogo`/`SubcapituloCatalogo`) quedan como única fuente de
  verdad.
  - `crearSubrubroEstandar()` ya no escribe `capitulo`/`subcapitulo` en el
    upsert (solo las FK, ya resueltas ahí mismo).
  - Los 3 fallbacks por string que quedaban (GET `?capitulo=`, la rama
    fallback completa de `abrirSubrubrosPanel` por alias de
    `CAPITULOS_SAU`, y el fallback silencioso de `esImplantacion`) se
    eliminaron por completo — único camino ahora: `capituloCatalogoId` +
    `ParticionSubcapitulo`. `CAPITULOS_SAU`/`obtenerMapeoSAU`
    (`src/lib/capitulosSau.ts`) ya no se consumen en el cliente — el único
    consumidor que queda es `resolverCapituloCatalogoId()` en el servidor
    (Etapa 5, al crear un capítulo real).
  - **43 scripts históricos borrados** (ya aplicados contra producción,
    sin otro valor: 7 de corrección + `reclasificar-acondicionamientos`,
    6 creadores puntuales Sika/patología/aberturas/revoque, 4 creadores
    `seed-apus-equipos-obra/equipamiento/carpinteria-metalica/
    yeso-cielorrasos`, 25 `seed-apus-*` de fallback de lectura para
    adjuntar `APUEstandar`).
  - **2 scripts archivados** (no borrados, valor documental de cómo se
    hicieron las Etapas 1 y 2): `backfill-fk-catalogo-subrubros.ts` y
    `seed-catalogo-canonico.ts` → `scripts/_archivo-fase2/`, excluidos de
    `tsc --noEmit` vía `tsconfig.json` (`scripts/` sí estaba dentro del
    scope de tsc, a diferencia de `npm run build` que no los tocaba).
  Backup de producción antes de aplicar (irreversible sin restore).
  Verificado en vivo: 8/8 checks de paraguas/partición (mismos valores de
  siempre), 5/5 capítulos sin `capituloCatalogoId` siguen sin mostrar "Ver
  subrubros típicos" (mismo comportamiento, ya no por fallback sino porque
  no queda código que lo intente), alta de rubro con alias conocido
  funcionando end-to-end sin columnas string. `tsc`/build limpios. Commit
  e5b0a14.

- [x] Fase 2 — Etapa 7 (última etapa): unificadas las dos piezas que
  quedaban con lista/lógica propia separada del catálogo canónico.
  - `CapituloCatalogo` pasa de 18 a **19 filas** — se agregó "Seguridad y
    Trabajos en Altura" (`scripts/seed-capitulo-catalogo-seguridad-altura.ts`),
    un capítulo que nunca tuvo biblioteca de subrubros propia (sus rubros
    siempre se arman a mano según la modalidad de altura declarada) — la
    fila existe solo para que pueda resolver `capituloCatalogoId`.
  - `lib/seguridadAltura.ts` (`generarCapituloSeguridad()`): ahora resuelve
    y setea `capituloCatalogoId` al crear el capítulo. La idempotencia
    quedó chequeando **las dos señales** (FK O nombre string), no solo la
    FK — necesario para no duplicar el capítulo en proyectos ya existentes
    (HOGAR) que lo tienen creado desde antes de esta migración, con
    `capituloCatalogoId: null`.
  - `api/sugerir-capitulos/route.ts`: la lista de 19 nombres que la IA usa
    para sugerir capítulos se reemplazó por sus canónicos exactos del
    catálogo. Variantes que apuntaban al mismo capítulo real se colapsaron
    en una sola entrada ("Mampostería y muros"/"Revoques y
    enlucidos"/"Revestimientos y pisos" → "Albañilería"; "Carpintería"/
    "Herrería y metálica" → "Subcontratos - Carpinterías") para que la IA
    no sugiera el mismo capítulo repetido dentro de la misma lista. El
    caso ambiguo ("Movimiento de tierra y fundaciones", que antes resolvía
    a `null` por apuntar a 2 capítulos a la vez) se separó en sus 2
    capítulos reales ("Excavaciones y Movimientos de Tierra" +
    "Cimentaciones"). Las 5 categorías sin biblioteca (Instalación de gas,
    Instalaciones embutidas, Calefacción, Honorarios profesionales,
    Imprevistos) quedan igual — correcto que resuelvan
    `capituloCatalogoId: null`, no tienen subrubros clasificables.
  - `CAPITULOS_SAU`/`obtenerMapeoSAU` (`src/lib/capitulosSau.ts`) **no se
    tocó** — queda como fallback silencioso sin uso activo en el camino
    feliz, disponible por si aparece un caso borde futuro.
  Backup de producción antes de aplicar. Verificado en vivo: 19 filas en
  `CapituloCatalogo`, plan de seguridad en proyecto de prueba resuelve
  `capituloCatalogoId` sin duplicar en una 2da corrida, `sugerir-capitulos`
  probado con 3 descripciones de obra distintas sin duplicados de
  "Albañilería"/"Subcontratos - Carpinterías", proyecto de prueba completo
  con los 15 capítulos sugeridos resolvió 12/15 automáticamente (los 3
  restantes son las categorías sin biblioteca, correctos en `null`).
  `tsc`/build limpios. Commit ef39317.

**Fase 2 (unificación de taxonomías de capítulo) queda completa —
Etapas 1 a 7 cerradas.** Ver
[`FASE2-DISENO-UNIFICACION-TAXONOMIAS.md`](FASE2-DISENO-UNIFICACION-TAXONOMIAS.md)
para el diseño original completo.

## Expansión de biblioteca — Instalación de Gas y Contra Incendio (17/07/2026)

**✅ COMPLETADO.** Script:
[`computo-app/scripts/seed-gas-incendio.ts`](computo-app/scripts/seed-gas-incendio.ts).

- **2 `CapituloCatalogo` nuevos**: "Instalación de Gas" (orden 19) y
  "Contra Incendio" (orden 20) — `CapituloCatalogo` pasa de 19 a 21 filas.
- **Instalación de Gas — 8 códigos** (gas-001 a gas-008): puntos de gas,
  cañería de cobre 1/2"/3/4", llave de paso, medidor (caja + regulador,
  no incluye el medidor que provee la compañía), soporte de tanque de
  supergás, ventilación reglamentaria, prueba de hermeticidad y
  habilitación (requiere técnico matriculado).
- **Contra Incendio — 9 códigos** (incendio-001 a incendio-009):
  extintores PQS/CO2, BIE completa, detector de humo, central de
  detección, sirena, señalética de evacuación, puerta cortafuego,
  rociador automático (sprinkler).
- Los 17 códigos con `APUEstandar` completo (materiales + mano de obra).
  `precioUY` calculado con la misma fórmula que usa `clonar-apu`
  (costoDirecto × 1.15 × 1.10) — el script histórico que hacía este
  recálculo por separado se había borrado en la Etapa 6b, así que se
  resuelve acá directamente para no dejar precios en 0.
- **Categoría laboral nueva**: "Oficial Gasista" — mismo jornal que
  Electricista oficial/Plomero oficial ($2.767,81, tarifa de oficial
  especializado del convenio SUNCA ya parametrizada, no se inventó un
  número nuevo).
- **28 `PrecioMTOP` nuevos** — materiales de gas/incendio no cubiertos
  por la Lista MTOP N°599, con precios de referencia de mercado uruguayo
  2026-07. Quedan marcados como precio a verificar por el mismo mecanismo
  que ya usa toda la biblioteca (`fechaBase`/`fechaLista` → "actualizar
  con ICCV" en la UI), sin flag nuevo.
- `aportesSociales` queda en 0 (default) en los 17 — campo heredado de la
  importación SAU original, no usado en ningún cálculo real, mismo
  criterio que el resto de altas manuales de esta sesión.
- Verificado en vivo: dry-run revisado antes de aplicar (incluyendo
  recálculo manual puntual de gas-008, que dio $7.002,56/GL — confirmado
  sin error de fórmula, solo refleja 2 jornadas completas de Oficial
  Gasista matriculado para la prueba de hermeticidad + habilitación).
  Post-aplicación: 21 filas en `CapituloCatalogo` (sin duplicados), 17
  `SubrubroEstandar` con `APUEstandar` asociado, "Ver subrubros típicos"
  probado en proyecto de prueba — 8 códigos en Instalación de Gas, 9 en
  Contra Incendio, ambos con `capituloCatalogoId` resuelto automáticamente
  al crear el capítulo (Etapa 5). Proyecto de prueba borrado. `tsc`/build
  limpios.

## Expansión de biblioteca — Ascensor (18/07/2026)

**✅ COMPLETADO.** Script:
[`computo-app/scripts/seed-ascensor.ts`](computo-app/scripts/seed-ascensor.ts).
No se creó `CapituloCatalogo` nuevo — reusa "Ascensor" (ya existía, con
2 `SubrubroEstandar`: 7.2.30/7.2.31).

- **5 códigos de capacidad nuevos** (7.2.32 a 7.2.36), mismo patrón llave
  en mano que 7.2.30/7.2.31 (1 línea de material "ascensor completo
  instalado" + mano de obra simbólica de Oficial especializado):
  7.2.32 (4p/4 paradas), 7.2.33 (6p/8 paradas), 7.2.34 (8p/6 paradas),
  7.2.35 (10p/8 paradas), 7.2.36 (camillero, 10p/6 paradas, uso
  hospitalario/PH). Precios de referencia escalados con un modelo lineal
  exacto (`precio = k1×personas + k2×paradas`) resuelto a partir de los 2
  puntos conocidos (7.2.30/7.2.31) — no son valores sueltos inventados.
- **4 ítems nuevos que rodean al ascensor** (`ascensor-001` a
  `ascensor-004`), patrón APU completo (materiales + MO reales):
  impermeabilización de foso (reusa "Membrana asfáltica con geotextil",
  PrecioMTOP código 270, ya usado en 6.6.8/6.6.9/6.6.12/cubierta-009),
  terminación de sala de máquinas (reusa "Revoque premezclado 2 en 1"),
  habilitación y certificación UNIT (trámite, sin MO propia), y contrato
  de mantenimiento anual — esta última marcada explícitamente en su
  descripción como "línea opcional, gasto recurrente post-entrega, no
  parte del costo de construcción".
- **7 `PrecioMTOP` nuevos** (no 6 como se estimó al planificar): los 5 de
  capacidad + habilitación UNIT + mantenimiento anual — los 2 últimos
  también necesitaban su propio `PrecioMTOP` para no clonar en $0 al
  usar "clonar-apu" (mismo criterio aplicado a los 5 de capacidad).
- `precioUY` calculado con la misma fórmula que `clonar-apu` (costoDirecto
  × 1.15 × 1.10). `aportesSociales` queda en 0 (default), mismo criterio
  que el resto de la biblioteca agregada esta sesión.
- Verificado en vivo: dry-run revisado antes de aplicar. Post-aplicación:
  11 `SubrubroEstandar` activos en "Ascensor" (2 previos + 9 nuevos,
  confirmado vía `GET /api/subrubros-estandar?capituloId=...`, mismo
  endpoint que usa "Ver subrubros típicos"). Prueba end-to-end de
  "clonar-apu" sobre 7.2.32 en un rubro de proyecto de prueba: el
  material resolvió a $574.565,31 (no $0) y el precio final del rubro dio
  $901.889,10 — coincide exacto con el `precioUY` calculado. Proyecto de
  prueba borrado. `tsc`/build limpios.

⚠️ **Hallazgo aparte, no corregido (fuera de alcance de esta tarea)**:
7.2.30 y 7.2.31 (los 2 códigos de Ascensor preexistentes, cargados en el
import SAU 2022) **no tienen ningún `PrecioMTOP` asociado** — su
`precioUY` se cargó directo en ese import, sin pasar por el lookup en
vivo que usa `clonar-apu`. Si hoy se clona cualquiera de esos 2 códigos a
un rubro real, el material resuelve a $0 (`precioMTOP?.precioUnitario ??
0` en `clonar-apu/route.ts`) y solo sobrevive el costo de mano de obra
simbólica — muy por debajo del precio real de un ascensor instalado.
Pendiente: cargar un `PrecioMTOP` para esos 2 códigos (mismo patrón que
los 5 nuevos) si se van a usar en un proyecto real.

## Impermeabilización pasa a CapituloCatalogo standalone + expansión Vidrios (18/07/2026)

**✅ COMPLETADO.** Script:
[`computo-app/scripts/seed-impermeabilizacion-vidrios.ts`](computo-app/scripts/seed-impermeabilizacion-vidrios.ts).
`CapituloCatalogo` pasa de 21 a **22 filas**.

- **"Impermeabilizaciones y Aislaciones" deja de ser un subcapítulo de
  Albañilería repartido vía `ParticionSubcapitulo`** (Etapa 5) y pasa a
  ser su propio `CapituloCatalogo` standalone (orden 21), con **4
  subcapítulos nuevos**: "Preparación y Aislación Complementaria" (7
  códigos existentes), "Membranas Asfálticas y Sistema Tradicional" (2
  existentes + `imperm-001`/`imperm-002` nuevos), "Impermeabilización de
  Muros y Cimientos" (5 existentes), "Cementicia, Membranas Líquidas y
  Sistemas Premium" (4 códigos Sika migrados desde sus subcapítulos
  propios en Albañilería — `6.8.3` Puente de Impermeabilización SikaTop
  Seal-107, `6.9.1`/`6.9.2`/`6.9.3` Membranas Líquidas Sika — + 3
  nuevos). Total: **23 `SubrubroEstandar` activos** (14 migrados + 4 Sika
  migrados + 5 nuevos). Los códigos existentes **no se renumeraron**
  (mismo criterio que Ascensor/Vidrios: el código es un identificador
  histórico del SAU, no depende de qué capítulo lo agrupe).
- **3 códigos nuevos genuinamente premium** (investigados, sin precio
  MTOP posible por ser productos de marca): `imperm-001` tradicional
  multicapa (imprimación + 2 fieltros asfálticos en caliente,
  $1.014,63/m2 — mano de obra intensiva, +13% sobre la estimación
  inicial, aceptado sin forzar el número), `imperm-002` membrana
  transitable con protección granular ($2.086,53/m2), `imperm-003`
  cristalización tipo Xypex/Penetron ($2.197,37/m2), `imperm-004`
  poliurea proyectada ($3.492,06/m2), `imperm-005` membrana sintética
  PVC/TPO monocapa ($2.202,22/m2).
- **`6.6.13` "Colocación de tejas coloniales"** — reclasificado a
  "Cubierta / Techos": estaba mal clasificado en el import SAU original
  (no es impermeabilización).
- **Impacto de Etapa 5 resuelto**: borrada la fila de
  `ParticionSubcapitulo` (ya no hace falta, el capítulo no comparte
  catálogo con nadie), borrados los 2 `SubcapituloCatalogo` huérfanos de
  Albañilería ("Impermeabilizaciones y Aislaciones" y "Membranas
  Líquidas" — "Puentes de Adherencia" queda intacto con `6.8.1`/`6.8.2`),
  re-backfill del único `Capitulo` real que usaba este nombre (HOGAR) a
  `capituloCatalogoId` del catálogo nuevo, y actualización de
  [`capitulosSau.ts`](computo-app/src/lib/capitulosSau.ts) (alias
  apunta al capítulo nuevo; confirmado que `subcapitulos`/
  `excluirSubcapitulos` ya eran código muerto para el cliente desde la
  Etapa 6b — el único consumidor activo de `CAPITULOS_SAU` es
  `resolverCapituloCatalogoId()`, que solo lee `capitulos`).
- **Vidrios y Espejos — 7 códigos nuevos** (de 7 a 14 total, sigue flat
  sin subcapítulos): DVH 4-9-4mm ($3.200,17/m2), DVH 4-12-4mm
  ($3.499,03/m2), DVH con Low-E ($4.794,07/m2), vidrio solar/control
  solar simple ($2.397,72/m2), DVH con control solar ($5.192,55/m2),
  vidrio laminado de seguridad PVB 3+3mm ($2.098,86/m2), vidrio templado
  10mm ($6.675,66/m2, extrapolado linealmente de 6mm/8mm existentes).
- **14 `PrecioMTOP` nuevos** (reutilizados "Imprimación asfáltica" y
  "Sellador silicona" ya existentes, no se recrearon).
- Verificado en vivo: HOGAR (proyecto real) — "Ver subrubros típicos"
  para Impermeabilizaciones trae los 23 códigos organizados en los 4
  subcapítulos correctos, `Capitulo.capituloCatalogoId` resuelve al
  catálogo nuevo. "Puentes de Adherencia" quedó con exactamente
  `6.8.1`/`6.8.2`. "Membranas Líquidas" quedó vacío (subcapítulo
  borrado). Vidrios probado en proyecto de prueba — 14/14 códigos,
  proyecto borrado al terminar. `tsc`/build limpios.

⚠️ **Hallazgo aparte, no corregido**: igual que 7.2.30/7.2.31 de
Ascensor, ninguno de los 7 códigos preexistentes de Vidrios (`7.4.X`)
tiene `PrecioMTOP` propio — clonan a $0 hoy si se usan en un rubro real.
Los 7 códigos nuevos de esta expansión sí tienen `PrecioMTOP` dedicado.

## Expansión de biblioteca — Obra Exterior/Jardín + Carpinterías/Hierro (18/07/2026)

**✅ COMPLETADO.** Script:
[`computo-app/scripts/seed-jardin-carpmet.ts`](computo-app/scripts/seed-jardin-carpmet.ts).
No se creó ni tocó ningún `CapituloCatalogo`/`SubcapituloCatalogo` — todo
va a subcapítulos ya existentes ("Obra Exterior / Jardín" dentro de
"Subcontratos - Acondicionamientos", resuelto por `ParticionSubcapitulo`
desde la Etapa 5; "Hierro" dentro de "Subcontratos - Carpinterías").
`SubrubroEstandar` activos: "Obra Exterior / Jardín" pasa de 7 a **19**
(12 nuevos), "Hierro" pasa de 6 a **8** (2 nuevos).

- **Parrillero/quincho**: `jardin-001` parrillero de mampostería (parrilla
  de hierro + campana de humos y chimenea, $50.749,15/UNI). `jardin-002`
  quincho techado completo — **variante default en madera** (tirantería/
  correas + teja colonial, $8.351,63/m2 — reusa la composición real de
  `cubierta-010`/`cubierta-001`, más típica y económica en Uruguay para
  esta escala) y `jardin-002b` variante metálica (perfil IPN + chapa
  ondulada, $14.967,04/m2, para mayor robustez/luces mayores).
- **Cercos**: `jardin-003` tejido romboidal galvanizado h≈2m
  ($3.227,46/ml), `jardin-003b` tradicional postes+hilos sin tejido
  ($2.375,51/ml), `jardin-004` cerco vivo/vegetal ($843,18/ml). Distinto
  de `1.3` (cerco temporario de obra en Implantación y Replanteo, no se
  toca) y reusa (sin código nuevo) los muros de bloque de Albañilería
  para quien prefiera un muro de cerramiento en vez de cerco.
- **Iluminación exterior** (columna de jardín, foco empotrado de piso,
  reflector de fachada, iluminación subacuática de piscina — `jardin-005`
  a `008`): son solo la luminaria + instalación/fijación, **sin el punto
  eléctrico de alimentación** (ya cubierto por `electrica-001` en
  Instalación Eléctrica, no se duplica).
- **Riego automático**: `jardin-009` aspersión con programador
  ($42.153,47/GL), `jardin-010` goteo con programador ($27.456,56/GL) —
  llave en mano, no descompuesto en componentes sueltos.
- **Portón peatonal y motor para portón corredizo** (`carpmet-007`/`008`)
  — van a Carpinterías/Hierro, mismo oficio que sus pares 7.3.15/7.3.16/
  carpmet-004/005, no se creó una categoría paralela en Obra Exterior.
- **Sin capa de leyes sociales**: confirmado con el usuario que ningún
  script de esta expansión (gas/incendio, ascensor, impermeabilización/
  vidrios, este) la aplica — es un módulo aparte del presupuesto real
  (`SeccionLeyesSociales.tsx`), no del precio de referencia de biblioteca.
- **20 `PrecioMTOP` nuevos**, **12 materiales reusados** (bloque hormigón,
  hierro redondo 12mm, cemento portland, arena gruesa, 2 chapas
  galvanizadas, perfil IPN, revoque premezclado 2en1, alambre galvanizado,
  poste de eucaliptus, tarugo c/tornillo, tornillos y herrajes, teja
  colonial).
- Verificado en vivo (HOGAR, proyecto real): "Ver subrubros típicos" para
  Obra Exterior/Jardín trae 19/19 códigos, Carpinterías/Hierro trae 8/8
  (vía el mismo endpoint `GET /api/subrubros-estandar` que usa el panel).
  `tsc`/build limpios.

⚠️ **Hallazgo aparte, no corregido**: `cubierta-010` (Estructura de
madera para techo) y `cubierta-001` (Teja colonial sobre estructura de
madera) tampoco tienen `PrecioMTOP` propio — mismo gap que 7.2.30/31 y
7.4.X. `jardin-002` reusa su composición pero con `PrecioMTOP` nuevo
propio, así que funciona correctamente al clonar; los 2 códigos
originales de Cubierta/Techos siguen sin arreglar.

## Expansión de biblioteca — Gastos Administrativos y Conexiones (18/07/2026)

**✅ COMPLETADO.** Script:
[`computo-app/scripts/seed-administrativo.ts`](computo-app/scripts/seed-administrativo.ts).
`CapituloCatalogo` nuevo **"Gastos Administrativos y Conexiones"** (orden
22) — pasa de 22 a **23 filas**. 4 `SubcapituloCatalogo` nuevos:
"Honorarios Profesionales", "Permisos y Trámites Municipales", "Estudios
Técnicos", "Conexiones de Servicios". 20 `SubrubroEstandar` nuevos.

- **Honorarios Profesionales (12, `admin-001` a `012`)**: anteproyecto,
  proyecto arquitectónico/ejecutivo, dirección/supervisión/jefe de obra,
  asesoramiento, relevamiento, metrajes, presupuesto, plan de seguridad,
  fiscalización. **`precioUY = $0` explícito** (no estimado) — el arancel
  SAU es % del costo de obra, cualquier monto fijo sería engañoso. Cada
  uno lleva `APUEstandar` **mínimo** (1 material a $0, sin MO, sin
  `PrecioMTOP`) — confirmado en [page.tsx:2799](computo-app/src/app/proyectos/[id]/page.tsx:2799)
  que un `SubrubroEstandar` sin `APUEstandar` y `precioUY=0` dispara
  sugerencia de IA (`sugerir-apu`) al agregarlo a un proyecto, que
  inventaría materiales sin sentido para un honorario. Con `APUEstandar`
  mínimo (`tieneApuEstandar=true`) toma el camino normal de clonar-apu.
  El panel muestra "—" en vez de "$0" (`fmtMonedaDecimal`) — comportamiento
  intencional y correcto, no un bug.
- **Permisos, Estudios y Conexiones (8, `admin-013` a `020`)**, con precio
  de referencia real y fuente donde se encontró:
  - `admin-014` Empadronamiento/catastro: Tasa Catastral publicada, Dir.
    Nac. de Catastro ($918 base).
  - `admin-016` Estudio de suelos: Generador de precios CYPE Uruguay,
    suelo medio, campo+laboratorio ($59.780,63 base).
  - `admin-017`/`018` Conexión OSE agua/saneamiento: tarifa publicada en
    UR (5 UR / 17 UR × $1.922,68, valor UR julio 2026).
  - `admin-020` Conexión Gas del Estado/ANCAP: MontevideoGas, cargo
    residencial USD 276 c/IVA × TC $42,5 (mismo TC que usa `page.tsx`).
  - `admin-013`, `015`, `019` (permiso de construcción IM, final de obra,
    conexión UTE): **sin tarifa fija publicada encontrada** — quedan como
    estimación gruesa marcada explícitamente (IM cobra 1-1,5% del valor
    catastral variable, no un monto fijo; UTE define conceptos en su
    Pliego Tarifario sin monto único para vivienda estándar).
  - 8 `PrecioMTOP` nuevos (uno por código, mismo criterio que el resto de
    esta expansión — sin esto clonarían a $0).
- Verificado en vivo (proyecto de prueba): 23 filas en `CapituloCatalogo`,
  20 `SubrubroEstandar` activos, los 20 códigos resuelven correctamente
  vía `capituloCatalogoId` automático al crear el capítulo (Etapa 5) — 12
  con `precioUY=0`/`tieneApuEstandar=true` (Honorarios), 8 con precio real
  y subcapítulo correcto. Proyecto de prueba borrado. `tsc`/build limpios.

## Herrería de Obra + Estructura Metálica (18/07/2026)

**✅ COMPLETADO — cierra la última brecha pendiente de la Etapa 4.**
Script: [`computo-app/scripts/seed-herreria-estructura-metalica.ts`](computo-app/scripts/seed-herreria-estructura-metalica.ts).

- **Herrería de Obra** (2 códigos, `herreria-obra-001`/`002`): nuevo
  subcapítulo dentro de `CapituloCatalogo` **"Estructura"** (existente, no
  se creó capítulo nuevo) — provisión y colocación de hierro suelto para
  armado ($140,05/kg) y estribos/separadores ($137,75/kg, rendimiento más
  rápido). Reusan "Hierro para hormigón armado" (`MAT-HIERRO-ARM`,
  $85/kg), mismo material que ya usan 5.1.1/4.2.5/etc. MO: "Oficial
  especializado" — confirmado que es la categoría que esta biblioteca ya
  usa para armado de hierro (ver 5.1.1).
- **`CapituloCatalogo` nuevo "Estructura Metálica"** (orden 23) —
  `CapituloCatalogo` pasa de 23 a **24 filas**. 2 subcapítulos:
  - "Columnas y Vigas": `estmet-001` pilar de hierro IPN/doble T
    ($432,72/kg), `estmet-002` viga de hierro IPN/doble T ($409,29/kg),
    `estmet-003` pórtico completo de referencia rápida (~130kg, luz
    4-6m, $42.157,77/GL — descripción aclara usar 001/002 por kg para
    proyectos reales).
  - "Terminación y Protección": `estmet-004` galvanizado en caliente
    ($120,18/kg, ⚠️ sin tarifa Uruguay publicada encontrada, estimación
    gruesa), `estmet-005` pintura anticorrosiva + esmalte sintético
    ($568,21/m2, MO "Pintor oficial" — categoría específica correcta).
- **Decisión de diseño**: no se agregaron variantes de tamaño de perfil
  (IPN 100/160/200mm) — el precio ya está en $/kg, el tamaño es una
  decisión de cómputo del proyecto real, no del catálogo. Se reusa
  "Perfil de hierro normal (IPN 120mm)" (único perfil con `PrecioMTOP`
  real ya cargado) como base única de precio para cualquier tamaño.
- Solo **2 `PrecioMTOP` nuevos** (perno de anclaje para pórtico, servicio
  de galvanizado) — el resto (hierro armado, perfil IPN, electrodos,
  pintura anticorrosiva, esmalte sintético) se reusó con precio real ya
  existente, sin crear materiales redundantes.
- Rendimiento de MO de `estmet-001`/`002` (25-28 kg/jornada de cuadrilla
  Oficial especializado + Peón) revisado a pedido antes de aplicar:
  comparado contra `cubierta-013` (30 kg/jornada, roof liviano) y contra
  el benchmark internacional de soldadura pura (~64-120 kg/jornada de
  arco, que no incluye izaje/aplomado/nivelación) — confirmado que el
  número se sostiene, no es un factor conservador de más. No se ajustó.
- Verificado en vivo: 24 filas en `CapituloCatalogo`, 2 `SubrubroEstandar`
  activos en "Herrería de Obra", 5 en "Estructura Metálica" — "Ver
  subrubros típicos" probado en proyecto de prueba, 5/5 códigos
  organizados en los 2 subcapítulos correctos. Proyecto de prueba
  borrado. `tsc`/build limpios.

## Auditoría transversal "clona a $0" + Fase 1 de corrección (18/07/2026)

**Auditoría completa**: recorridos los 390 `SubrubroEstandar` activos con
`APUEstandar`, replicando exacto el lookup de `clonar-apu` (mismo
`contains`/orden). Resultado: **202 códigos afectados** (52% de la
biblioteca con APU) — **todos** en el grupo "sin `PrecioMTOP` en
absoluto" (0 casos de "PrecioMTOP con precioUnitario=0"). 17 capítulos
afectados, concentrado en Subcontratos-Acondicionamientos (26),
Albañilería (25), Carpinterías (28) e Instalación Sanitaria (20). De los
202, **solo 1 está en uso en un proyecto real** (`7.2.1` BAÑO COMPLETO,
Rubro R001 de HOGAR) — los otros 201 son biblioteca latente, corrección
por fases sin apuro. (12 de los 202 son los `admin-001` a `012` de
Honorarios Profesionales — su $0 es intencional, no un gap real.)

**Fase 1 — corregido `7.2.1` (BAÑO COMPLETO)**. Script:
[`computo-app/scripts/fix-precio-bano-completo.ts`](computo-app/scripts/fix-precio-bano-completo.ts).
6 `PrecioMTOP` nuevos (Caño PVC desagüe 110mm $350/ml y 50mm $120/ml —
este último estimación gruesa; Caño termofusión 20mm agua fría/caliente
$161,34/ml, mismo producto físico, precio real ya en la Lista MTOP como
SA001; Accesorios termofusión $1.100/gl y Sellador sanitario $450/gl,
ambos estimación gruesa). `precioUY` de `7.2.1` recalculado de $86.071,36
(histórico roto) a **$48.020,41**.

⚠️ Comparado contra el Rubro real de HOGAR (R001, $37.524,96 tecleado a
mano por el usuario en algún momento, **NO tocado** por este fix): 28%
de diferencia. La mano de obra domina el costo (75% del costo directo,
Plomero oficial + Peón a 0,15 GL/jornada = 6,67 jornadas combinadas por
baño — rendimiento heredado del import SAU 2022, no se tocó, esta fase
solo corrigió materiales). Pendiente de decisión de producto: revisar si
ese rendimiento de MO es realista, o si el precio tecleado a mano en
HOGAR está desactualizado.

**Efecto cascada** (sin tocar otros `SubrubroEstandar`/`APUEstandar`, solo
comparten el `PrecioMTOP` vía el mismo lookup): `7.2.2` (Cocina Completa),
`sanitaria-002`/`003` (termofusión agua fría/caliente),
`sanitaria-006`/`007` (desagüe PVC 110mm/50mm) quedan resueltos también.

Verificado en vivo: `clonar-apu` sobre `7.2.1` en proyecto de prueba — los
7 materiales resuelven a precio real (ninguno en $0), rubro clonado da
$48.020,41 (coincide exacto). Confirmado que el Rubro R001 de HOGAR sigue
en $37.524,96 sin cambios (`updatedAt` intacto) — su propio APU interno
todavía tiene los materiales en $0 (mismo riesgo latente ya señalado: si
algún día se "reaplica" ese APU, el precio se iría a casi $0 — no
corregido, fuera de alcance de esta fase). Proyecto de prueba borrado.
`tsc`/build limpios.

**Pendiente**: 199 códigos restantes de la auditoría (201 menos los 2
resueltos abajo — termica-001/002 — más termica-003/004 que se sumaron
a la misma tanda), sin uso en proyecto real — corrección por fases en
próximas sesiones.

## Duplicación de splits en Instalación Térmica — RESUELTO (18/07/2026)

**✅ COMPLETADO.** Script:
[`computo-app/scripts/fix-duplicado-split-termica.ts`](computo-app/scripts/fix-duplicado-split-termica.ts).

- **`7.2.19`/`7.2.20` desactivados** (`activo: false`, no borrados —
  mismo criterio que el duplicado de contrapiso 6.6.3): huérfanos del
  import SAU original, sin equivalente 18000/24000 BTU, rendimiento de MO
  menos realista que `termica-001`/`002`. Ninguno de los 4 códigos
  estaba en uso en proyecto real (confirmado antes de tocar nada).
- **`termica-001` a `004` quedan como fuente de verdad**, con su
  `precioUY` corregido (mismo bug "clona a $0" de la auditoría general):
  `termica-001` (9000 BTU) $0 → **$28.742,13**, `termica-002` (12000 BTU)
  → **$33.169,63**, `termica-003` (18000 BTU) → **$46.870,02**,
  `termica-004` (24000 BTU) → **$60.431,26** — se sumaron a la misma
  tanda por ser el mismo patrón exacto, sin esperar a la Fase 2 general.
- De los 3 materiales, **2 ya tenían `PrecioMTOP` real** ("Caño cobre
  1/4 y 3/8" $380/ml, "Soporte mural exterior" $420/u) — solo hacía
  falta el equipo split en sí. 5 `PrecioMTOP` nuevos: equipo split
  9000/12000 BTU (precio de mercado uruguayo real, MercadoLibre/Sodimac/
  LOi/Aiwa), 18000/24000 BTU (⚠️ estimación más gruesa, menos
  cotizaciones directas encontradas), y "Soporte mural exterior
  reforzado" (⚠️ estimación por analogía con el soporte normal).
- Verificado en vivo: `7.2.19`/`7.2.20` ya no aparecen en "Ver subrubros
  típicos" para Instalación Térmica (proyecto de prueba, 8/8 códigos
  restantes son solo `termica-XXX`). `clonar-apu` probado sobre
  `termica-001` (mejor cotización, material resuelve a $19.000, rubro
  $28.742,13) y `termica-004` (estimación más gruesa, material resuelve
  a $42.000, rubro $60.431,26) — ninguno en $0. Proyecto de prueba
  borrado. `tsc`/build limpios.

## Isopanel con espesores reales — RESUELTO (18/07/2026)

**✅ COMPLETADO.** Script:
[`computo-app/scripts/fix-isopanel-espesores.ts`](computo-app/scripts/fix-isopanel-espesores.ts).

- **`cubierta-008`** (Cubierta de Isopanel genérico, sin espesor,
  `precioUY=0`) **desactivado** (`activo: false`, no borrado — mismo
  patrón que `7.2.19`/`7.2.20` y el contrapiso duplicado 6.6.3).
- **3 códigos nuevos** con espesor real, reusando 3 `PrecioMTOP` que ya
  existían cargados con precio real pero sin ningún `SubrubroEstandar`
  que los usara (`CUB001`/`CUB002`/`CUB003` — Panel autoestructural
  prefabricado multicapa): `isopanel-001` (50mm, **$2.987,16/m2**),
  `isopanel-002` (150mm, **$3.571,06/m2**), `isopanel-003` (250mm,
  **$4.375,69/m2**). Ningún `PrecioMTOP` nuevo — pura reclasificación de
  material ya existente sin usar.
- MO: mismo criterio que ya usaba `cubierta-008` (Oficial albañil + Peón,
  rendimiento 16 m2/jornada) para 001/002. En `isopanel-003` (250mm,
  panel más grueso/pesado) se bajó el rendimiento a 13 m2/jornada —
  más lento de manipular y fijar.
- Verificado en vivo: `cubierta-008` ya no aparece en "Ver subrubros
  típicos" para Cubierta/Techos (17 códigos activos: 15 previos - 1 +
  3 nuevos), los 3 `isopanel-XXX` sí aparecen. `clonar-apu` probado
  sobre `isopanel-002` — material resuelve a $2.418,13 (no $0), rubro
  clonado $3.571,06 (coincide exacto). Proyecto de prueba borrado.
  `tsc`/build limpios.

## Chapa de cubierta con 3 calibres reales — RESUELTO (18/07/2026)

**✅ COMPLETADO.** Script:
[`computo-app/scripts/fix-chapa-calibres.ts`](computo-app/scripts/fix-chapa-calibres.ts).

- **`cubierta-004`/`005`/`006`** (chapa "acanalada" genérica sin calibre,
  denominación de perfil incorrecta heredada del import SAU)
  **desactivados** (`activo: false`, no borrados). Reemplazados por **9
  códigos nuevos** con distinción correcta de perfil (ondulada vs.
  trapezoidal — "acanalada" no es un perfil real) y 3 calibres reales
  cada uno (N°27≈0,40mm económica, N°25≈0,50mm superior, N°24≈0,56mm
  premium). Prepintada solo existe en perfil trapezoidal (confirmado,
  no un descuido).
- **Metodología de precio**: base real (Lista MTOP N°599, código 75,
  chapa ondulada galvanizada N°24 = $463,57/kg) cruzada con peso real
  por m² de cada calibre (fichas técnicas regionales, mismo sistema de
  calibres) — no estimación a ciegas. Trapezoidal = ondulada ×1,12,
  prepintada = trapezoidal ×1,18 (incrementos estimados sobre la base
  real). Confirmadas las 3 hipótesis del usuario: ondulada más
  económica que trapezoidal, N°24>N°25>N°27 en precio, prepintada más
  cara que su equivalente galvanizada.
- Precios: `chapa-ond-027` $2.929,89, `chapa-ond-025` $3.535,55,
  `chapa-ond-024` $3.929,51, `chapa-trap-027` $3.005,58, `chapa-trap-025`
  $3.668,92, `chapa-trap-024` $4.091,22, `chapa-prep-027` $3.612,82,
  `chapa-prep-025` $4.390,59, `chapa-prep-024` $4.883,12 (todos $/m2).
- 10 `PrecioMTOP` nuevos: las 9 chapas + "Bulón con arandela de goma"
  ($28/u, estimación — no tenía precio real, se usa en ondulada y
  prepintada, no en trapezoidal galvanizada, mismo patrón que los
  códigos originales). "Tornillos autoperforantes para chapa" reusado
  tal cual (ya real, $6/u).
- MO: mismo criterio que cubierta-004/005/006 (Oficial albañil + Peón),
  rendimiento bajado en N°24 (ondulada 12→10, trapezoidal/prepintada
  14→12).
- Verificado en vivo: `cubierta-004`/`005`/`006` ya no aparecen en "Ver
  subrubros típicos" para Cubierta/Techos (23 códigos activos: 17
  previos - 3 + 9 nuevos), los 9 `chapa-XXX` sí aparecen. `clonar-apu`
  probado sobre `chapa-ond-027` (material $1.659,58, rubro $2.929,89) y
  `chapa-prep-025` (material $2.732,43 + bulón $28, rubro $4.390,59) —
  ninguno en $0. Proyecto de prueba borrado. `tsc`/build limpios.

## Fase 2 del bug "clona a $0" — Carpinterías, material mal asignado (18/07/2026)

**✅ COMPLETADO** (primera corrección puntual dentro de la Tanda 1 de
Carpinterías — 28 códigos afectados en total según la auditoría
transversal, quedan los demás para próximas sesiones). Script:
[`computo-app/scripts/fix-material-mal-asignado-carpinterias.ts`](computo-app/scripts/fix-material-mal-asignado-carpinterias.ts).

Se detectaron 3 casos donde el problema no era solo falta de precio,
sino **material del APU mal asignado** (no correspondía a lo que el
código dice ser):

- **`7.3.14`** (Puerta de chapa calibre 18 0.75x2.05m) — su material
  apuntaba a una puerta de 0.90x2.10m, idéntico en todo a `carpmet-001`
  (mismo material, tornillos y MO exactos). **Desactivado**
  (`activo: false`, no borrado — redundante exacto).
- **`7.3.15`** (Portón de garage dos hojas 2.40x2.10m, batiente) — su
  material apuntaba a un portón **corredizo** de 3.00x2.10m (tipo y
  tamaño distintos), con un `rendimiento=0.9` que era un parche para
  aproximar el costo. Se creó un material nuevo real "Portón batiente
  dos hojas de hierro 2.40x2.10m" (⚠️ estimación gruesa, $38.000/u —
  producto a medida, sin cotización directa de plaza encontrada) y se
  eliminó el parche de rendimiento. `precioUY`: $51.388,67 (con material
  equivocado) → **$59.574,16**. `carpmet-004` (el corredizo real) NO se
  tocó — es un producto distinto, no redundante.
- **`7.3.18`** (Ventana corrediza aluminio Serie 25 1.20x1.10m) — su
  material apuntaba a una "Ventana metálica corrediza" genérica
  (material equivocado: hierro, no aluminio). Se creó un material nuevo
  "Ventana corrediza aluminio serie 25 1.20x1.10m" (⚠️ estimación
  gruesa, $12.500/u — confirmado producto real y estandarizado en plaza
  uruguaya —PGU, Waluminio, Aberturas Moscú, MgM, Alumex— pero sin poder
  extraer precio exacto de las páginas). `precioUY`: $9.560,66 → **
  $19.084,43**. `carpmet-002` (la ventana metálica genérica real) NO se
  tocó — producto distinto.
- Reusados sin cambios: "Tornillos y herrajes metálicos" ($450/gl) y
  "Silicona para ventanas" ($280/u), ambos ya con precio real.
- Verificado en vivo: `7.3.14` ya no aparece en "Ver subrubros típicos"
  para Carpinterías (32 códigos activos, era 33). `clonar-apu` probado
  sobre `7.3.15` (material resuelve a $38.000, rubro $59.574,16) y
  `7.3.18` (material resuelve a $12.500, rubro $19.084,43) — ninguno en
  $0 ni en el material viejo equivocado. Proyecto de prueba borrado.
  `tsc`/build limpios.

⚠️ Nota operativa: el servidor de desarrollo se cayó a mitad de esta
verificación (timeout entre pasos) — se detectó por `curl` devolviendo
"connection refused", se reinició con `preview_start` y se continuó sin
pérdida de datos (la base de datos es externa, no depende del server
dev).

**Pendiente**: el resto de los 28 códigos de Carpinterías (25 restantes,
sin apalancamiento — casi todos materiales únicos por código, ver
inventario agrupado ya reportado) queda para la Tanda 1 completa en
otra sesión.

## Fase 2 del bug "clona a $0" — Carpinterías, subcapítulo Herrajes (18/07/2026)

**✅ COMPLETADO** (3 de los 25 códigos restantes de la Tanda 1 de
Carpinterías). Script:
[`computo-app/scripts/fix-herrajes.ts`](computo-app/scripts/fix-herrajes.ts).

- `7.3.6`/`7.3.7`/`7.3.8` (Pomo con llavín, Cerradura tipo star con
  manija, Bisagra) — confirmado que en los 3 el material del APU sí
  coincide con lo que el código describe (sin caso de material mal
  asignado como en Hierro). Ninguno usado en Rubro real de HOGAR/Matisse
  Monet.
- Precios: **Pomo con llavín** $950/u (Kroser Uruguay, marca Hermex,
  rango real observado $727-1.284). **Cerradura tipo star con manija**
  $4.000/u (⚠️ estimación gruesa — STAR confirmada como marca líder del
  mercado uruguayo desde 1941, sin precio publicado específico
  encontrado; ajustada al alza a pedido del usuario, que consideró baja
  la primera estimación de $2.200 para una cerradura de embutir completa
  con manija de esa marca). **Bisagra** $180/u (⚠️ estimación gruesa,
  sin cotización uruguaya específica encontrada).
- `precioUY`: `7.3.6` $345,60→**$1.785,30**, `7.3.7` $1.782,00→
  **$5.760,26**, `7.3.8` $126,36→**$446,53**. Sin cambios de MO (los
  rendimientos originales ya eran correctos).
- Verificado en vivo: `clonar-apu` probado sobre los 3 — todos resuelven
  a precio real ($950, $4.000, $180 respectivamente, ninguno en $0).
  Proyecto de prueba borrado. `tsc`/build limpios.

**Pendiente**: 22 códigos restantes de Carpinterías (Madera, Aluminio,
Equipamiento) para completar la Tanda 1.

## Fase 2 del bug "clona a $0" — Carpinterías, subcapítulo Aluminio (18/07/2026)

**✅ COMPLETADO** (8 de los 22 códigos restantes de la Tanda 1 de
Carpinterías). Script:
[`computo-app/scripts/fix-aluminio-gala.ts`](computo-app/scripts/fix-aluminio-gala.ts).

- Confirmado (sin caso de material mal asignado): en los 6 códigos Gala
  el material coincide con la descripción. `7.3.24` "Amure de aberturas
  de aluminio" no forma parte del lote — ya tenía precio real. Ninguno
  usado en Rubro real de HOGAR/Matisse Monet.
- **Escalera de gama confirmada** investigando el sitio del fabricante
  (aluminios.com, aberturasgala.uy, probba.uy): Serie 25 (económico,
  sin DVH, otro fabricante) → **Probba** (economía, sí admite DVH,
  "mejor relación calidad-precio") → **Gala** (media, "comodidad para
  su familia") → Summa (premium). Esto corrigió una subestimación
  inicial de Gala (se había calculado como un solo escalón sobre Serie
  25, en vez de dos).
- Tarifas base ($/m²): Serie 25 $9.469,70 (ancla real, 7.3.18) → Probba
  $15.151,52 (×1,60) → Gala $24.242,42 (×1,60). Sobre cada base se
  aplican los mismos multiplicadores relativos: DVH ×1,38,
  oscilobatiente ×1,10, lama térmica ×1,65.
- **Hallazgo antes de aplicar**: `7.3.17b` — pese a estar agrupado como
  "código de Gala" en el pedido, su descripción y material dicen
  literalmente "Serie 25" — **se excluyó de la tanda Gala y quedó sin
  tocar**, con la tarifa Serie 25 real ya aplicada la sesión anterior
  ($57.279,44). Confirmado con el usuario antes de aplicar.
- **5 códigos Gala recalculados**: `7.3.19` (DVH) $58.559,01→
  **$254.383,01**, `7.3.20` $28.283,60→**$60.364,64**, `7.3.21`
  (oscilobatiente) $28.283,60→**$55.804,82**, `7.3.22` $22.308,20→
  **$51.082,14**, `7.3.23` (lama térmica) $36.848,36→**$82.654,80**.
- **6 códigos Probba nuevos** (`alu-probba-001` a `006`, mismos
  tipos/tamaños que sus pares Gala, mismo criterio de MO): $86.748,18 /
  $163.289,21 / $39.147,15 / $36.323,82 / $33.372,14 / $53.433,30.
- ⚠️ Metodología en cadena con un solo punto real de anclaje (7.3.18) —
  no son cotizaciones directas independientes por producto. Se encontró
  precio real de componentes sueltos de perfil Gala en
  `shop.aluminios.com` (ej. hoja de puerta batiente USD 141,90-191,08)
  pero con ambigüedad de unidad (¿por metro lineal o por barra de 6m?)
  que impidió usarlo como ancla cuantitativa directa — se usó solo como
  respaldo cualitativo de que la línea tiene precio de mercado real.
- Verificado en vivo: 14 `SubrubroEstandar` activos en Aluminio (8
  previos + 6 Probba nuevos). `clonar-apu` probado sobre `7.3.19` (Gala
  DVH recalculado — material $192.029,09, rubro $254.383,01) y
  `alu-probba-005` (nuevo — material $23.333,33, rubro $33.372,14) —
  ninguno en $0. Proyecto de prueba borrado. `tsc`/build limpios.

**Pendiente**: 16 códigos restantes de Carpinterías (Madera,
Equipamiento) para completar la Tanda 1.

## Fase 2 del bug "clona a $0" — Carpinterías, subcapítulo Madera (18/07/2026)

**✅ COMPLETADO** (4 de los 16 códigos restantes de la Tanda 1 de
Carpinterías). Script:
[`computo-app/scripts/fix-madera-carpinterias.ts`](computo-app/scripts/fix-madera-carpinterias.ts).

- Confirmado (sin caso de material mal asignado): en los 4 códigos el
  material del APU coincide con lo que el código describe. Ninguno
  usado en Rubro real de HOGAR/Matisse Monet.
- **Hallazgo**: "Tornillos y herrajes" (7.3.1/7.3.2) y "Tornillos y
  herrajes mueble" (7.3.3/7.3.4) ya tenían `PrecioMTOP` real (matchean
  por `contains`) — solo faltaba precificar la puerta/ventana en sí.
- Fuentes — Generador de Precios de la Construcción Uruguay (CYPE) para
  3 de los 4, con un ajuste manual en el cuarto tras objeción del
  usuario:
  - `7.3.1` (Puerta exterior 0,90×2,10m): **ajustado tras revisión** —
    la referencia CYPE inicial daba una caída de -72% vs. el histórico
    ($69.120), señal de que era de gama más económica que una puerta de
    entrada estándar. Se reemplazó por un precio de venta real (no
    estimador): Tienda Waluminio, puerta de cedro macizo 85×205cm,
    $11.295,50 — escalado por área a 0,90×2,10m → material $12.251,65.
    Queda igual una caída fuerte (-69%) pero ahora anclada a una
    cotización real confirmada "maciza", no a un estimador genérico.
  - `7.3.2` (Puerta interior 0,80×2,05m): CYPE "puerta interior de
    abrir, de madera" → material $3.798,84.
  - `7.3.3` (Ventana corrediza con celosía 1,20×1,00m): sin match
    directo en CYPE — ⚠️ estimación gruesa derivada de ventana
    abisagrada CYPE (×0,85 corrediza, ×1,15 celosía) → material
    $39.799,04.
  - `7.3.4` (Puerta ventana corrediza 1,80×2,05m): sin match directo —
    ⚠️ estimación gruesa derivada de puerta exterior CYPE (×1,4 por
    tamaño/tipo) → material $28.464,78.
- Sin cambios de mano de obra en los 4. GG 15% / Utilidad 10%, sin
  leyes sociales (no aplica en biblioteca).
- **4 `precioUY` recalculados**: `7.3.1` → **$21.535,04**, `7.3.2` →
  **$9.019,75**, `7.3.3` → **$54.327,77**, `7.3.4` → **$42.324,11**.
- Verificado en vivo: `clonar-apu` probado sobre los 4 códigos —
  ninguno en $0, material y `rubro.precioUnit` coinciden exacto con lo
  calculado (`7.3.1` material $12.251,65/rubro $21.535,04; `7.3.2`
  $3.798,84/$9.019,75; `7.3.3` $39.799,04/$54.327,77; `7.3.4`
  $28.464,78/$42.324,11). Proyecto de prueba borrado. `tsc`/build
  limpios.

**Pendiente**: recuento corregido tras re-auditoría — ver sección
siguiente (18/07/2026). La cifra "12 restantes (Equipamiento)" de aquí
arriba estaba mal: el recuento nunca se hizo con una re-auditoría
completa, así que no capturó los códigos de Hierro/`carpmet-` sueltos
ni un error real en 7.3.17b (ver abajo).

## Re-auditoría de Carpinterías + corrección de 7.3.17b (18/07/2026)

**✅ COMPLETADO.** Script:
[`computo-app/scripts/fix-precio-7317b.ts`](computo-app/scripts/fix-precio-7317b.ts).

- **Re-auditoría solicitada por el usuario** tras notar una
  inconsistencia en el conteo ("16 restantes" → "12 restantes" nunca
  sumaba con el inventario original de 3 códigos de Equipamiento).
  Se recorrieron los 38 `SubrubroEstandar` activos con APU de
  Carpinterías replicando exactamente la lógica de `clonar-apu`
  (match de material por `descripcion.contains`, insensible a mayúsculas).
  Resultado: **13 códigos siguen afectados hoy**, no 12:
  - Equipamiento (3): `7.3.9` mueble de baño, `7.3.10` mueble cocina,
    `7.3.11` placard.
  - Hierro (3): `7.3.12` ventana en perfil de hierro, `7.3.13` reja,
    `7.3.16` motor para portón batiente.
  - Familia `carpmet-` (6): `carpmet-001` a `006` — pares de
    7.3.14/7.3.15/7.3.18 que comparten texto de material pero nunca
    se les asignó `PrecioMTOP` propio al resolver esos 3 casos.
  - **`7.3.17b`** (1) — dado por resuelto por error en la tanda de
    Aluminio ("ya quedó correctamente precificado ($57.279,44)"). Al
    revisar la base, su `precioUY` seguía en $19.519,67 con
    `fechaBase: 2022-08` (el valor original de 2022, nunca escrito a
    producción) y su material no tenía `PrecioMTOP` que lo matchee —
    seguía clonando a $0. El cálculo de $57.279,44 se había hecho
    correctamente esa sesión, pero el script nunca se corrió con
    `--apply`.
  - Cruzado contra los 35 Rubro reales de HOGAR + Matisse Monet:
    ninguno de los 13 está en uso hoy — 100% biblioteca latente.
- **Corregido en esta tanda**: `7.3.17b` (Puerta ventana corrediza
  aluminio Serie 25 2.00×2.05m) — se aplicó la tarifa Serie 25 real ya
  usada como ancla en `7.3.18` ($9.469,70/m² = $12.500 /
  (1,20×1,10 m²)), escalada a los 4,10 m² de 7.3.17b → material
  $38.825,76/u (nuevo `MAT-ALUM-73170B`). Silicona ($280/u) y mano de
  obra (Oficial especializado + Peón, rendimiento 0,7 c/u) sin cambios.
  `precioUY`: $19.519,67 → **$57.279,44**.
- Verificado en vivo: `clonar-apu` sobre `7.3.17b` — material
  $38.825,76 (no $0, no el valor viejo de 2022), `rubro.precioUnit`
  $57.279,44 exacto. Proyecto de prueba borrado. `tsc`/build limpios.

**Pendiente**: 12 códigos restantes de Carpinterías para completar la
Tanda 1 — Equipamiento (3), Hierro (3), familia `carpmet-` (6).

## Fase 2 del bug "clona a $0" — Carpinterías, subcapítulo Equipamiento (18/07/2026)

**✅ COMPLETADO** (3 de los 12 códigos restantes de la Tanda 1). Script:
[`computo-app/scripts/fix-equipamiento-carpinterias.ts`](computo-app/scripts/fix-equipamiento-carpinterias.ts).

- Confirmado (sin caso de material mal asignado): en los 3 el material
  del APU coincide con lo que el código describe. "Tornillos y
  herrajes mueble" (7.3.10/7.3.11) ya tenía `PrecioMTOP` real
  ($380/gl) — no hacía falta investigarlo. Ninguno usado en Rubro real
  de HOGAR/Matisse Monet.
- **Hallazgo**: los 3 `precioUY` de 2022 no eran huérfanos — son
  exactamente los valores "precio directo" del Rubrado SAU agosto 2022
  (rubros 7.3.9/7.3.10/7.3.11, confirmado leyendo el PDF original). El
  bug es puro problema de nuestro sistema: nunca se les asoció un
  `PrecioMTOP` propio al material, así que `clonar-apu` recalcula desde
  cero y da $0. Igual que en Madera, no se preservó ese total: se
  investigó precio real de material 2026 de forma independiente y se
  reconstruyó `precioUY` hacia adelante.
- Fuentes:
  - `7.3.9` (Mueble de baño con bacha 0.75x0.50x0.65m): Loysa.uy,
    "mueble suspendido con bacha de loza" 60cm USD 270 / 80cm USD 320
    — interpolado a 75cm → USD 307,50 → $12.561,38 a $40,85/USD (BROU
    venta). "Accesorios de colocación mueble" sin fuente puntual — ⚠️
    estimación gruesa, $450/gl (tarugos/tornillos/sellador).
  - `7.3.10` (Mueble cocina modulado, ml): combina 2 fuentes reales —
    Sodimac Uruguay "Bajo mesada Henn 2 puertas 3 cajones" 120cm ancho
    confirmado, $6.169 → $5.140,83/ml de módulos inferiores; + Rubrado
    SAU 2022 "Mesada granito gris" $12.417,30/m² × 0,60m profundidad →
    $7.450,38/ml de mesada. Total $12.591,21/ml.
  - `7.3.11` (Placard puertas corredizas 1.80x2.30x0.65m): primera
    fuente (Divino.com.uy) sin medidas publicadas — reemplazada a
    pedido del usuario por Soy Hogar Muebles, "Ropero placard 3
    puertas corredizas espejo blanco Residence", medidas CONFIRMADAS
    2.18m×2.10m×0.52m, $16.110 (con desc.). Escalado por área total de
    paneles (frente+fondo, 2 laterales, tapa+piso, 3 estantes) → factor
    1,0066 (casi neutro) → $16.216,09. Bajó de $34.396,87 (primera
    estimación sin medidas) a $16.216,09 al usar una fuente con
    medidas reales.
- Sin cambios de mano de obra en los 3. GG 15% / Utilidad 10%, sin
  leyes sociales.
- **3 `precioUY` recalculados**: `7.3.9` → **$21.926,85**, `7.3.10` →
  **$20.053,55**, `7.3.11` → **$25.995,88**.
- Verificado en vivo: `clonar-apu` probado sobre los 3 — ninguno en $0,
  material y `rubro.precioUnit` coinciden exacto con lo calculado.
  Proyecto de prueba borrado. `tsc`/build limpios.

**Pendiente**: 9 códigos restantes de Carpinterías para completar la
Tanda 1 — Hierro (3: 7.3.12/13/16), familia `carpmet-` (6: 001-006).

## Fase 2 del bug "clona a $0" — Carpinterías, Hierro suelto (19/07/2026)

**✅ COMPLETADO** (3 de los 9 códigos restantes de la Tanda 1). Script:
[`computo-app/scripts/fix-hierro-suelto-carpinterias.ts`](computo-app/scripts/fix-hierro-suelto-carpinterias.ts).

- **Bug de material mal asignado encontrado** (mismo cuidado que
  7.3.14/15/18): el accesorio de 7.3.16 (motor **batiente**) matcheaba
  por `contains` con un `PrecioMTOP` creado para `carpmet-008` "Motor
  para portón **corredizo**" ($1.200) — kits de accesorios distintos
  (brazo articulado/bisagras vs. cremallera/riel). Se separó en su
  propio `PrecioMTOP` y se renombró el material del APU para que ya no
  colisione. Ninguno de los 3 usado en Rubro real de HOGAR/Matisse
  Monet.
- Fuentes:
  - `7.3.12` (Ventana en perfil de hierro 1.40x1.10m): ⚠️⚠️ sin
    cotización directa de "ventana en marco de hierro" en plaza —
    metraje estimado (8,6m de tubo 25x25x2mm) × Lista MTOP código 203
    "Perfil de hierro ángulo 25x25x3mm" $171,92/kg (perfil real más
    cercano disponible en la Lista). Cruzado contra CYPE Uruguay
    (ventana de acero completa con herrajes, $17.190,50) como techo de
    gama alta.
  - `7.3.13` (Reja 1.40x1.10m): mismo perfil que ya trae el APU — Lista
    MTOP código 203 $171,92/kg (real). Cruzado contra CYPE Uruguay
    "Reja de acero" ($3.935,42/m² ≈ $166/kg) — consistente.
  - `7.3.16` (Motor para portón batiente): primer intento (BFT España
    397€/u × margen de importación 1,6x, $56.047,51) descartado por dar
    un número muy por encima de plaza real — el usuario pidió agotar
    fuentes locales antes de aceptarlo. Encontrado: Carrasco Import
    (Montevideo), línea MOTORTEK — 300kg USD 235 / 400kg USD 269 /
    700kg USD 359, motor solo (centralita/receptor aparte, igual que
    nuestro APU). Usado el de 400kg (gama residencial media) →
    $10.988,65, cruzado contra MercadoLibre Uruguay (cae en el rango
    "$10.000-$20.000" más poblado de la categoría).
- Sin cambios de mano de obra en los 3. GG 15% / Utilidad 10%, sin
  leyes sociales.
- **3 `precioUY` recalculados**: `7.3.12` → **$5.727,37**, `7.3.13` →
  **$5.341,14**, `7.3.16` → **$18.919,92**.
- Verificado en vivo: `clonar-apu` probado sobre los 3 — ninguno en $0,
  material y `rubro.precioUnit` coinciden exacto con lo calculado; el
  material de 7.3.16 aparece correctamente renombrado a "Accesorios
  instalación motor portón batiente". Proyecto de prueba borrado.
  `tsc`/build limpios.

**Pendiente**: 6 códigos restantes de Carpinterías para completar la
Tanda 1 — familia `carpmet-` (001-006).

## Fase 2 del bug "clona a $0" — Carpinterías, familia carpmet- — CIERRE TANDA 1 (19/07/2026)

**✅ COMPLETADO** (últimos 6 códigos de la Tanda 1 — Tanda 1 de
Carpinterías queda 100% cerrada). Script:
[`computo-app/scripts/fix-carpmet-familia.ts`](computo-app/scripts/fix-carpmet-familia.ts).

- Confirmado (sin material mal asignado nuevo) en los 6. Ninguno usado
  en Rubro real de HOGAR/Matisse Monet.
- **carpmet-001** compartía texto exacto de material con 7.3.14
  (desactivado) pero 7.3.14 nunca tuvo precio propio — necesitó
  investigación nueva: peso de chapa Nro.18 (doble cara) × Lista MTOP
  código 78 ($129,24/kg) + 25% margen por marco/refuerzos.
- **carpmet-002/003** (Ventana metálica corrediza 1.20x1.10m /
  1.50x1.10m): reusan la tarifa por m² de 7.3.12 ($1.386,73/m², ya
  real) escalada a cada tamaño — misma familia "ventana de hierro
  genérico".
- **carpmet-004** (Portón metálico corredizo 3.00x2.10m): confirmado
  material distinto al de 7.3.15 (corredizo ≠ batiente) — se reusó
  solo la tarifa por m² de 7.3.15 ($7.539,68/m²) para el panel. "Riel
  y guía" (componente nuevo): reconstruido con 2 fuentes reales tras
  objeción del usuario al rango genérico inicial — 3 ruedas de acero
  con rodamientos, Carrasco Import (Montevideo) USD 17,70/u, + riel/
  canal embutido 3m estimado por peso (Lista MTOP). Subió de $3.500 a
  $4.232,17.
- **carpmet-005** (Reja tubular, M2): mismo material exacto que 7.3.13
  ("Tubo cuadrado acero 25x25x2mm"), ya con `PrecioMTOP` real desde el
  fix de Hierro suelto — no necesitó investigación, solo recalcular y
  guardar `precioUY` (estaba en $0 porque nunca se guardó).
- **carpmet-006** (Baranda tubular, ML): **corrección de rendimiento,
  no solo de precio** — el APU original tenía 2,5ml de tubo por ml de
  baranda, consistente solo con el pasamanos, sin parantes verticales.
  Corregido a 9,5ml/ml (2ml pasamanos + 7,5ml de parantes cada ≤12cm ×
  0,90m de alto, norma de seguridad). Con la corrección, el material
  converge con la referencia CYPE Uruguay (antes divergía fuerte).
- Sin cambios de mano de obra (salvo el rendimiento de material de
  carpmet-006). GG 15% / Utilidad 10%, sin leyes sociales.
- **6 `precioUY` aplicados**: `carpmet-001` **$13.313,51**,
  `carpmet-002` **$6.883,98**, `carpmet-003` **$7.462,87**,
  `carpmet-004` **$76.945,36**, `carpmet-005` **$4.739,84**,
  `carpmet-006` **$5.184,40**.
- Verificado en vivo: `clonar-apu` probado sobre los 6 — ninguno en $0,
  material y `rubro.precioUnit` coinciden exacto. Proyecto de prueba
  borrado. `tsc`/build limpios.
- **Auditoría final de cierre**: recorridos los 39 `SubrubroEstandar`
  de Carpinterías (activos+inactivos) replicando la lógica de
  `clonar-apu` — **0 códigos activos clonan a $0 hoy**. 38 activos con
  precio real + 1 desactivado (7.3.14, redundante). Tanda 1 de
  Carpinterías cerrada por completo.

## Fase 2 del bug "clona a $0" — Tanda 2 (Albañilería), sub-tanda 1 (19/07/2026)

**✅ COMPLETADO** (11 de los 25 códigos afectados de Albañilería, los 4
materiales de mayor apalancamiento). Script:
[`computo-app/scripts/fix-albanileria-subtanda1.ts`](computo-app/scripts/fix-albanileria-subtanda1.ts).

- Auditoría en vivo (no el archivo viejo de scratchpad) confirmó los
  25 códigos afectados y el agrupamiento por material compartido.
  Ninguno de los 25 usado en Rubro real de HOGAR/Matisse Monet.
- **Decisión 6.5.4**: no se creó material nuevo — reusa "Baldosa
  cerámica esmaltada ~45-50cm" (mismo precio que 6.4.7/6.4.22),
  renombrado para no prometer una medida exacta incumplida (el código
  decía 45x45cm, el material decía 50x50cm).
- **Decisión 6.5.1/6.5.3**: sí recibieron material propio. Hallazgo
  que contradijo la expectativa inicial de "sobreprecio real" —
  datos reales de Acher Cerámicas (Uruguay) muestran que el porcelanato
  **pulido** (USD 39,20/m²) sale prácticamente igual al **mate**
  (USD 39,43/m² promedio), y el de **textura/diseño** (USD 33,75/m²)
  sale más barato en la muestra relevada. Se reportó así, sin forzar
  una diferencia artificial.
- **Bug adicional encontrado** (no estaba en la lista de 25): el
  material "Cemento Portland" de 6.4.8 resolvía por `contains` al
  cemento **blanco** ($54,44/kg) en vez del gris estándar (~$25,70/kg)
  — mismo patrón de colisión por texto ambiguo visto en Carpinterías.
  Corregido renombrando el material a "Cemento Portland gris
  (Montevideo, en bolsa, en obra)" (mismo texto que ya usaba
  correctamente 6.4.23) — no necesitó `PrecioMTOP` nuevo.
- Fuentes: Acher Cerámicas (Uruguay, real, porcelanatos y cerámica con
  descuento vigente); MercadoLibre Uruguay (mosaico granítico 20x20cm/
  30x30cm reales, extrapolado linealmente a 40x40cm); La Casa del
  Carpintero (Uruguay, alfajía lapacho boliviano 2"x1" $462/ml real,
  escalado por sección transversal ×11,811 a 30cm×2", medida
  confirmada en el Rubrado SAU original).
- Sin cambios de mano de obra. GG 15% / Utilidad 10%, sin leyes
  sociales.
- **11 `precioUY` aplicados**: `6.4.6` **$3.287,76**, `6.4.24`
  **$624,42**, `6.5.1` **$3.372,91**, `6.5.3` **$3.207,38**, `6.4.7`
  **$2.090,97**, `6.4.22` **$467,88**, `6.5.4` **$2.151,72**, `6.4.16`
  **$7.422,91**, `6.4.19` **$7.481,27**, `6.4.8` **$3.023,80**,
  `6.4.23` **$560,34**.
- Verificado en vivo: `clonar-apu` probado sobre 5 (uno de cada
  material + el pulido para confirmar el renombre) — ninguno en $0,
  material y `rubro.precioUnit` coinciden exacto. Confirmado que 6.4.8
  ahora resuelve al cemento gris, no al blanco. Proyecto de prueba
  borrado. `tsc`/build limpios.

**Pendiente**: 14 códigos restantes de Albañilería (Tanda 2) — pisos
vinílicos, flotante, parquet, alfombra, baldosa de vereda, madera dura
10x5cm, pulido de pisos, ladrillo de vidrio, malla electrosoldada,
zócalo de madera, porcelanato 30x60.

## Fase 2 del bug "clona a $0" — Tanda 2 (Albañilería), sub-tanda 2, Grupo A (19/07/2026)

**✅ COMPLETADO** (6 de los 14 códigos restantes — pisos de interior
"blandos"). Script:
[`computo-app/scripts/fix-albanileria-pisos-interior.ts`](computo-app/scripts/fix-albanileria-pisos-interior.ts).

- Confirmado (sin material mal asignado): en los 6 el material del
  APU coincide con lo que el código describe. Ninguno usado en Rubro
  real de HOGAR/Matisse Monet.
- **Chequeo del orden esperado** (rollo < baldosa ≈ H2O < flotante <
  parquet) — pedido explícitamente por el usuario, NO se sostiene
  completo con fuentes reales equivalentes: la baldosa vinílica sale
  más barata que el rollo (grados de uso distintos: rollo clase
  34/43 comercial/industrial vs. baldosa clase 31 comercial
  moderado); el H2O (SPC rígido) resulta el más caro de los 5, no
  "≈ baldosa" (categoría de producto más moderna/premium). Flotante <
  parquet sí se sostiene en precio final, aunque por la mano de obra
  (el parquet lleva rend. 6 vs. 18 del flotante) y no por el material
  bruto. Aprobado por el usuario tal cual, sin forzar el orden
  esperado.
- Fuentes: Sodimac Uruguay (SPC real, piso flotante gama alta real);
  CYPE Uruguay (rollo/baldosa vinílica comercial, parquet multicapa
  ingeniería — reemplazó "mosaico" por ser gama más básica que la
  pedida, espuma de piso flotante). Adhesivos (vinílico, parquet)
  convertidos a $/kg desde el $/m² real de CYPE usando el rendimiento
  propio de cada APU.
- **Alfombra de alto tránsito — advertencia más fuerte del sistema**
  (⚠️⚠️): Casa Belforte y Vinibel (mayoristas reales uruguayos)
  confirman el producto exacto en plaza pero sin precio publicado en
  ningún canal accesible. Estimado escalando el total SAU 2022 con
  proporción material/MO típica de esta investigación — sin ancla de
  precio real, revisar si se detecta uso real antes de confiar en el
  número.
- Sin cambios de mano de obra. GG 15% / Utilidad 10%, sin leyes
  sociales.
- **6 `precioUY` aplicados**: `6.4.1` **$2.046,53**, `6.4.2`
  **$1.308,22**, `6.4.3` **$994,99**, `6.4.4` **$1.939,24**, `6.4.5`
  **$2.223,11**, `6.4.9` **$1.527,33**.
- Verificado en vivo: `clonar-apu` probado sobre 3 (baldosa la más
  barata, parquet, H2O la más cara) — ninguno en $0, material y
  `rubro.precioUnit` coinciden exacto. Proyecto de prueba borrado.
  `tsc`/build limpios.

**Pendiente**: 8 códigos restantes de Albañilería (Tanda 2) — Grupo B
(pulidos/selladores: 2) y Grupo C (varios: baldosa de vereda, madera
dura 10x5cm, zócalo de madera, ladrillo de vidrio, malla
electrosoldada, porcelanato 30x60).

## Pendientes técnicos

### Bug de sincronización: Rubro.precioUnit desactualizado vs. APU

Cuando se edita un APU (materiales, mano de obra, modo de costeo de
equipos, etc.) sin volver a apretar "Aplicar al rubro", el precio
guardado en Rubro.precioUnit queda desactualizado respecto a lo que el
APU actual calcularía. Confirmado como patrón general: 2 de 30 rubros
con APU en toda la base (todos los proyectos) presentan esta
desincronización al momento de este chequeo (11/07/2026):
- HOGAR / GRÚA TORRE — ALQUILER MENSUAL: 44,7% de diferencia
  (probablemente por cambio de modo de costeo Alquilado/Propio sin
  reaplicar)
- HOGAR / Revoque fino muro exterior: 1,7% de diferencia

Estado: no urgente (todos los proyectos actuales son de prueba, ninguno
entregado a cliente todavía), pero debe resolverse antes de tener
proyectos reales en producción.

Propuesta de solución (a definir, no implementada): badge visual tipo
"⚠️ APU modificado — precio desactualizado" en el rubro cuando se
detecte la diferencia, sin necesariamente automatizar el recálculo
(podría no ser deseable forzar el recálculo si alguien edita el APU a
propósito para comparar escenarios antes de decidir).
