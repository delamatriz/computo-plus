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
