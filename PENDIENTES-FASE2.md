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
