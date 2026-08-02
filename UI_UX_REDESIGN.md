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

## 2quater. Ajuste: Metrajes como biblioteca + Documentación para metrar

> **Nota:** el contenido de "Documentación para metrar" (3 secciones vs.
> 2) y el diseño del Visor (documento fijo + lista + ventana flotante)
> descritos acá quedaron reemplazados por el diseño final en la sección
> **2quinquies**. El cambio de rol de "Metrajes" en el sidebar (más
> abajo) sigue vigente sin cambios.

### Cambio de rol de "Metrajes" en el sidebar

"Metrajes" deja de ser la página de TRABAJO de un proyecto específico
(que hoy vive en `/proyectos/[id]/metrajes` con su propia URL en el
sidebar) y pasa a ser una BIBLIOTECA DE CONSULTA, mismo patrón que ya
se aplicó con Rubros/Descompuestos → Biblioteca:

- Permite ver cómo se midió en otros proyectos ya trabajados, como
  referencia (ej. "ya medí un apartamento parecido, veo cómo lo
  hice").
- Vive en el sidebar, fuera del contexto de un proyecto específico
  (mismo lugar donde ya está hoy, pero cambia su contenido/propósito).
- Alcance de esta biblioteca (a definir en detalle cuando se
  implemente): probablemente de solo consulta al inicio, similar al
  alcance MVP de la Biblioteca de Rubros.

### Nueva tarjeta: "Documentación para metrar" (específica del proyecto)

Vive dentro de la pestaña Presupuesto, junto a "Documentación del
llamado" (ya existente, sección 2ter) — las DOS tarjetas lado a lado,
arriba de la tabla de capítulos/rubros.

Contenido de "Documentación para metrar" (migra lo que hoy vive en la
página separada `/metrajes`):

- **Planos y documentos**: lista de planos/detalles ya subidos
  (nombre, fecha, peso, ver/eliminar) + botón para subir nuevo. Al
  hacer click en "ver", abre el VISOR (pantalla separada, ver más
  abajo).
- **Fotos de relevamiento**: lista de fotos ya subidas + botón para
  agregar. Fotos generales de apoyo para medir, no necesariamente
  atadas a un plano específico.
- **Notas**: campo de texto libre (observaciones del relevamiento,
  accesos, estado del lugar).

Diferencia con "Documentación del llamado": esa es para PLIEGO/
MEMORIA DEL PLIEGO/fotos y planos de REFERENCIA GENERAL del llamado a
licitación (solo consultar/archivar). "Documentación para metrar" es
específicamente el material que se usa para MEDIR y completar la
Planilla de Cómputo de este proyecto.

### Pantalla "Visor" (ya implementada, sin cambios de esta sesión)

Al abrir un plano desde "Documentación para metrar", se entra al
visor: layout de 3 columnas (Planos+Planilla de Cómputo | Visor con
zoom/pan | Notas + Fotos complementarias), todo visible sin necesidad
de scroll. Ajustes de esta sesión sobre el visor:

- Notas se ubica DEBAJO del visor (compacta), no en columna aparte.
- Columna de Fotos/Detalles más angosta, para dar más ancho al visor.
- Botones de acción (Agregar foto, Analizar con IA) visibles arriba
  de la columna, no al final (evitar que queden ocultos tras scroll —
  se detectó que el propio usuario no los había visto hasta ahora).

---

## 2quinquies. Diseño final — Documentación para metrar + Visor

Reemplaza el contenido de "Documentación para metrar" y el diseño del
Visor descritos en la sección 2quater con el diseño final, definido en
sesión de diseño dedicada. El cambio de rol de "Metrajes" en el
sidebar (biblioteca de consulta) no se toca, sigue como en 2quater.

### Página 1 — "Documentación para metrar" (dentro de Presupuesto)

Card colapsable, mismo patrón visual, tamaño y color que "Documentación
del llamado" (sección 2ter) — ambas tarjetas quedan visualmente
equivalentes entre sí (se le sacó a "Documentación del llamado" la
frase "para consultar y archivar" para igualar el alto de las dos
cards colapsadas).

Al expandir, TRES secciones independientes, cada una con su propio
listado + subida (no una sola lista mixta):

- **Planos y documentos** (PDF, JPG, DWG — DWG se acepta solo como
  metadata/tipo de archivo por ahora, sin parseo de capas ni soporte
  real; ese trabajo sigue fuera de alcance, ver sección 6 "Fuera de
  alcance — fase futura").
- **Fotos de relevamiento** (JPG, PNG) — deja de ser "complementaria a
  un plano específico" (como era hasta esta sesión) y pasa a ser una
  categoría propia e independiente, al mismo nivel que Planos y
  Detalles.
- **Detalles** (JPG, PDF).

Cada sección lista lo ya guardado (nombre, fecha, peso) con dos
controles diferenciados por ítem (mismo patrón ya aplicado en esta
sesión a la card de Planos): flecha para abrir ese documento en el
Visor, papelera aparte para eliminar.

### Página 2 — Visor (mismo mecanismo de estado, sin cambiar URL)

- El documento que se usó para abrir el visor (normalmente un plano)
  queda FIJO y grande en el centro, con los controles de zoom/pan ya
  existentes — no se reemplaza por navegar a otro documento.
- Lista de TODOS los documentos guardados del proyecto (las 3
  categorías juntas: Planos, Fotos, Detalles) accesible desde el
  visor, para abrir cualquiera sin volver a la Página 1.
- Click en un documento de categoría **Plano** desde esa lista:
  reemplaza el documento fijo central (es el único slot de "documento
  principal", tiene sentido que otro plano lo reemplace ahí).
- Click en una **Foto** o **Detalle** desde esa lista mientras el
  documento principal está abierto: se abre como VENTANA FLOTANTE
  encima del visor — no reemplaza ni tapa por completo al documento
  principal, es una ventana movible/cerrable tipo overlay liviano (sin
  fondo oscuro de pantalla completa) que el usuario cierra cuando ya
  consultó lo que necesitaba. El documento principal permanece visible
  y fijo detrás en todo momento.
- **Notas**: pasa a ser UNA SOLA por proyecto (no una por plano/
  documento como hasta esta sesión), campo de texto simple, ubicada
  DEBAJO del visor.
- **Planilla de Cómputo**: se ubica al costado del Visor, en la misma
  columna redimensionable (divisor arrastrable) que ya existía —
  decisión de diseño: el flujo de trabajo real es "mirar el plano →
  anotar la medida en la planilla" en un loop constante, y tenerlas
  lado a lado evita perder de vista el plano cada vez que se completa
  una fila (contra ponerla arriba/abajo, que obligaría a scrollear
  entre una y otra en cada medición). Calculadora rápida se mantiene
  junto a la Planilla, como hasta ahora.

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

## 6. Metrajes con plano — diseño completo

Reemplaza y expande la spec breve de la sección anterior con el
diseño completo de la feature, definido en sesión de diseño
dedicada.

### Principio no negociable

La IA NUNCA inventa un dato que no tiene evidencia de conocer. Si
para calcular una medición necesita un dato que no está en el plano
(ej: una altura de muro, que normalmente no aparece acotada en una
planta), DEBE preguntarle al usuario ese dato puntual antes de
calcular — nunca asume, estima, ni completa con un valor por defecto
sin avisar. Mismo principio ya aplicado en toda la Fase 2 de precios
(nunca forzar un número sin fuente).

### Etapa 1 — Subida y visor del plano

- Un proyecto puede tener varios planos (planta baja, alta, cortes,
  etc.), cada uno independiente.
- Tipos de archivo en esta fase: PDF (elegir página si tiene varias)
  e imágenes (JPG/PNG) — incluye fotos de croquis a mano. DWG y
  BIM/IFC quedan explícitamente FUERA de esta fase (ver nota al
  final).
- FOTOS COMPLEMENTARIAS: además del plano principal, el usuario
  puede adjuntar fotos de apoyo (ej. estado real de un muro, detalle
  que el plano no deja claro). No reemplazan al plano calibrado —
  son contexto adicional que el Modo B (análisis por IA) puede usar
  junto al plano al generar mediciones. Posible reutilización de las
  fotos ya subidas en "Documentación del llamado" si son las mismas.
- Visor con zoom y desplazamiento (pan).
- Requiere rasterizar PDF a imagen para poder dibujar encima con
  precisión en la Etapa 3 (librería tipo pdf.js).

### Etapa 2 — Calibración de escala (obligatoria antes de medir)

Dos métodos, según lo que tenga el plano:

- **Método A — Por cota:** el plano tiene al menos una cota (medida
  real escrita). El usuario traza una línea sobre esa cota y escribe
  la medida real; el sistema calcula el factor píxel→metro.
- **Método B — Por escala declarada:** el plano no tiene cotas, pero
  el usuario sabe la escala del dibujo (ej. "1:100"). La ingresa
  directamente, sin trazar nada.
- **Sin calibración posible:** si el plano no tiene cotas NI el
  usuario conoce la escala, NO SE PUEDE medir con precisión. El
  sistema debe bloquear la medición con un mensaje explícito.
- Cada plano tiene su propia calibración independiente.

### Etapa 3 — Medición, dos modos

**Modo A — Manual (visor):** el usuario traza directamente sobre el
plano ya calibrado, con herramientas de:

- Línea (ML): elementos lineales (cañerías, zócalos, vigas)
- Polígono/Área (M²): click punto por punto delimitando una
  superficie (fórmula de polígono / shoelace formula)
- Punto (unidad): conteo de elementos puntuales (artefactos,
  columnas, ventanas)

Cada medición trazada queda dibujada y visible sobre el plano.

**Modo B — Por IA:** la IA analiza el plano YA CALIBRADO (más las
fotos complementarias si existen), identifica las cotas/elementos, y
genera las mediciones (áreas, longitudes) para los rubros que
reconoce. Si necesita un dato que no está disponible en el plano ni
en las fotos (ej. altura de un muro no acotada), pregunta
explícitamente al usuario ese dato puntual antes de calcular — no
asume ni inventa. Relacionado con FEAT-AI-001 (Asistente de Cómputo
Métrico), aplicado sobre el plano completo en vez de descripción
manual elemento por elemento.

### Herramientas del Visor — estado y roadmap

Detalle de implementación del Modo A (manual) de la Etapa 3 —
actualizado a medida que cada herramienta se construye. La lista de
herramientas de Modo A de más arriba queda como la intención
original; esta sección es la fuente de verdad de qué está hecho, qué
sigue, y en qué orden.

#### Ya implementado

- **Línea** (medición de longitud): dibujar sobre el plano ya
  calibrado, calcula la longitud real, se asocia a un rubro, se
  refleja en la Planilla de Cómputo. Con capacidad de eliminar.
  (Commit `5c3d3f7`)

#### Próximo: Área

- Dibujar un polígono (click punto por punto) sobre el plano ya
  calibrado, calcula el área real en m² (fórmula de polígono /
  shoelace), se asocia a un rubro, se refleja en la Planilla de
  Cómputo. Mismo patrón de UX que Línea (modal de confirmación,
  panel de mediciones con papelera para eliminar).

#### Después: Marca de referencia (nueva, no estaba en el diseño original)

Herramienta de ANOTACIÓN, no de medición — permite dejar una marca
simple (una letra, ej. "A", "B", "C") en un punto específico del
plano, a modo de referencia visual rápida. NO se asocia a ningún
rubro ni genera ninguna fila en la Planilla de Cómputo.

El significado completo de cada letra se explica en el campo Notas
que ya existe debajo del Visor (ej: el usuario escribe en Notas "A =
revisar con el ingeniero, no queda claro el espesor del muro") — la
marca en el plano es solo la referencia visual corta, el detalle
vive en Notas, reutilizando lo que ya existe en vez de agregar texto
libre por cada marca individual.

Detalles de implementación a definir cuando se aborde (cómo se elige
la letra siguiente, cómo se edita/borra la marca).

#### Orden de implementación confirmado

1. Línea ✅
2. Área (próxima ronda)
3. Marca de referencia (después de Área) — letra simple + explicación
   en Notas
4. Punto (conteo de elementos) — ya estaba en el diseño original,
   reordenado después de estas dos según prioridad del usuario

### Etapa 4 — Asignación a rubro

- El usuario (o la IA, con confirmación) asigna cada medición a un
  rubro del presupuesto activo del proyecto.
- El valor se SUMA a la columna CANTIDAD de ese rubro (acumula, no
  reemplaza).
- El plano queda guardado con todas las marcas trazadas, para
  auditoría visual posterior.

### Diferencia con Cálculo Rápido — IMPORTANTE, no confundir

Cálculo Rápido usa ÚNICAMENTE una versión simplificada del Modo B:
el usuario sube una foto/croquis con medidas YA ESCRITAS, y la IA
las lee directamente para estimar. NO HAY visor, calibración formal,
ni Modo A. Las cantidades de Cálculo Rápido, si se convierten en
proyecto formal, quedan marcadas como "estimado, sin calibrar -
requiere verificación en Metrajes" (ya documentado en sección 2bis).

### Fuera de alcance — fase futura (no diseñada en detalle aún)

DWG (geometría vectorial real, requiere parseo de capas vía DXF) y
BIM/IFC (modelo con propiedades semánticas, un nivel más allá de
DWG) quedan EXPLÍCITAMENTE fuera de esta fase de diseño. Ya se sabe
que su lugar natural es DENTRO de Metrajes, como un tercer/cuarto
tipo de fuente de plano (junto a PDF e imagen) — no requiere
rediseñar la arquitectura cuando se aborde, solo sumar el soporte
técnico correspondiente en su momento, con su propia sesión de
diseño dedicada (el problema técnico de leer capas DXF o propiedades
IFC es sustancialmente distinto a calibrar una imagen plana).

### Roadmap de implementación sugerido (dentro de esta feature)

1. Etapa 1 (subida + visor + fotos complementarias) — base técnica
2. Etapa 2 (calibración, ambos métodos)
3. Etapa 3, Modo A primero (manual) — más simple de construir
4. Etapa 4 (asignación a rubro)
5. Etapa 3, Modo B (análisis por IA, con apoyo de fotos) — al final
6. (Futuro, fuera de esta fase) DWG / BIM

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
