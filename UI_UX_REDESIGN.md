# Rediseño de Navegación (Navbar + Sidebar) y Spec de Features Nuevas

Documento de diseño — nada de lo descrito acá está implementado
todavía. Registra las decisiones tomadas en sesión de repaso de UX
del navbar y sidebar de Cómputo+, más el alcance de dos features
nuevas (Sugerencias, Metrajes con plano), para construir en fases
futuras.

---

## 1. Problema identificado

El navbar horizontal y la sidebar duplicaban parcialmente los mismos
ítems (Proyectos, Cálculo rápido, Metrajes, Configuración aparecían
en ambos) sin un criterio de por qué esos 4 y no los otros 3
(Rubros/Descompuestos/Referencias solo en sidebar). Esto generaba
sensación de navegación "incompleta"/inconsistente.

---

## 2. Modelo de navegación nuevo

### Navbar (persistente, visible en cualquier pantalla)

- Mis Proyectos (volver a lo existente, sin importar dónde estés)
- Notificaciones, ayuda, cuenta

Razón: es la única acción que un usuario querría poder disparar desde
CUALQUIER pantalla de la app, sin importar en qué proyecto/sección
esté trabajando.

### Sidebar (portales de entrada + 3 categorías)

**Portales de entrada** (arriba de todo, como par — misma jerarquía
visual, uno junto al otro):
- Nuevo Proyecto
- Cálculo Rápido

Razón del cambio de ubicación: Cálculo Rápido se agrupa con Nuevo
Proyecto porque ambos son formas de EMPEZAR algo nuevo — no una
acción de "volver a algo existente" como Mis Proyectos, que por eso
sí se queda en el navbar persistente.

**Contextual al proyecto abierto:**
- Metrajes

**Global / catálogo (sin depender de ningún proyecto):**
- Rubros
- Descompuestos

**Sistema:**
- Configuración (ya existe, sin cambios)
- Referencias (expandida — ver sección 4)
- Sugerencias (nueva — ver sección 5)

---

## 2bis. Arquitectura de fases dentro de un proyecto

### Razón de ser

El presupuesto y la gestión de la obra ya ganada son etapas de
negocio distintas, con documentación y herramientas propias —
mezclarlas en una sola vista (como está hoy) no escala. Se decidió
separar en 3 pestañas de fase, visibles SOLO cuando hay un proyecto
abierto (patrón de navegación de 2 niveles: navbar global siempre
visible + fila de pestañas de fase que aparece/desaparece según el
contexto).

Inspirado en el análisis competitivo ya existente: KALYA SP 3.0
separa Presupuestos/Control de Obra/Certificación como módulos
propios; PRESTO tiene Presupuesto→Planificación→Certificaciones→
Control de costes.

### Estructura de navegación completa

**Navbar global (siempre visible):**
- Mis Proyectos
- Notificaciones, ayuda, cuenta

**Fuera de un proyecto (sidebar):**
- Nuevo Proyecto / Cálculo Rápido (portales de entrada, juntos)
- Biblioteca: Rubros, Descompuestos
- Sistema: Configuración, Referencias, Sugerencias

**Dentro de un proyecto — 2da fila de pestañas (aparece solo acá):**

### Pestaña 1 — Presupuesto (contenido ya existente, reorganizado)

- Documentación del llamado (NUEVA, ver sección 2ter): Pliego de
  Condiciones, Memoria del pliego, fotos, planos de referencia — solo
  subir/listar/descargar, sin lectura por IA en el MVP.
- Herramientas de cálculo: Metrajes, Cómputo Global de Materiales,
  Leyes Sociales/BPS, Detección de Partidas Faltantes, Actualización
  de precios por índice ICCV.
- Tabla de capítulos/rubros (sin cambios, fuera de alcance de este
  rediseño).
- Anexos de salida: Resumen del Presupuesto, Garantías, "Memoria del
  Presupuesto" (RENOMBRAR desde "Memoria Descriptiva" — es el anexo
  que la empresa entrega al cliente junto con el presupuesto,
  FEAT-AI-002; distinto de la Memoria del pliego que es
  documentación de entrada), Comparativo de Ofertas, Cronograma
  (estimado, de esta fase).

### Pestaña 2 — Gestión de Obra (nueva, sin implementar - placeholder)

- Contratación/Inscripciones (paso inicial/checklist al entrar a esta
  fase): contrato firmado, inscripciones BPS/DGI, permisos
  municipales. Es un hito único de transición, no una pestaña propia
  de primer nivel.
- Documentación de obra (consulta continua): planos técnicos,
  especificaciones actualizadas de obra en curso.
- Seguimiento: avance físico/porcentual, fotos, cronograma real,
  curva S, pagos.
- Corresponde al ítem E) del roadmap general ("Módulo Gestión de
  Obra") ya existente en la documentación del proyecto.

### Pestaña 3 — Certificación (nueva, sin implementar - placeholder)

Separada de Gestión de Obra porque cruza datos de las otras dos
fases (precio unitario de Presupuesto × % de avance real de Gestión
de Obra) para producir un documento de cobro formal — no es un dato
que viva naturalmente en un solo lugar.

Alcance MVP definido (sin certificación a subcontratistas por ahora
— el usuario no tiene experiencia de obras grandes para validar ese
caso, se agrega si aparece la necesidad real):

- Certificación del mes: calcula monto a certificar por período.
- Retenciones y descuentos: fondo de reparo, anticipos, retenciones
  contractuales.
- Historial de certificaciones: listado de certificados emitidos,
  monto, fecha, estado.
- Certificado de Obra (PDF): documento formal de salida para
  presentar al cliente.

Corresponde al ítem C) del roadmap general ("Certificaciones
básicas").

---

## 2ter. Documentación del llamado (nueva sección, alcance MVP)

Repositorio de entrada dentro de la pestaña Presupuesto — distinto de
Metrajes: acá se sube para CONSULTAR/ARCHIVAR (Pliego de Condiciones,
Memoria del pliego, fotos, planos de referencia general); en Metrajes
se sube un plano específicamente para MEDIR sobre él. Pueden ser el
mismo archivo físico, pero cumplen roles distintos y viven en
secciones distintas.

Alcance MVP: solo subir, listar y descargar archivos (PDF, imágenes).
Sin lectura automática por IA en esta primera versión.

---

## 3. Rubros y Descompuestos — hallazgo importante

Hoy ambos ítems del sidebar están VACÍOS en la UI. Hipótesis
confirmada por el usuario: nunca se construyó una pantalla real para
administrar el catálogo maestro de rubros (CapituloCatalogo/
SubcapituloCatalogo) ni la biblioteca de APUEstandar. Toda la gestión
de precios/APUs de la Fase 2 (334 registros) se hizo exclusivamente
vía scripts de Claude Code contra la base de datos, nunca desde una
UI.

Contenido a construir (fase futura, spec separada):

- **Rubros**: listado navegable Capítulo→Subcapítulo, buscador,
  precio actual + fuente/estado (conectar con FEAT-AI-006: mostrar si
  `requiereVerificacion`), alta de rubro nuevo a biblioteca.
- **Descompuestos**: vista/edición del APU estándar de cada rubro
  (materiales con rendimiento y precio, mano de obra SUNCA, equipos,
  %GG, %utilidad). Editar acá afecta futuros clonados, no proyectos
  ya existentes. Sería el lugar natural para resolver a mano los 8
  pendientes de precio documentados en `PENDIENTES-FASE2.md`.

---

## 4. Referencias — contenido a construir

Estructura interna sugerida (evitar que sea un cajón de sastre):

- **Normativa**: Lista MTOP N°599, convenio SUNCA vigente, leyes
  sociales, Decreto 643/988, MCG-MTOP 2006
- **Glosario**: contenido de `DOMAIN_GLOSSARY.md` volcado a la UI
- **Guías de uso**: cómo metrar, cómo cargar un plano (cuando
  exista), cómo usar el asistente de IA

No se crea un ítem "Ayuda"/"Tutorial" separado — todo el contenido
instructivo vive dentro de Referencias para evitar duplicar
funciones.

---

## 5. Sugerencias — nueva sección, alcance simple

Buzón de feedback del usuario (Luis / equipo del estudio) hacia el
producto. Alcance MVP:

- Formulario de texto libre + categoría opcional (bug / idea / falta
  algo)
- Guardado en tabla simple de base de datos, visible en un panel
  interno
- Sin notificación por email, sin sistema de votos/estado por ahora
- Visible solo para el equipo interno, no para clientes finales del
  SaaS (si en el futuro el producto tiene multi-tenant)

---

## 6. Metrajes — dos modos distintos, alcance definido

### Modo "Proyecto formal" (dentro de un proyecto, vía sidebar)

Prioriza precisión y trazabilidad. Flujo:

1. Subir archivo: PDF (posible multi-página) o imagen (foto de
   croquis). DWG queda para una fase posterior (requiere parseo de
   geometría vectorial vía DXF, más complejo).
2. Elegir página/plano si el PDF tiene varias hojas.
3. **CALIBRACIÓN DE ESCALA** (paso obligatorio, no saltable): el
   usuario traza una línea sobre un elemento de longitud conocida en
   el plano y especifica la medida real. El sistema calcula el factor
   de escala píxeles→metros.
4. Medición sobre el plano con herramientas: línea (ML),
   polígono/área (M²), punto (unidades).
5. Asignación de la medición a un rubro del presupuesto activo del
   proyecto — la cantidad medida se suma a la columna CANTIDAD de ese
   rubro.
6. El plano se guarda con las marcas trazadas, para auditoría visual
   posterior ("de dónde salió este número").

Decisiones de diseño para el MVP:

- Un proyecto puede tener VARIOS planos (planta baja, alta, cortes,
  etc.), no uno solo.
- Si se sube una nueva versión de un plano, no hay versionado
  automático en el MVP — es un plano nuevo e independiente, las
  mediciones viejas no se migran solas.
- Integración futura con FEAT-AI-001 (Asistente de Cómputo): el
  usuario podría trazar y describir en lenguaje natural qué es, y la
  IA asocia al rubro correcto.

### Modo "Cálculo Rápido" (portal de entrada separado)

Prioriza velocidad sobre precisión, coherente con el tagline "De la
medición al presupuesto en minutos". Flujo:

1. Usuario sube croquis/PDF/imagen.
2. La IA (con capacidad de visión) estima cantidades directamente,
   SIN calibración manual de escala por parte del usuario.
3. Resultado: presupuesto orientativo rápido.

Puente entre ambos modos: si un Cálculo Rápido se convierte en
proyecto formal (el cliente confirma), las cantidades estimadas por
IA se heredan al proyecto PERO quedan marcadas como "estimado por IA,
sin calibrar — requiere verificación en Metrajes" (mismo patrón
conceptual que `requiereVerificacion` de FEAT-AI-006, aplicado acá a
cantidades en vez de precios). No se debe confiar en esa cantidad
para un presupuesto formal entregado a un cliente sin pasar por
Metrajes primero.

---

## 7. Roadmap de implementación (en este orden, no todo junto)

1. Navbar + sidebar reorganizados (cambio de UI, bajo riesgo)
2. Rubros + Descompuestos como pantallas reales (spec de feature
   nueva, media complejidad)
3. Sugerencias (chico, bajo riesgo)
4. Metrajes con plano — modo proyecto formal (alta complejidad,
   probablemente requiere librería de manipulación de PDF/canvas en
   frontend)
5. Cálculo Rápido con visión de IA sobre plano (depende de que el
   modo proyecto formal ya esté probado)

---

## 8. Alcance — qué NO se toca en la implementación del navbar/sidebar

Cuando se implemente el punto 1 del roadmap (navbar + sidebar
reorganizados), el cambio debe limitarse ESTRICTAMENTE al navbar
horizontal y a la sidebar. Explícitamente NO se debe tocar:

- La página de inicio/landing interna (`/inicio`) con los dos
  portales "Cálculo Rápido" / "Nuevo Proyecto" (cards grandes) — esta
  pantalla ya está bien resuelta y no forma parte de este rediseño.
- La vista de detalle de un proyecto abierto (tabla de capítulos/
  rubros, botones Editar/Excel/PDF/Eliminar) — tampoco se toca en
  esta fase, salvo que se indique lo contrario en una tarea futura
  separada.

Esta sesión de rediseño es sobre navegación (navbar + sidebar)
únicamente. Cualquier cambio a esas dos pantallas requiere una
instrucción explícita y separada.

**Actualización — pestañas de fase (ver sección 2bis):** la
implementación de las pestañas "Gestión de Obra" y "Certificación"
queda como PLACEHOLDER únicamente en esta ronda (mostrar la pestaña,
con un mensaje tipo "Próximamente" o similar) — la funcionalidad
completa de cada una es trabajo futuro, fuera del alcance de la
sesión de reordenamiento de navegación actual.
