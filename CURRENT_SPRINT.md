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

## Hallazgos sin resolver

- **"Equipamiento" y "Obra Exterior / Jardín" muestran lo mismo**:
  ambos capítulos de proyecto mapean al mismo capítulo de biblioteca
  ("Subcontratos - Acondicionamientos") sin ningún recorte por
  subcapítulo ([page.tsx:149-150](computo-app/src/app/proyectos/[id]/page.tsx:149)).
  Hoy "Ver subrubros típicos" muestra exactamente la misma lista completa
  en los dos, aunque son cosas distintas (equipamiento de baño/cocina vs.
  jardín/exterior).

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
