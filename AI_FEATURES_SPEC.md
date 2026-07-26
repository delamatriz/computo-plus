# PresupuestOra — Especificación de Features de IA

> Features que usan la API de Claude. Cada feature tiene: descripción, input, output esperado, prompt base, y estado.
> Claude Code debe usar estos prompts como punto de partida, no inventarlos desde cero.

---

## Principios generales de IA en PresupuestOra

1. **Dominio-específico:** Todos los prompts deben incluir contexto del dominio construcción-Uruguay en el system prompt.
2. **Degradable:** Si la API falla, el flujo funciona igual (sin sugerencia de IA).
3. **Transparente:** El usuario siempre sabe cuándo está viendo una sugerencia de IA vs. dato ingresado manualmente.
4. **Verificable:** La IA sugiere; el usuario confirma. Nunca escritura automática sin revisión.

---

## FEAT-AI-001 — Asistente de Cómputo Métrico

**Estado:** 🔲 Especificado, no implementado

**Descripción:** El usuario describe verbalmente un elemento a medir ("4 columnas de 30x30 de 3 metros de alto") y el sistema genera la fila de cómputo con dimensiones y cantidad calculada.

**Input:**
- Texto libre del usuario
- Contexto: partida activa (ej: "Hormigón en columnas — m³")

**Output esperado (JSON):**
```json
{
  "descripcion": "Columnas 30x30 (x4)",
  "dimensiones": { "largo": null, "ancho": 0.30, "alto": 3.00 },
  "cantidad_unitaria": 0.27,
  "repeticiones": 4,
  "subtotal": 1.08,
  "unidad": "m³",
  "nota": "Sección 0.30 × 0.30 × 3.00m × 4 unidades"
}
```

**System prompt base:**
```
Eres un asistente experto en cómputo métrico de construcción para Uruguay.
El usuario te describe un elemento a medir. Debes extraer las dimensiones, calcular la cantidad y devolver JSON estructurado.
Usa las convenciones uruguayas: m², m³, ml como unidades principales.
Si el input es ambiguo, devuelve el campo "ambiguedad" con la pregunta de aclaración.
Responde SOLO con JSON, sin texto adicional.
```

---

## FEAT-AI-002 — Sugerencia de APU uruguayo

**Estado:** 🔲 Especificado, no implementado

**Descripción:** El usuario crea una partida (ej: "Revoque fino interior — m²") y el sistema sugiere un APU completo con insumos, rendimientos y precios de referencia uruguayos.

**Input:**
- Nombre/descripción de la partida
- Unidad de medida
- Contexto opcional: tipo de obra, zona del país

**Output esperado (JSON):**
```json
{
  "partida": "Revoque fino interior",
  "unidad": "m²",
  "materiales": [
    { "insumo": "Cemento Portland", "unidad": "kg", "rendimiento": 8.5, "precio_ref_uyu": 45 },
    { "insumo": "Cal hidratada", "unidad": "kg", "rendimiento": 4.2, "precio_ref_uyu": 28 },
    { "insumo": "Arena fina lavada", "unidad": "m³", "rendimiento": 0.025, "precio_ref_uyu": 1800 }
  ],
  "mano_de_obra": [
    { "categoria": "Oficial", "rendimiento_m2_jornada": 12, "jornal_ref_uyu": 1200 },
    { "categoria": "Peón", "rendimiento_m2_jornada": 12, "jornal_ref_uyu": 950 }
  ],
  "leyes_sociales_porcentaje": 80,
  "gastos_generales_porcentaje": 15,
  "utilidad_porcentaje": 10,
  "precio_unitario_estimado_uyu": 485,
  "fuente": "Referencia CCOU + SUNCA 2025",
  "advertencia": "Precios de referencia. Verificar con cotizaciones actuales."
}
```

**System prompt base:**
```
Eres un experto en análisis de precios unitarios (APU) para la construcción en Uruguay.
Conoces los precios de materiales de la Cámara de la Construcción del Uruguay (CCOU),
los jornales del SUNCA, y las leyes sociales vigentes (~80% sobre jornal).
Cuando el usuario te pide un APU para una partida, devuelves un JSON estructurado con
materiales, mano de obra, rendimientos y precios de referencia en pesos uruguayos (UYU).
Siempre incluir advertencia de que son precios de referencia.
Responde SOLO con JSON válido.
```

---

## FEAT-AI-003 — Detección de partidas faltantes

**Estado:** 🔲 Especificado, no implementado

**Descripción:** El usuario tiene un presupuesto con N partidas. La IA analiza el conjunto y detecta partidas que típicamente acompañan a las existentes pero están ausentes.

**Input:**
- Lista de partidas actuales con sus rubros
- Tipo de obra (vivienda, comercial, industrial, etc.)

**Output esperado:**
```json
{
  "partidas_sugeridas": [
    {
      "rubro": "Instalaciones sanitarias",
      "partida": "Desagüe pluvial — ml",
      "motivo": "El presupuesto incluye cubierta de zinc pero no tiene desagüe pluvial asociado.",
      "prioridad": "alta"
    },
    {
      "rubro": "Terminaciones",
      "partida": "Pintura de cielorrasos — m²",
      "motivo": "Se presupuestó pintura de muros pero no de cielorrasos.",
      "prioridad": "media"
    }
  ]
}
```

**System prompt base:**
```
Eres un arquitecto senior y presupuestador experto en construcción uruguaya.
Analiza el siguiente presupuesto de obra y detecta partidas que probablemente faltan,
basándote en las que sí están presentes y en las prácticas habituales de la construcción en Uruguay.
Para cada sugerencia, explica brevemente por qué la recomiendas.
Responde SOLO con JSON válido.
```

---

## FEAT-AI-004 — Memoria descriptiva automática

**Estado:** 🔲 Especificado, no implementado

**Descripción:** A partir del presupuesto completo, la IA genera un borrador de memoria descriptiva en español formal, con la descripción de materiales y técnicas constructivas por rubro.

**Input:**
- Presupuesto completo (rubros → partidas → insumos del APU)
- Nombre del proyecto, ubicación, tipo de obra

**Output esperado:**
- Texto en español formal, estructurado por rubro
- ~500–1500 palabras según complejidad
- Listo para copiar a documento Word o PDF

**System prompt base:**
```
Eres un arquitecto uruguayo redactando la memoria descriptiva de un proyecto de construcción.
A partir del presupuesto que te proveo, redacta una memoria descriptiva formal en español,
describiendo los materiales y técnicas constructivas rubro por rubro.
El tono debe ser técnico pero claro. Usa terminología de la construcción uruguaya.
No inventes especificaciones que no surjan del presupuesto.
```

---

## FEAT-AI-005 — Actualización de precios por índice INE

**Estado:** 🔲 Especificado, no implementado

**Descripción:** El usuario ingresa un presupuesto en una fecha base y quiere actualizarlo al valor actual según el Índice de la Construcción del INE.

**Input:**
- Presupuesto total o desglosado
- Fecha base del presupuesto
- Índice INE fecha base (obtenido de API INE o ingresado manualmente)
- Índice INE fecha actual

**Lógica:** `Precio actualizado = Precio base × (Índice actual / Índice base)`

**Nota de implementación:** El INE Uruguay publica el índice en su sitio web. Evaluar si hay API pública o si requiere scraping/ingreso manual.

---

## Implementación técnica de IA (patrón general)

```typescript
// Patrón base para llamadas a Claude API en PresupuestOra
async function callClaudeAI(feature: AIFeature, input: object): Promise<object> {
  const systemPrompt = AI_PROMPTS[feature]; // prompts del spec arriba

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: JSON.stringify(input) }]
  });

  // Siempre parsear como JSON, siempre validar
  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return JSON.parse(text); // agregar try/catch y fallback
}
```

**Modelo a usar:** `claude-sonnet-4-20250514` para todas las features (balance costo/calidad).

---

## FEAT-AI-006 — Actualización periódica de precios de mercado libre

**Estado:** 🔲 Especificado, no implementado

**Descripción:** Durante la Fase 2 del bug "clona a $0" (jul 2026) se cargaron 334 precios de mercado libre sin mecanismo de actualización. De esos, 164 tienen fuente real/verificada (Sodimac, Fivisa, EMAT, Barraca, CYPE, etc.) y son candidatos a actualización automática periódica, similar a FEAT-AI-005 pero aplicado insumo por insumo en vez de a un índice único. Los otros 153 (estimaciones gruesas sin fuente estructurada) quedan explícitamente FUERA de esta feature — no hay fuente real contra la cual reconsultar, así que automatizarlos solo produciría una nueva estimación, no una corrección real.

**Cambio de schema necesario:**

Hoy la fuente vive como texto libre en comentarios de scripts (ej: "Sodimac Uruguay, Durlock Estándar, 1,20x2,40m"). Se necesitan campos estructurados nuevos en `PrecioMTOP` (o tabla relacionada `FuenteMercado`):

```
proveedor                String   // ej: "Fivisa", "Sodimac Uruguay"
nombreProducto           String   // ej: "Conduit PVC 20mm, Tuboform"
urlReferencia            String?  // opcional, si existe ficha de producto pública
fechaUltimaVerificacion  DateTime
umbralAlertaPorcentaje   Float    @default(17.5) // configurable por insumo
requiereVerificacion     Boolean  @default(false)
```

**Migración de los 164 existentes:** no full-automática de entrada. Proponer un script asistido que:
1. Lea los comentarios de los 56 scripts fix-*.ts + 7 seed-*.ts identificados en la auditoría de Fase 2.
2. Parsee proveedor/producto con un patrón simple (regex sobre "Fuente: X, Y").
3. Genere un dry-run del mapeo propuesto para revisión humana antes de aplicar — mismo criterio de dry-run→apply que se usó en toda la Fase 2, porque un parseo automático de texto libre puede fallar en casos ambiguos.

**Lógica del job (frecuencia: trimestral, no mensual como MTOP — estos insumos se mueven más lento):**

Para cada uno de los 164 registros con fuente estructurada:
1. Arma un prompt con Claude + web_search consultando el precio actual del proveedor/producto registrado.
2. Compara el precio nuevo contra `precioUY` guardado.
3. Si la diferencia es MENOR al `umbralAlertaPorcentaje` (default 17,5%): actualiza automáticamente, actualiza `fechaUltimaVerificacion`, sin intervención humana.
4. Si la diferencia es MAYOR al umbral: NO actualiza solo. Marca `requiereVerificacion = true` y lo agrega a una cola de revisión — mismo criterio que se aplicó manualmente en Fase 2 con casos como el Cartel de obra (-80%) o Cortinas de Enrollar (-76%), donde un salto grande siempre mereció ojo humano antes de aceptarlo.

**Output esperado (JSON, por insumo):**
```json
{
  "insumo_id": "conduit-pvc-20mm",
  "proveedor": "Fivisa",
  "precio_anterior": 54.47,
  "precio_nuevo_encontrado": 58.00,
  "variacion_porcentual": 6.5,
  "accion": "actualizado_automatico",
  "fecha_verificacion": "2026-10-15",
  "fuente_verificada": true
}
```
o, si supera el umbral:
```json
{
  "insumo_id": "cortina-enrollar-pvc",
  "proveedor": "CYPE Uruguay",
  "precio_anterior": 1300.65,
  "precio_nuevo_encontrado": 350.00,
  "variacion_porcentual": -73.1,
  "accion": "requiere_verificacion",
  "motivo": "Variación supera el umbral configurado (17.5%)",
  "fecha_verificacion": "2026-10-15",
  "fuente_verificada": true
}
```

**System prompt base:**
```
Eres un asistente que verifica precios de materiales de construcción en el
mercado uruguayo. Se te da un proveedor y un nombre de producto ya conocido,
con su precio anterior registrado. Tu tarea es buscar el precio ACTUAL de ese
mismo producto en ese mismo proveedor (o el más cercano equivalente si el
producto exacto ya no está disponible) y devolver el precio encontrado.
No inventes precios: si no encontrás el producto o el proveedor ya no lo
vende, indicalo explícitamente en vez de estimar.
Responde SOLO con JSON válido, con el formato especificado.
```

**Degradabilidad:** si el proveedor ya no vende el producto, si el fetch/búsqueda falla, o si no se encuentra nada:
- El precio existente NUNCA se borra ni se deja en $0.
- Se marca `requiereVerificacion = true` con un motivo tipo "producto_no_encontrado" o "fuente_no_disponible".
- El precio viejo permanece activo (con su fecha de última verificación exitosa) hasta que una corrida futura o una revisión manual lo actualice.

**Costo estimado:** 164 insumos × 1 búsqueda liviana cada uno, corrida trimestral. Esto es un volumen bastante menor al trabajo ya realizado durante toda la investigación manual de Fase 2. Aun así, se recomienda revisar el límite de gasto mensual de la cuenta Anthropic en console.anthropic.com antes de activar el job (un agente ya se cortó por este límite durante la auditoría de gobernanza de datos del cierre de Fase 2).

**UI/Visibilidad:** una vista simple en el panel de administración interno (no visible para el cliente final del SaaS) que liste los registros con `requiereVerificacion = true`, mostrando precio anterior, precio nuevo encontrado, variación porcentual y proveedor — permitiendo aprobar o descartar cada cambio con un clic, similar en espíritu al flujo de dry-run→apply usado manualmente en Fase 2.

**Criterio de ingreso/egreso respecto a los 153 de estimación gruesa:** si en el futuro alguno de los 153 consigue una fuente real verificable (ej: por contacto telefónico directo a un proveedor, como se está haciendo con los 8 pendientes documentados en PENDIENTES-FASE2.md), ese registro migra del grupo "sin fuente estructurada" al grupo cubierto por esta feature: se le completan los campos `proveedor`/`nombreProducto`/`urlReferencia`, y a partir de ahí entra al ciclo de verificación trimestral automático.
