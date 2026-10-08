# Análisis adversarial de la interfaz

Revisión crítica de la primera versión, qué se cambió y qué queda pendiente.
Método: lectura del código, recorrido de las seis pestañas, capturas reales con Chrome
headless a 1440×1180 y 390×844, revisión de foco de teclado y de tamaños táctiles.

---

## Hallazgos y correcciones

### 1. La app informaba pero no dirigía

Mostraba números correctos y ninguna indicación de qué hacer con ellos. Al abrir, la persona veía
un panel lleno de cifras sin un próximo paso: ¿marco pagos?, ¿falta algo?, ¿está bien así?

**Corregido:** `src/domain/advice.ts` convierte el estado del mes en hasta tres acciones concretas
y ordenadas por urgencia (advertencias primero), cada una navegable a la pestaña donde se resuelve.
Es lógica pura y con pruebas: «Falta el sueldo de Luis», «Ningún gasto marcado como pagado»,
«Ana → Luis: 600», «Registra el ahorro real del mes».

### 2. Jerarquía visual plana

El hero, las tarjetas de persona, las de categoría y la tabla compartían el mismo marco, radio y
borde. Todo gritaba igual, así que nada destacaba.

**Corregido:** retícula editorial de 12 columnas con anchos intencionados (hero 8, acciones 4,
personas 4, liquidación 5, gráfico 7, detalle 12), entrada escalonada y tres niveles de elevación
en lugar de uno.

### 3. El acento violeta lo invadía todo y chocaba con una persona

`--accent` se usaba para badges, pestaña activa, barras, progreso, botones y el degradado del hero.
Peor: el color de la primera persona (`#6d5efc`) era casi el mismo violeta, así que «Ana» y «la
interfaz» eran indistinguibles.

**Corregido:** el acento queda reservado para interacción; los colores de persona pasan a turquesa
`#2dd4bf` y magenta `#f472b6`, lejos del violeta. Las tarjetas de persona ahora llevan un riel de
color propio.

### 4. Emoji como iconografía

🏠💡📺 se dibujan distinto en cada sistema, son multicolor (chocan con la paleta), tienen tamaño
óptico inconsistente y envejecen mal junto a tipografía precisa.

**Corregido:** 24 iconos monocromos generados con `gpt-image-2.5` en fal.ai y recortados por
`scripts/slice-icons.mjs`. Se pintan con `mask-image`, así adoptan el color del tema y el de cada
categoría desde un único PNG. Hay selector de icono por gasto.

### 5. Cambiar un valor no daba ninguna señal

Editar un monto no producía confirmación visual; las barras saltaban de golpe; nada acusaba recibo
de un toque.

**Corregido (CSS puro):** onda al pulsar botones, hundimiento al hacer clic, anillo del hero que se
dibuja animando `@property --ring-value`, barras de reparto y de historial que crecen, barras de
progreso que se despliegan, interruptores con curva de resorte, entrada escalonada de las tarjetas,
realce y desplazamiento al pasar por una fila, y un punto «guardado» en la cabecera que se enciende
con cada cambio de estado.

### 6. `confirm()` nativo como única red de seguridad

Bloqueaba el hilo, rompía el lenguaje visual y no ofrecía vuelta atrás para acciones
irreversibles (eliminar un gasto, borrar todo).

**Corregido:** toasts con **Deshacer** que guardan el estado previo. Aplicado a eliminar, archivar,
duplicar, restablecer el mes, cargar el ejemplo y borrar todo. El `confirm()` desapareció por
completo.

### 7. Los campos numéricos confirmaban en cada tecla

Escribir «1.500» disparaba cuatro recálculos del panel con valores intermedios (1, 15, 150…) y los
totales parpadeaban con cifras basura.

**Corregido:** el valor se confirma al salir del campo o con Enter; Escape cancela. Mientras está
sucio, el campo se resalta.

### 8. Navegación móvil fuera del alcance del pulgar

Seis pestañas en una tira con scroll horizontal: las últimas eran invisibles hasta descubrir el
gesto, y la activa podía quedar fuera de pantalla. La cabecera pegajosa se comía ~110 px de alto.

**Corregido:** barra inferior fija en móvil con icono y etiqueta, `env(safe-area-inset-bottom)`,
objetivos de 52 px, y una cabecera de una sola fila compacta. La tira superior se mantiene en
escritorio.

### 9. Dos tablas densas que en el teléfono eran listas interminables

El «Detalle del mes» (8 filas × 6 campos) y la edición del mes (7 columnas con interruptores,
selectores y campos) obligaban a hacer scroll horizontal o a recorrer ~50 líneas.

**Corregido:** el detalle conserva la tabla en escritorio y se apila como tarjeta en móvil con
etiquetas; la edición del mes dejó de ser una tabla y pasó a filas con resumen legible
(icono, nombre, aporte de cada uno, monto, controles) que se reorganizan en tres columnas.

### 10. Foco de teclado invisible

No había `:focus-visible`: quien navega con teclado no sabía dónde estaba.

**Corregido:** anillo de foco en todo, enlace «saltar al contenido», `aria-current` en la
navegación, `role="status"` con `aria-live` en los avisos, `role="progressbar"` en el progreso,
`<caption>` para lectores de pantalla en la tabla principal y `aria-label` en cada control de fila.

### 11. Objetivos táctiles por debajo de 44 px

Botones `btn-sm` de ~28 px y el interruptor de 42×24 px.

**Corregido:** en móvil todo control interactivo tiene 44 px de alto mínimo.

### 12. Detalles del hero que no aguantaban una mirada de cerca

El porcentaje aparecía dos veces (en el anillo y en un degradado enorme al lado), la leyenda de la
marca se dibujaba con un `clip-path` frágil y la columna de texto quedaba de ~250 px.

**Corregido:** el anillo es el protagonista y el resultado se muestra en una línea tipográfica, la
marca usa el icono real de la app y el texto respira.

### 13. Estados vacíos pobres

Solo el catálogo tenía uno real; el resto mostraba ceros.

**Corregido:** estados vacíos con acción en catálogo, gastos del mes, categorías y detalle.

### 14. Sin enlaces profundos

No se podía compartir «el historial» ni volver a una sección concreta.

**Corregido:** la pestaña vive en el hash (`#gastos`, `#historial`…).

---

## Lo que decidí **no** hacer

- **Sin frameworks CSS.** Todo es CSS propio: tokens, `@property`, `@keyframes`, `mask-image`,
  `conic-gradient` y View Transitions. Cero dependencias nuevas de estilo.
- **Sin librería de gráficos.** El donut, las barras y las barras apiladas son SVG y divs propios.
- **Sin `skeleton` de carga.** No hay asincronía: mostrarlos sería teatro.
- **Sin animar el cambio de mes.** Solo se anima el cambio de pestaña; animar cada tecla del
  selector de mes mareaba.
- **Sin tocar el motor de cálculo.** El redondeo por resto mayor y la equivalencia
  aportes = gastos se mantienen intactos y cubiertos por pruebas.
- **`confirm()` no se sustituyó por un modal propio, sino por deshacer.** Para acciones
  reversibles, deshacer es mejor que preguntar.

## Verificación

- 54 pruebas: motor de cálculo (32), sugerencias e iconos (10), reducer (8), y un recorrido de la
  interfaz real montada en jsdom que navega las seis pestañas, cambia un sueldo y deja caer la
  nueva cifra en el cálculo (4).
- `tsc` sin errores, `oxlint` sin avisos, build de PWA correcto (40 entradas en precaché).
- Capturas reales en escritorio y móvil para revisar el resultado, no solo el código.

## Pendiente para otra iteración

- **Contraste de las etiquetas pequeñas**: `--faint` sobre `--surface-2` ronda 4,4:1; subirlo.
- **Selector de icono con búsqueda** cuando el catálogo pase de ~24 iconos.
- **Arrastrar para reordenar** los gastos del mes.
- **Modo claro verificado con capturas**, no solo por tokens.
- **`scroll-driven animations`** para encoger la cabecera al bajar, hoy es un salto.
- **Edición en línea del reparto por gasto** en la vista de mes sin ir al catálogo.

---

## Correcciones posteriores (detectadas al usar la app)

### 15. El historial no mostraba ninguna evolución

La tarjeta «Evolución del % de gastos compartidos» aparecía con **una sola barra**. No era un
fallo del gráfico: los datos de ejemplo guardaban **un único mes**, así que no había serie que
mostrar. La app pres presumía de historial y de comparación entre meses, pero el ejemplo no daba
material para verlo.

**Corregido:** el estado de ejemplo precarga **seis meses** con variación creíble (la luz y el gas
suben en invierno, un seguro anual en septiembre, una reparación imprevista en julio), los meses
pasados cerrados con sus pagos y su ahorro real registrado, y el mes en curso a medio pagar para
que el panel de acciones y la liquidación tengan algo que decir. Ahora el historial muestra
45,1 % → 45,9 % → 50,5 % → 45,6 % → 53,7 % → 48,8 %, con promedio y extremos.

Cubierto por `src/domain/defaults.test.ts`: seis meses consecutivos, cada mes cuadrando al
céntimo, variación real entre meses, meses pasados cerrados, puntuales solo en su mes.

### 16. El gráfico recortaba la etiqueta del valor

`.bars` tenía un alto fijo (`height + 40`) menor que la suma de sus partes (valor + barra +
etiqueta de mes), y como también lleva `overflow-x: auto`, el eje vertical se calcula como `auto`
y **recortaba** la cifra de arriba. Con un solo mes, además, la barra se estiraba de lado a lado
como una losa.

**Corregido:** el contenedor ya no tiene alto fijo (crece con su contenido) y las columnas están
limitadas a 150 px con un mínimo de 34 px, así que un mes suelto es una barra y no un muro.

### 17. Los desplegables se cerraban solos

Reportado al usar la app: los desplegables se cerraban «sin hacer clic en una opción ni fuera».

Causa: el `Popover` cerraba con **cualquier** evento `scroll` (`window.addEventListener('scroll',
onClose, true)`, en fase de captura, que también recoge el scroll de cualquier elemento). Y el
propio `Select` generaba uno: para dejar visible la opción activa llamaba a `scrollIntoView`, que
desplaza el ancestro desplazable más cercano. Resultado: pasar el ratón por una opción o pulsar una
flecha movía el scroll, disparaba el listener y cerraba el panel.

**Corregido** con tres cambios independientes:

1. Al hacer scroll el panel **se recoloca**, no se cierra (una sola recolocación por frame con
   `requestAnimationFrame`). Solo se cierra si el disparador sale por completo de la pantalla.
2. El scroll **dentro de la propia lista** se ignora: no mueve el ancla.
3. La opción activa se deja visible desplazando `list.scrollTop`, nunca la página, y los `focus()`
   usan `{ preventScroll: true }`.

Además, `onClose` ahora es estable (`useCallback`) para que el efecto no se recree en cada render,
y los guardas usan `instanceof Node` antes de `contains()` (con un evento de `window`, `contains`
lanza en jsdom y devuelve `false` en el navegador: mejor no depender de esa diferencia).

**Por qué no lo detectaron las pruebas:** jsdom no implementa scroll ni `scrollIntoView`, así que la
prueba de interfaz pasaba mientras el navegador fallaba. Se añadieron tres pruebas de regresión
(scroll de página, scroll de la lista, teclado y redimensionado) y se verificó en **Chromium real**
por CDP: abrir, hacer scroll, pasar el ratón, pulsar flechas, desplazar la lista y elegir una opción.

Lección: las pruebas de interfaz en jsdom validan el árbol y el estado, no el comportamiento de
layout. Lo que dependa de scroll, posición o medición hay que comprobarlo en un navegador de verdad.

---

## Auditoría con chrome-devtools MCP

Tercera pasada, esta vez con datos en lugar de impresiones: el MCP de chrome-devtools
(`scripts/cdp-audit.mjs`) navega, mide la página a 390 px y 1440 px, revisa consola, red y
Lighthouse. Los cuatro hallazgos que encontró y lo que se hizo con ellos.

### 18. En móvil, la tabla apilada pegaba la etiqueta al valor

La imagen de referencia mostraba `REPARTOProporcional` y `MONTO1,200.00`. La causa era de
**especificidad CSS**, introducida al pasar a BEM: en la media query móvil yo escribía
`.table td { display: block }` (0-1-1) mientras el flex vivía en `.table__cell` (0-1-0), así que
la etiqueta `::before` quedaba como texto en línea junto al valor.

**Corregido:** la media query ya no toca etiquetas, solo clases, y la celda pasa a ser una
**rejilla de dos columnas** (etiqueta a la izquierda, contenido apilado y alineado a la derecha con
`justify-self: end`). Medido antes y después: la separación entre etiqueta y valor pasó de 0 px a
192 px.

### 19. Contraste insuficiente en el texto tenue

Lighthouse marcaba `color-contrast` en `.pot__target`, y mi propio medidor encontró **10 casos** en
escritorio: encabezados de tabla, pistas de las tarjetas, el pie y el enlace de salto, todos entre
**3,86:1 y 4,30:1** (mínimo AA: 4,5:1). `--color-text-faint` era `#6b7498` y el pie ni siquiera
llegaba a 4,5.

**Corregido** con valores calculados, no a ojo: `--color-text-faint` pasa a `#848eb5` (5,13:1 sobre
superficie 2) en oscuro y `#656d8a` (5,11:1 sobre blanco) en claro. Además, el blanco sobre el
acento puro daba **3,86:1**, así que todo lo que lleva texto blanco (botón primario, control
segmentado, mes seleccionado, enlace de salto) usa ahora el acento fuerte (4,95:1).

Resultado: **0 contrastes insuficientes** en móvil y escritorio.

### 20. Ningún `h1` en la página

El nombre de la app era un `<strong>`. Ahora es el `h1` del documento, con las tarjetas como `h2` y
las personas y metas como `h3`: una jerarquía completa y sin saltos.

### 21. `progressbar` sin nombre accesible y nombre del selector de mes que no coincidía

Lighthouse marcaba las barras de progreso (`aria-progressbar-name`) y el disparador del selector de
mes (`label-content-name-mismatch`: el nombre accesible «Elegir mes» no contenía el texto visible
«Octubre de 2026»). Ahora `Progress` **exige** una etiqueta por tipo (no se puede olvidar) y el
selector usa `Elegir mes: {mes visible}`.

### 22. Tamaños de letra por debajo de 12 px

Había **45 elementos** a 11 o 11,5 px (etiquetas de tarjeta, insignias, encabezados de tabla,
pistas). Se subió el suelo a 12 px en todos ellos. Quedan seis a 11 px: las etiquetas de la barra de
navegación inferior, donde el ancho manda. Es una excepción deliberada y está anotada en la guía de
estilo.

### 23. Distribución: huecos y simetría

Con las capturas delante:

- El hero tenía un **hueco grande**: las tres cifras iban apiladas en una columna a la derecha y
  estiraban la tarjeta. Ahora van en una **banda de tres columnas** al pie del hero, y el contenido
  se reparte con `align-content: space-between`.
- Las tarjetas de una misma fila no compartían altura. Con `align-items: stretch` los bordes
  inferiores coinciden (hero y «Qué hacer ahora» terminan en la misma línea).
- Los tres avisos eran **tres cajas sueltas** que llenaban la pantalla de ruido; ahora son una sola
  tarjeta con filas y un filo de color por nivel.
- En móvil, la línea de detalle de un gasto se enrollaba en tres líneas; ahora se recorta con
  puntos suspensivos.

### Resultado de la auditoría

| | móvil | escritorio |
| --- | --- | --- |
| Lighthouse · Accesibilidad | **100** | **100** |
| Lighthouse · Buenas prácticas | **100** | **100** |
| Lighthouse · SEO | **100** | **100** |
| Contraste insuficiente | 0 | 0 |
| Objetivos táctiles < 24 px | 0 | 0 |
| Desborde horizontal | 0 px | 0 px |
| Mensajes de consola | ninguno | ninguno |
| Peticiones fallidas | ninguna | ninguna |
| Errores de tipo y lint | 0 | 0 |

### 24. El hero no repartía su contenido (conflicto de especificidad)

Al estirar las tarjetas de una fila para igualar alturas, añadí `.layout > .card { display: flex }`.
Esa regla (0-2-0) **gana** a `.hero` (0-1-0), así que el hero dejó de ser una rejilla y su
`align-content: space-between` no hacía nada: quedaba un hueco de ~90 px al pie. Medido y corregido:
el reparto se movió al `.card__body` del hero (que es quien envuelve el contenido) y el hueco bajó
de ~90 px a 9 px.

Moraleja: al añadir una regla con más especificidad sobre un bloque que ya tiene layout propio, hay
que excluirlo explícitamente (`:not(.hero)`).

### 25. Filas de formulario rotas en móvil

En Ajustes, la fila de persona usaba `minmax(0,1fr) auto`: la paleta de color caía en una columna
y se partía en tres filas de dos muestras, con el nombre, el sueldo y la ✕ descolocados alrededor.
Ahora en móvil cada campo ocupa su fila, la paleta va en una sola línea con desplazamiento
horizontal y la ✕ se alinea a la derecha. Lo mismo en la lista de metas, donde la insignia de
porcentaje se estiraba como si fuera una barra.

### 26. Insignia engañosa en el estado vacío

Con la app recién vaciada (sin sueldos ni gastos) el hero mostraba «Hay gastos con reparto
distinto: el % efectivo cambia». Era técnicamente cierto (`equitable` es falso sin datos) y
completamente inútil. Ahora dice «Sin datos todavía: falta el ingreso del mes».

### Verificación visual

Se capturaron y revisaron **26 pantallas**: las 6 secciones en escritorio y en móvil, tema claro,
y los estados que no se ven en una captura normal —modal de gasto abierto, desplegable desplegado,
app vacía en ambos tamaños—. En cada una se revisó jerarquía, alineación, huecos y simetría, no solo
que «no diera error». Los tres últimos hallazgos (24, 25 y 26) salieron de ahí, no de la auditoría
automática: las herramientas miden contraste, tamaños y desbordes, pero **la distribución hay que
mirarla**.

---

## Componentes que «funcionan una vez y luego no»

Reportado al usar la app. Se reprodujo con un banco de pruebas propio que pulsa con **eventos reales
de ratón** (`scripts/cdp-interact.mjs`), no con `elemento.click()`: el clic programático se salta el
comportamiento del navegador con `<label>`, la propagación y el foco, que es justo donde estaban los
fallos. Eran **dos bugs distintos** con el mismo síntoma.

### 27. Las View Transitions se comían las pulsaciones

Pulsar «Gastos» y enseguida «Metas» dejaba la app en «Gastos»: la segunda pulsación se perdía.

La causa: el cambio de sección vivía **dentro del callback** de `document.startViewTransition`. Si
se lanzaba una transición mientras otra estaba en curso, Chrome descartaba la nueva y su callback no
llegaba a ejecutarse, así que `setTab` no se llamaba nunca. Medido:

| pulsaciones rápidas (150 ms) | con View Transitions | sin ellas |
| --- | --- | --- |
| Gastos → Metas | se queda en Gastos | cambia a Metas |
| Mes → Ajustes | se queda en Mes | cambia a Ajustes |

**Corregido:** el estado se aplica siempre y de forma síncrona; la transición era decorativa y se
eliminó (la animación de entrada la hace el CSS, que no puede tragarse nada). De paso se añadió un
escucha de `hashchange`: ahora **atrás/adelante del navegador** también cambia de sección, cosa que
antes se ignoraba porque el hash solo se leía al montar.

### 28. El panel flotante quedaba invisible a partir de la segunda apertura

El desplegable aplicaba la primera elección y ninguna más; el selector de mes, igual.

La causa estaba en `Popover`: al abrir, ocultaba el panel con una **mutación directa del DOM**
(`panel.style.visibility = 'hidden'`) para medirlo, y después pedía a React el mismo valor
(`visibility: 'visible'`). React comparaba con su estado anterior —que ya decía `visible`— no veía
cambios y **no escribía nada**, así que el panel se quedaba invisible pero presente: los elementos
existían en el DOM y el clic pasaba de largo. En la primera apertura funcionaba porque el estado
inicial sí era `hidden`.

**Corregido:** colocación en **una sola pasada**, midiendo solo el ancla y limitando el alto con
`max-height` (con volteo hacia arriba según el espacio disponible). Sin fase de medición oculta y
sin tocar el DOM a mano. Verificado con pulsaciones sucesivas:
`Partes iguales → Montos fijos → Proporcional → Partes iguales`.

### Banco de pruebas de interacción

`scripts/cdp-interact.mjs` comprueba trece comportamientos con clics reales, cada uno **varias veces
seguidas**: pestañas, interruptores, desplegables, selector de mes, modal (abrir/cerrar/reabrir),
liberación del scroll, interruptor y paleta dentro de un `<label>`, Editar/Duplicar, y el botón de
aplicar de las metas (con y sin desmontaje del campo). Estado actual: **13/13**.

Dos detalles del arnés que costaron falsos positivos y quedaron documentados en el propio script:
hay que fijar el viewport (Chrome headless arranca estrecho y la media query móvil oculta cosas) y
hay que desplazar con `behavior: 'instant'`, porque con `scroll-behavior: smooth` medir a mitad de la
animación da coordenadas viejas y un panel flotante se recoloca al hacer scroll.

### 29. Los desplegables dentro del modal se dibujaban detrás

Al crear un gasto, el desplegable de «Categoría» abría pero **no mostraba ninguna opción**: el panel
tiene `z-index: 90` y el modal `100`, así que quedaba justo detrás del modal. El control parecía
muerto.

**Corregido:** se reordenaron las capas — modal 100, **panel flotante 110**, avisos 120 — porque un
desplegable puede vivir dentro de un modal y debe ir por encima. El `z-index` pasó de estar escrito a
mano en el estilo en línea a la clase `.popover`, con el token correspondiente.

Este caso no lo cubría ninguna prueba: el banco de interacción probaba desplegables en la página,
nunca **dentro de un modal**. Ahora hay dos escenarios (Categoría y Tipo) y, sobre todo, **cada clic
del banco comprueba con `document.elementFromPoint` que el elemento esté realmente encima**: si algo
lo tapa, la prueba falla diciendo qué lo tapa. Esa comprobación habría cazado el fallo sola.

### 30. Un importe escrito en una meta se perdía al cambiar de sección

«Al cambiar el contenido no aparece reflejado el cambio en las metas». El campo numérico confirma al
salir de él —con Tab, con Enter o pulsando fuera—, pero **no al desmontarse**. Cambiar de sección con
atrás/adelante del navegador, editar el hash o cerrar la pestaña desmontaba el campo y el texto
pendiente se descartaba en silencio: el número seguía en pantalla un instante y luego desaparecía sin
aviso.

Medido con teclas reales antes de tocar nada: Tab, Enter, clic fuera y cambio de pestaña sí
guardaban; el hash y la navegación completa, no.

**Corregido** en dos frentes:

- **Un botón de aplicar (✓) a la derecha de cada meta**, que aparece atenuado e inactivo mientras no
  haya cambios y se enciende en color de acento en cuanto se escribe algo distinto. Permite confirmar
  sin salir del campo, que es lo que se pedía. En móvil mide 40 px para que sea cómodo con el dedo;
  lleva `aria-label` con el nombre de la meta («Aplicar el cambio en Ahorro personal»).
- **Confirmación al desmontar**: el campo guarda lo pendiente en el `cleanup` de un efecto y también
  cuando la pestaña pasa a segundo plano (`visibilitychange`), que es el caso de cambiar de app en el
  móvil. El borrador se copia a un `ref` **dentro del manejador del evento**, nunca durante el
  render: escribir un `ref` en render incumple las reglas de React y con renderizado concurrente un
  render descartado dejaría datos que nunca se pintaron.

Los dos caminos quedaron cubiertos por pruebas: dos escenarios nuevos en el banco de interacción
(13/13) y dos pruebas de humo (`ui.smoke.test.tsx`, 103 en total). La del desmontaje **falla si se
quita el arreglo** —se comprobó desactivando el `flush` y viendo cómo la prueba se ponía en rojo—,
así que no es una prueba que pase por casualidad.

