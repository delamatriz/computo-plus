# Pendientes de precio — Fase 2 (bug "clona a $0")

Registro centralizado de insumos que quedan **sin resolver a propósito**
dentro de la Fase 2, porque no se encontró una fuente de mercado
uruguayo verificable con fetch directo pese a búsqueda exhaustiva. No se
fuerza un número sin respaldo — se documentan acá para retomar cuando
aparezca una fuente confiable, y para que no se reabra la investigación
desde cero.

---

## Impermeabilizaciones — 6.6.6 (Espuma plast autotrabante sobre losas e=2,5cm)

**Insumo pendiente**: "Espuma plast autotrabante" (m², rendimiento 1,05).

**Estado**: código activo, precioUY guardado en $412,78 (heredado del
rubro SAU 2022, desactualizado) — el material en sí resuelve a $0 en
clonado real.

**Búsqueda realizada**: el fabricante correcto es **Montfrío** (mismo
grupo que Isopanel) — producto "Placa Autoencastre Poliestireno
expandido [EPS]", con patitas de encastre que generan cámara ventilada,
usado en azoteas invertidas. Coincide exacto con la descripción del
material. Sin embargo:
- La ficha de producto de Montfrío (montfrio.com.uy/placa-autoencastre/)
  no publica precio.
- 4 PDFs técnicos/lista de precios del propio dominio montfrio.com.uy
  devolvieron 404 en todos los intentos.
- Un revendedor (Justcrea.com) solo lista un producto distinto (Panel
  Aislante Autoportante con chapa galvanizada), no la placa EPS con
  patitas.
- Un precio de $650/unidad apareció en 2 snippets de búsqueda
  consistentes, pero sin verificación por fetch directo de ninguna
  página — no se usa como fuente confirmada.

**Conclusión**: sin fuente confiable. Queda pendiente.

---

## Vidrios — 7.4.7 (Espejo 3mm con colocación) y 7.4.8 (Espejo 4mm sin colocación)

**Insumos pendientes**: "Espejo 3mm" (m², rend 1,05), "Espejo 4mm" (m²,
rend 1,05), "Adhesivo para espejo" (kg, rend 0,3 — solo en 7.4.7).

**Estado**: ambos códigos activos, precioUY guardado en $3.645,00 y
$4.617,00 respectivamente (rubro SAU 2022, desactualizado) — los
materiales resuelven a $0 en clonado real.

**Búsqueda realizada** (9 fuentes intentadas, todas sin precio
accesible por fetch directo o sin match real):
Sodimac, Barraca, Vidriería Bia, Vidriería Express, CYPE (Generador de
Precios), MercadoLibre Uruguay (varios listados, 403 o sin precio
visible), "La Casa del Vidriero" (resultó ser una empresa peruana
homónima, no la uruguaya), Vitro Guard, Vidriería Carrasco (dominio
`vidrieriacarrasco.com.uy` no resuelve DNS).

**Única fuente con especificación exacta encontrada**: Vidriería Sobol
SA (Uruguay, real), vía licitación pública (comprasestatales.gub.uy,
ARCE Compra Directa 4/2020) — "espejo 3mm sin bisel, solo suministro" =
$800/m², "espejo 4mm sin bisel, solo suministro" = $1.300/m². Descartada
por dos motivos:
1. **Vintage** — cotización de 2020, ~6 años vieja.
2. **Naturaleza mayorista/licitación estatal por volumen**, no
   minorista de gama media/estándar (criterio usado en el resto del
   proyecto).

Se probó ajustar por inflación en dólares (US CPI, +29,03% acumulado
2020→2026, fuente in2013dollars.com/BLS — no se pudo acceder al
Índice de Costo de la Construcción de Vivienda del INE con el detalle
numérico necesario por cambio de metodología a mitad de período y
errores de certificado/contenido dinámico en las páginas del INE). Aun
con el ajuste, el precioUY resultante ($1.854,44 y $2.166,99) queda
**por debajo** del histórico 2022 ($3.645,00 y $4.617,00) — único caso
así en toda la Fase 2 hasta ahora, señal de que la fuente Sobol no es
comparable al resto del proyecto ni siquiera ajustada.

**"Adhesivo para espejo"**: sin ningún precio Uruguay encontrado (es un
producto de nicho, tipo Palmer Mirro-Mastic — adhesivo asfáltico
especial que no ataca el respaldo plateado del espejo, distinto de un
adhesivo genérico).

**Conclusión**: sin fuente confiable. Ambos códigos quedan pendientes.

**Estado del capítulo Vidrios**: 12/14 códigos resueltos y verificados
en vivo. Los 12 restantes (7.4.1, 7.4.2, 7.4.3, 7.4.4, 7.4.5, vidrio-007
corregido, vidrio-001 a vidrio-006) no tienen ningún insumo en $0,
confirmado en la auditoría de cierre.

---

## Estructura — 5.2.1, 5.2.2, 5.2.3 (Losa prefabricada Stalton H=10/15/19cm)

**Insumos pendientes**: "Losa Stalton H=10cm", "Losa Stalton H=15cm",
"Losa Stalton H=19cm" (m², rendimiento 1,05 cada uno) — el componente
**prefabricado** del sistema (viguetas pretensadas + bovedillas). El
hormigón de compresión (arena gruesa, cemento Portland, hierro para
hormigón armado) YA está resuelto como líneas propias del APU, creciendo
con el espesor — no incluir de nuevo al retomar este pendiente.

**Estado**: los 3 códigos activos, precioUY guardado en $3.828,81 /
$4.026,02 / $5.923,26 respectivamente (rubro SAU 2022, desactualizado)
— los materiales resuelven a $0 en clonado real.

**Búsqueda realizada**: se identificaron 2 fabricantes reales
uruguayos del sistema Stalton — **HOPRESA** (hopresa.com.uy, empresa
uruguaya desde 1958, fabrica Sistema Stalton Porteña y Sistema Stalton
de Hormigón) y **Mequis3** (mequis3.com.uy, losas prefabricadas tipo
HL/L/PT con vigueta reticulada + bovedilla). Ninguno de los dos publica
precio en ningún canal accesible (web, PDFs técnicos, fichas de
producto) — solo invitan a contactar por teléfono/WhatsApp/email.
MercadoLibre Uruguay bloqueó el fetch con 403. El único otro dato
encontrado (CYPE Uruguay "Losa llena" $4.704,27/m², 24cm) es un sistema
distinto (losa maciza tradicional, no aligerada con vigueta/bovedilla)
— no es sustituto válido. El Rubrado SAU 2022 solo reproduce los mismos
3 valores que ya teníamos guardados (no es una fuente nueva).

**A diferencia de otros pendientes de esta lista** (ej. Soporte para
canalón, que tenía la planchuela de EMAT como ancla real parcial), acá
no until ningún ancla parcial verificable — solo la bovedilla cerámica
suelta ($63,80/u, Lista MTOP) como componente aislado, sin precio de
vigueta pretensada en pesos uruguayos para combinar. Encadenar
estimaciones sobre 3 alturas distintas sin ningún dato real de anclaje
se descartó por baja confianza.

**Escalado no lineal entre los 3 espesores** (pedido explícito a
verificar antes de interpolar) queda **sin verificar** por falta de
datos de partida.

**Acción sugerida**: cotización telefónica/WhatsApp directa a HOPRESA
o Mequis3 (canal no accesible por herramientas de búsqueda web).

**Conclusión**: sin fuente confiable. Los 3 códigos quedan pendientes.

**Estado del capítulo Estructura**: 12/15 códigos resueltos y
verificados en vivo (incluye 10 ya sanos + sub-tanda 12b, hormigón
premezclado). Quedan 5.2.1, 5.2.2, 5.2.3 pendientes — capítulo dejado
abierto a propósito, sin auditoría de cierre completo.

---

## Cortinas de Enrollar — 7.5.1 (PVC) y 7.5.2 (Aluminio con relleno poliuretánico)

**Insumos pendientes**: "Cortina de enrollar PVC" (m², rend 1,05),
"Cortina de enrollar aluminio poliuretánica" (m², rend 1,05), "Cajón
para cortina de enrollar" (ml, rend 0,8 — compartido por ambos
códigos).

**Estado**: ambos códigos activos, precioUY guardado en $15.120,00 y
$29.160,00 respectivamente (rubro SAU 2022 original, misma
especificación "PVC completa"/"aluminio completa con relleno
poliuretánico con colocación" — a diferencia del Cartel de obra
(1.1), acá SÍ se confirmó que la especificación no cambió, por lo que
el número 2022 es genuinamente comparable) — los materiales resuelven
a $0 en clonado real.

**Confirmado antes de investigar**: el APU de ambos códigos modela
SOLO la cortina (lamas) + el cajón — ningún material de vidrio ni
marco de ventana. Se descartó la hipótesis de que fueran parte de un
sistema "monoblock" (marco+vidrio+cortina prefabricados), ya que un
monoblock real incluiría esos materiales en el descompuesto.

**Búsqueda realizada (dos rondas)**:
- **Ronda 1** — fuentes residenciales reales, con fetch directo:
  - Cortina de enrollar PVC: CYPE Uruguay, "Persiana enrollable de
    lamas PVC 45mm" (explícitamente "en cajón de persiana ya
    ejecutado", sin cajón) = $1.300,65/m² (solo materiales).
  - Cortina de enrollar aluminio poliuretánica: Bork Uruguay,
    "Aluminio Perfilada 45mm con relleno de poliuretano", caja
    aparte = $5.500/m² (blanco).
  - Diferencial PVC/aluminio confirmado con ficha real (no asumido):
    Alumex describe PVC como "protección UV" simple vs. aluminio
    "extrusionado con núcleo de poliuretano expandido" — premium de
    aislación térmica/acústica real, ~4,2x, coherente.
  - Cajón para cortina de enrollar: sin fuente directa por ml — solo
    derivado indirectamente comparando dos fichas CYPE ("sin cajón"
    $1.300,65/m² vs "con cajón monoblock" $2.082,77/m², espesores de
    lama distintos 45mm/37mm, ruido considerable) → diferencia
    ~$782/m², convertida a $/ml asumiendo una altura de vano no
    confirmada (~$938/ml) — estimación de baja confianza, cadena
    larga de supuestos.
- **Ronda 2** — se investigó si Aluminios del Uruguay vendía la
  tablilla con poliuretano o el cajón como accesorio suelto de
  monoblock (hipótesis descartada primero, pero investigada por las
  dudas): se encontraron componentes menores del cajón ("Tapa lateral
  p/cajón de cortina 200mm" USD 7,64/par, "Kit testero central p/cajón
  150mm") pero NO el cajón completo. La "Tablilla tubular panel
  opaco" resultó ser aluminio hueco sin relleno (peso 0,759 kg/m,
  demasiado liviano para llevar poliuretano) — no aplica a 7.5.2. La
  categoría "Monoblock" completa (40 productos) no tiene ninguna
  cortina poliuretánica ni cajón como ítem propio. Se buscaron
  también proveedores de cortinas METÁLICAS comerciales (Alvacor, TCM,
  Acecortinas, Cortinas Brescia, Infinito, Persianas TyC) — todos
  reales pero sin precio público (piden presupuesto a medida); el
  único precio comercial concreto encontrado (CYPE, $20.646,18 para
  una unidad de 300x220cm = $3.128,21/m²) es de **chapa de acero
  galvanizado**, material distinto a PVC/aluminio-poliuretánico, no
  aplica.

**Anomalía sin resolver**: con las fuentes residenciales (las únicas
disponibles), el precioUY nuevo caería ~70-76% respecto al histórico
2022 en AMBOS códigos a la vez — la caída más grande de toda la Fase
2, y a diferencia de otros casos (Cartel de obra), acá la
especificación 2022 SÍ es comparable, por lo que no hay una
explicación de "número huérfano" que la justifique. Hipótesis no
confirmada: los códigos podrían corresponder a una cortina de
enrollar de gama comercial/reforzada (coherente con "COMPLETA" en el
nombre y con estar en el capítulo "Subcontratos"), más robusta que la
persiana residencial liviana encontrada, pero no se pudo verificar
con ninguna fuente con precio público tras dos rondas de búsqueda.

**Conclusión**: sin fuente confiable que cierre. Ambos códigos quedan
pendientes — no se aplica el dato residencial disponible por la
magnitud de la caída sin explicación.

**Estado del capítulo Cortinas de Enrollar**: 0/2 resuelto — capítulo
queda completo pendiente.

---

## Gobernanza de datos — 17 precios sin script `fix-*`/`seed-*` dedicado

Auditoría de cierre de Fase 2: de las 334 filas de `PrecioMTOP` cargadas
en esta fase (`fechaLista=2026-07`, `numeroLista=0`), 17 no aparecían en
ningún archivo `scripts/fix-*.ts`, `seed-*.ts` ni `agregar-*.ts` del
repo — se sospechó inicialmente que eran inserciones puntuales sin
registro (Prisma Studio o SQL directo).

**Hallazgo**: no es así. Las 17 SÍ tienen historia real en `git log
-S<código>` — vienen de una tanda de expansión de biblioteca **anterior
a esta sesión de Fase 2** (commits `feat:`/`docs:` del 11-12/07/2026),
documentada con scripts `seed-*.ts` que existieron, se aplicaron a
producción y luego se borraron del repo (mismo patrón de limpieza que
usamos nosotros con los `_tmp-*.ts`) — por eso no aparecen hoy en
`scripts/`, aunque el commit que los agregó y los borró sigue en el
historial.

**Nota sobre el "adicional" del conteo**: la lista original de
"sueltos" tenía 9 nombres pero el conteo dio 10 — el décimo es
`MAT-ALAMBRE-GALV` (sin sufijo `N14`), un código casi duplicado de
`MAT-ALAMBRE-GALV-N14` (ese sí documentado en `fix-implantacion.ts`)
que quedó sembrado por separado en la tanda de "Colocación y amure de
aberturas".

Chequeo de plausibilidad (punto 2 de la tarea): los 17 precios están
dentro de rangos razonables para el producto que describen (verificado
por comparación con productos Sika/URUMIX ya conocidos en el resto del
proyecto, no por re-investigación). **Ninguno resultó sospechoso.**

### Sika — Puentes de Adherencia y Membranas Líquidas (7 códigos)

Origen: commits `a63b6f4` (Puentes de Adherencia, 11/07/2026), `095d2c1`
(Membranas Líquidas, 12/07/2026), `27d61f3` (Patología de Fachada,
11/07/2026), `2c6bbad` (SikaTop Seal-107, 11/07/2026) — todos con
mensaje de commit que documenta el producto, el uso técnico y el
subrubro donde se usa. Ninguno cita una barraca/retailer específico por
nombre (a diferencia de la Fase 2 propiamente dicha), pero sí documentan
el desglose de paquete comercial (bolsa/kit/rollo → $/unidad).

| Código | Precio | Origen | Clasificación |
|---|---|---|---|
| MAT-SIKADUR-32GEL | $2.003/kg (kit 1kg) | `a63b6f4` — puente de adherencia hormigón, uso puntual estructural | Origen reconstruido |
| MAT-SIKATOP-MODUL | $299,80/kg (~$1.499/bolsa 5kg) | `a63b6f4` — puente de adherencia mortero, método lechada | Origen reconstruido |
| MAT-SIKAFILL-ELASTICO | $237,90/kg (balde 20kg) | `095d2c1` — membrana líquida techos/terrazas | Origen reconstruido |
| MAT-SIKALASTIC-560 | $264,95/kg (balde 20kg) | `095d2c1` — membrana líquida premium | Origen reconstruido |
| MAT-SIKA-TEXTRAMA | $113,49/m² ($2.979/rollo 25×1,05m) | `3194ccc` (12/07/2026) — completa un precio que `095d2c1` había dejado explícitamente en $0 "pendiente de relevar"; desglose de paquete documentado | Origen reconstruido |
| MAT-SIKATOP-ARMATEC108 | $810/kg ($4.050/kit 5kg) | `27d61f3` — primer/puente para armadura, Patología de Fachada | Origen reconstruido |
| MAT-SIKATOP-SEAL107 | $190/kg ($4.750/bolsa 25kg) | `2c6bbad` — explícitamente marcado como "referencia media-baja del rango de mercado $4.583-6.291" | Origen reconstruido |

### Sueltos — Amure de aberturas, revoques URUMIX y otros (10 códigos)

| Código | Precio | Origen | Clasificación |
|---|---|---|---|
| MAT-MORTERO-AMURE | $18,50/kg | `fdc8717` (11/07/2026) — "Colocación y amure de aberturas", insumo faltante para que la biblioteca clone sin $0 | Origen reconstruido |
| MAT-ALAMBRE-GALV | $1.059,66/kg | `fdc8717` — mismo valor exacto que `MAT-ALAMBRE-GALV-N14` (real, Fase 2); parece copiado de esa fuente ya verificada | Origen reconstruido |
| MAT-CUNA-NIVEL | $85/gl | `fdc8717` | Origen reconstruido |
| MAT-SELLADOR-PERIM | $320/gl | `fdc8717` | Origen reconstruido |
| MAT-TARUGO-TORNILLO | $8,50/u | `fdc8717` | Origen reconstruido |
| MAT-SELLADOR-CART | $420/u (cartucho 300ml) | `fdc8717` | Origen reconstruido |
| MAT-INSUMOS-LIMPIEZA-FINAL | $17,50/m² | `27d61f3` — explícitamente "punto medio del rango $15-20/m2", sin desglosar bolsas/limpiavidrios/paños | Origen reconstruido (precio es una estimación de rango, documentada como tal desde el origen) |
| MAT-REVOQUE-2EN1 | $305,75/bolsa (25kg) | `7b85dc0` (11/07/2026) — revoques monocapa premezclados URUMIX | Origen reconstruido |
| MAT-REVOQUE-3EN1 | $320/bolsa (25kg) | `7b85dc0` — ídem | Origen reconstruido |
| MAT-POLIURETANO-AEROSOL | $290/lata | `3194ccc` (12/07/2026) — completa un precio que `fdc8717` había dejado explícitamente sin cargar ("no existe referencia confiable en ningún lado del sistema"); el commit documenta el precio final pero **no hay ningún diff que muestre la escritura en base** — se aplicó por fuera de cualquier script versionado | **Único caso sin reconstrucción completa** — precio plausible (retail típico de aerosol expansivo), pero el paso de carga en sí queda sin registro verificable |

### MAT-CARPMET-ACCESORIOS-MOTOR — sin script trazable (detectado en FEAT-AI-006 etapa 2)

Durante la migración de metadata de fuente estructurada (FEAT-AI-006,
etapa 2), al procesar los 165 códigos clasificados como REAL, este
código quedó sin poder migrarse: no aparece documentado en ninguno de
los 46 scripts `fix-*.ts`/`seed-*.ts` vigentes en el repo.

`fix-carpmet-familia.ts` lo menciona solo de pasada, indicando que
"Accesorios instalación motor portón CORREDIZO" (mismo valor de
referencia, $1.200) fue creado para `carpmet-008` ("Motor para portón
corredizo") en una tanda anterior no incluida en ese conjunto de
scripts. El único código MTOP con script propio documentado en el
conjunto actual es la variante `-BATIENTE`
(`MAT-CARPMET-ACCESORIOS-MOTOR-BATIENTE`, en
`fix-hierro-suelto-carpinterias.ts`), que es un código MTOP distinto.

**Estado**: el registro sigue activo en `PrecioMTOP` con su precio
$1.200/gl intacto (nunca se tocó ningún precio en esta auditoría) —
queda con los campos nuevos de FEAT-AI-006 (`proveedor`,
`nombreProducto`, etc.) en `null`/default, mismo tratamiento que los 17
casos de gobernanza ya documentados arriba. No se fuerza una fuente sin
respaldo.

**Conclusión**: sin script trazable. Queda pendiente para una futura
sesión que pueda ubicar el commit/origen real (probablemente en
historial de una tanda de expansión de biblioteca anterior a Fase 2,
mismo patrón que los 17 casos de gobernanza).

---

**Nota de proceso — `MAT-POLIURETANO-AEROSOL`**: recomendación hacia
adelante, no solo el dato archivado. Evitar cargas de precio por fuera
de script versionado (Prisma Studio/SQL directo sin commit). Todo
precio nuevo debe pasar por un script `fix-*`/`seed-*` aunque se borre
después de aplicarlo — el commit del script (incluso eliminado) es lo
que permite reconstruir el origen, como pasó con los otros 16 casos de
esta misma auditoría.

### Conclusión de la auditoría

De los 17: **16 con origen reconstruido** (commit, fecha, autor y
razonamiento técnico documentados, aunque sin cita de retailer
específico como en el resto de la Fase 2) y **1 caso parcial**
(`MAT-POLIURETANO-AEROSOL`: se sabe cuándo y por qué se cargó $290, pero
no hay script ni diff que lo respalde). Ningún precio resultó
sospechoso en el chequeo de plausibilidad. No se modificó ningún valor
en esta auditoría — es solo documentación del estado actual.
