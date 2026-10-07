# Gastos Compartidos

Aplicación web (PWA, funciona offline) para repartir los gastos comunes **en proporción al sueldo
de cada persona**, en lugar de dividir todo a partes iguales. Sirve para **parejas, familias y
compañeros de piso**.

## La idea

Si los sueldos son distintos, pagar 50/50 no es justo: al que gana menos le pesa más.
La app calcula el porcentaje del ingreso combinado que se va en gastos comunes y lo aplica a cada
sueldo, de modo que **todos aportan exactamente el mismo % de su propio sueldo**:

```
% = Gastos compartidos ÷ (sueldo₁ + sueldo₂ + …)
aporteᵢ = sueldoᵢ × %
```

### Ejemplo

| | Sueldo | Aporte (48,82 %) | Le queda |
| --- | --- | --- | --- |
| Ana | 3.000 | **1.464,60** | 1.535,40 |
| Luis | 2.000 | **976,40** | 1.023,60 |
| **Total** | **5.000** | **2.441** | 2.559 |

Con 2.441 de gastos compartidos el porcentaje es 2.441 ÷ 5.000 = **48,82 %**.
Ana aporta más dinero (1.464,60 frente a 976,40), pero **ambos aportan el 48,82 % de su sueldo**:
el esfuerzo relativo es idéntico. Eso es la equidad proporcional, y funciona igual con tres o
cuatro personas.

## Fondo común, sin deudas entre personas

Cada persona transfiere su porción a una **cuenta común** y desde ahí se pagan las facturas del mes.

No hay «quién pagó qué» ni cálculos de quién le debe a quién: eso obliga a resolver transferencias
con montos desiguales y convierte una app de presupuesto en un registro de deudas. La app muestra
el estado del fondo (transferido, pendiente, pagado, disponible) y avisa si se pagó más de lo que
había o si el fondo no alcanza para lo que queda por pagar.

## Metas personalizables

Cada meta aparta un **porcentaje del sueldo de cada persona**. Vienen dos por defecto (ahorro
personal y vacaciones, 10 % cada una) y puedes añadir las que necesites: aporte a los padres,
iglesia, caridad, estudios… Cada una con su nombre, porcentaje, color e icono, y con seguimiento
mensual y acumulado.

Como las metas consumen un % del ingreso, si junto con los gastos compartidos se pasa del 100 % la
app lo dice en lugar de dejar el presupuesto en rojo silencioso.

## Funciones

- **Resumen**: anillo animado con el % del mes, la fórmula a la vista, un panel de **qué hacer
  ahora** con los siguientes pasos ordenados por urgencia, el estado del fondo común, reparto por
  categoría y el detalle de cuánto aporta cada persona en cada gasto.
- **Mes**: edita el sueldo del mes, los montos, qué facturas ya salieron del fondo, el aporte de
  cada persona y sus metas. Agrega gastos puntuales solo para ese mes.
- **Gastos**: catálogo de gastos recurrentes (arriendo, servicios, alimentación, transporte,
  suscripciones…), con categoría, icono, día de vencimiento y modo de reparto.
- **Metas**: una fila por meta con su barra de avance y tres cifras — **meta** (lo convenido al mes
  por doce), **acumulado** (la suma real mes a mes) y **proyectado** (lo acumulado más lo que queda
  por guardar hasta diciembre). Cada meta es **personal** (una fila por persona) o **conjunta**
  (un solo fondo), y se elige en Ajustes.
- **Historial**: evolución del % de gastos compartidos, comparación con el mes anterior y tabla de
  todos los meses.
- **Ajustes**: grupo y sueldos, metas, formato de moneda, umbrales de alerta, iconografía y
  exportar/importar JSON.

Cada sección tiene enlace propio (`#gastos`, `#historial`…) para poder compartirla.

### Modos de reparto por gasto

| Modo | Qué hace |
| --- | --- |
| Proporcional | Reparto equitativo (por defecto). Mismo % para todos. |
| Partes iguales | Divide en partes iguales, sin mirar el sueldo. |
| Montos fijos | Tú defines cuánto pone cada uno; el total es la suma. |

Si algún gasto no es proporcional, la app avisa de que el % efectivo deja de ser igual para todos.

### Alertas

Metas que no caben en el presupuesto · gastos compartidos por encima del umbral configurado ·
fondo común en rojo o insuficiente · suscripciones que pesan demasiado (con su costo anual) ·
gastos vencidos o por vencer · suscripciones que llevan meses sin registrarse como pagadas ·
versión nueva de la app disponible.

## Interfaz

CSS propio con nomenclatura **BEM**, sin frameworks y sin controles nativos: los desplegables, el
selector de mes, la paleta de colores, los interruptores y los avisos son componentes propios, para
que se vean igual en cualquier navegador.

- **Navegación inferior en móvil** (al alcance del pulgar) y barra superior flotante en escritorio,
  ambas con los mismos radios que las tarjetas.
- **Deshacer en lugar de preguntar**: eliminar, archivar, restablecer el mes o borrar todo se puede
  revertir desde el aviso.
- **Los campos numéricos confirman al salir** del campo o con Enter, no en cada tecla.
- Accesibilidad: foco visible, enlace «saltar al contenido», `aria-live` en los avisos, objetivos
  táctiles de 44 px y respeto por `prefers-reduced-motion`.

- Guía de estilo y nomenclatura: [`docs/style-guide.md`](docs/style-guide.md)
- Análisis UX/UI y plan de A/B testing: [`docs/ux-ab-testing.md`](docs/ux-ab-testing.md)
- Verificación visual y auditoría: [`docs/style-guide.md`](docs/style-guide.md) §9
- Análisis adversarial de la primera versión: [`docs/ui-critique.md`](docs/ui-critique.md)

## Iconos

24 iconos monocromos generados con **gpt-image-2.5** (`openai/gpt-image-2.5/flare/text-to-image`)
a través del MCP de fal.ai, y recortados por `scripts/slice-icons.mjs`. Al ser monocromos se usan
como `mask-image`: adoptan el color del tema, de la categoría o de la meta desde un único PNG.

El prompt completo, los parámetros y el proceso de recorte están en
[`docs/icon-prompts.md`](docs/icon-prompts.md).

## Precisión del cálculo

El reparto usa el **método del resto mayor**: cada parte se calcula como
`monto × pesoᵢ ÷ Σpesos` y el residuo del redondeo se asigna a quien tenga la fracción mayor.
Así la suma de los aportes coincide **exactamente**, al céntimo, con el total de los gastos
(verificado en las pruebas, incluidos casos como 100 ÷ 7).

## Privacidad

Todo se guarda en el `localStorage` del navegador. Nada sale del dispositivo: no hay servidor,
cuentas ni analítica. En **Ajustes** puedes exportar e importar un JSON para respaldar los datos o
moverlos a otro dispositivo.

## Cómo usarla

```bash
npm install
npm run dev        # desarrollo en http://localhost:5173
npm run build      # tipos + build de producción en dist/
npm run preview    # sirve el build (http://localhost:4173)
npm test           # 82 pruebas: motor, metas, fondo común, migración, reducer y UI
npm run typecheck  # solo verificación de tipos
npm run lint       # oxlint
```

La primera vez se cargan **datos de ejemplo** (Ana 3.000, Luis 2.000) con seis meses de historial
para ver el reparto en funcionamiento. Puedes editarlos en Ajustes o pulsar «Empezar de cero»
(con deshacer).

### Instalar como app

Con el build servido por HTTPS (o en `localhost`), el navegador ofrece **Instalar**: la app queda
en el móvil o el escritorio, se abre en modo standalone y funciona sin conexión gracias al
service worker.

## Moneda

La app es **agnóstica a la moneda**: por defecto solo muestra números. Puedes definir un símbolo
(`$`, `€`, `S/`), un código ISO (`CLP`, `EUR`, `MXN`) y los decimales, o elegir el idioma/locale
del formato. Los importes se escriben y se leen aceptando tanto `1.234,56` como `1,234.56`.

## Estructura

```
src/
  domain/          lógica pura, sin React
    types.ts       modelo de datos (personas, metas, gastos, meses, ajustes)
    money.ts       redondeo, reparto por resto mayor, formato y parseo
    finance.ts     motor: %, aportes, metas, fondo común, alertas, historial
    advice.ts      qué hacer ahora: convierte el estado del mes en próximos pasos
    icons.ts       catálogo de iconos por categoría
    storage.ts     persistencia, migración entre versiones, export/import
    defaults.ts    ajustes por defecto y datos de ejemplo (seis meses)
  state/           store con useReducer, avisos con deshacer y hooks de UI
  components/      primitivas BEM, controles propios, gráficos e iconos
  pages/           Resumen, Mes, Gastos, Metas, Historial, Ajustes
  styles.css       sistema visual completo (CSS puro, BEM)
scripts/
  make-icons.mjs       iconos PNG de la PWA, sin dependencias
  icon-sheets.mjs      prompt y listas de iconos (fuente única de verdad)
  fal-submit-icons.mjs encola las hojas en fal.ai vía MCP
  fal-fetch-icons.mjs  sondea y descarga los resultados
  slice-icons.mjs      recorta, normaliza y verifica los 24 iconos
  shot.mjs             capturas por CDP con emulación real de móvil
  cdp-mcp.mjs          cliente del MCP de chrome-devtools
  cdp-audit.mjs        auditoría: consola, red, Lighthouse y medición de la página
  cdp-routes.mjs       las 6 rutas × móvil/escritorio sin hallazgos
  lib/fal-mcp.mjs      cliente MCP mínimo (HTTP + SSE) para fal.ai
  lib/stdio-mcp.mjs    cliente MCP mínimo sobre stdio
docs/
  style-guide.md       tokens, BEM y reglas de interfaz
  ux-ab-testing.md     análisis UX/UI y plan de experimentos
  ui-critique.md       análisis adversarial de la primera versión
  icon-prompts.md      prompt, generación y recorte de iconos
```

El motor de cálculo (`src/domain/`) no depende de React y está cubierto por pruebas unitarias: si
cambias la fórmula, las pruebas te dicen si rompes la equivalencia entre aportes y gastos.
