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

Productos/técnicas que están ganando terreno en obra y que la biblioteca
todavía no cubre como subrubro estándar. Se agregan como subrubro puntual
en un proyecto real cuando una obra concreta lo requiera (mismo patrón
que "Mortero común" en proyecto HOGAR) — no son pendientes de desarrollo,
son referencia para no tener que re-investigar de cero.

- [ ] Revoques premezclados 2 en 1 / 3 en 1 (URUMIX, Weber Promex E,
      Ultramix, etc.) — reemplazan grueso+fino(+hidrófugo) en una sola
      aplicación de ~15mm. Consumo real relevado: 25-30 kg/m2 exterior.

- [ ] Revoque grueso y fino premezclados por separado (no combinado) —
      según relevamiento de Luis, hoy casi no se arma la mezcla en obra;
      se compra premezclada aunque sea por capas separadas.

- [ ] Puentes de adherencia químicos (ej. SikaTop Modul) — para unir
      revoque/mortero nuevo sobre superficie vieja o poco porosa.
      Insumo líquido, consumo bajo (referencias de productos similares
      Sika rondan 0,15-0,175 kg/m2).

- [ ] Puentes de impermeabilización cementicios (ej. SikaTop Seal-107) —
      revestimiento impermeable bicomponente, bolsa 25kg + líquido.
      Uso: subsuelos, muros de contención, fosos de ascensor, piscinas,
      cubiertas con agua. Se cruza con capítulos pendientes de
      Impermeabilizaciones y Ascensor.

- [ ] Membranas líquidas impermeabilizantes (ej. SikaFill-100/Elástico/400,
      Sikalastic-560) — impermeabilización de techos/terrazas, aplicación
      en frío, monocomponente. Rendimiento: 0,8-1,5 kg/m2 sin refuerzo,
      2,8-3 kg/m2 con malla de refuerzo (fisuras/detalles). Cruza directo
      con el capítulo pendiente de Impermeabilizaciones.

  Nota general: ninguno de estos productos tiene dosificación en el MTOP
  2006 (son productos de marca posteriores/no contemplados). Se modelan
  como insumo único (producto comercial) + rendimiento de ficha técnica,
  no como descomposición cemento/arena/cal. Precio de referencia: no está
  en Lista MTOP N°599, requiere relevamiento de precio de mercado real al
  momento de cargarlos.

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
