# Guía de estilo

Cómo está escrito el CSS de Gastos Compartidos: sin frameworks, con nomenclatura **BEM** y
tokens. Es la referencia para añadir o cambiar interfaz sin romper la coherencia.

---

## 1. Principios

1. **Nada de controles nativos visibles.** Ni `<select>`, ni `<input type="month">`, ni
   `<input type="color">`, ni `confirm()`. Todos los controles son propios para que se vean igual
   en cualquier navegador y sistema.
2. **El acento es para interactuar.** El violeta (`--color-accent`) marca lo que se puede pulsar o
   lo que está activo. Los datos usan colores propios (personas, categorías, metas).
3. **Un solo lugar para cada decisión.** Los valores repetidos viven en tokens; ningún componente
   escribe un color, un radio o un espacio a mano.
4. **Accesible por defecto.** Foco visible, contraste suficiente, objetivos táctiles de 44 px,
   `aria-*` en todo control compuesto y respeto por `prefers-reduced-motion`.

## 2. Nomenclatura BEM

```
.bloque                    componente independiente        .card
.bloque__elemento          parte del bloque                .card__head
.bloque--modificador       variante o estado               .card--hover
.bloque__elemento--estado  estado de una parte             .nav__item--active
```

Reglas:

- **Un bloque por concepto.** `card`, `stat`, `btn`, `field`, `table`, `monthrow`…
- **Los elementos no se anidan.** `.card__head` es correcto; `.card__head__title` no: sería
  `.card__title`.
- **Los modificadores no se combinan entre bloques.** `.btn--sm` modifica `btn`, no a otro bloque.
- **Los estados van como modificador**, no como clase suelta: `--active`, `--selected`, `--open`,
  `--dirty`, `--omitted`, `--on`.
- **Utilidades con prefijo `u-`** para lo que no pertenece a ningún bloque: `u-muted`, `u-small`,
  `u-row`, `u-sr-only`. Nunca llevan elementos ni modificadores.
- **Nada de selectores por etiqueta ni por descendencia** en el CSS propio (salvo el reset). Si
  hace falta un estilo, se le da una clase.

Ejemplo real:

```html
<section class="card card--hover person">
  <header class="card__head">
    <h2 class="card__title">Ana</h2>
    <div class="card__actions">…</div>
  </header>
  <div class="card__body">…</div>
</section>
```

## 3. Tokens

Todos los tokens viven en `:root` y se redefinen en `:root[data-theme='light']`.

### Color

| Token | Uso |
| --- | --- |
| `--color-bg` | fondo de la app |
| `--color-surface-1/2/3` | tarjeta / hueco dentro de tarjeta / control |
| `--color-border`, `--color-border-strong` | bordes suaves y marcados |
| `--color-text`, `--color-text-muted`, `--color-text-faint` | jerarquía de texto |
| `--color-accent`, `--color-accent-strong`, `--color-accent-soft` | interacción |
| `--color-good`, `--color-warn`, `--color-bad` (+ `-soft`) | estados |

Nunca se escribe un color literal en un componente. Las excepciones son los colores **de datos**
(personas, categorías, metas), que se definen en `src/domain/defaults.ts` y
`src/domain/types.ts` y llegan al CSS por variable en línea (`--person-color`, `--row-color`,
`--chip-color`).

### Espacio

Escala de 4 px. Es la parte que evita el problema de «todo pegado»:

| Token | Valor | Para qué |
| --- | --- | --- |
| `--space-1` | 4 px | dentro de una unidad acoplada (pastilla, control segmentado, etiqueta+valor) |
| `--space-2` | 8 px | **mínimo entre controles pulsables adyacentes** |
| `--space-3` | 12 px | separación entre grupos de controles, filas de lista |
| `--space-4` | 16 px | relleno interno de controles y celdas |
| `--space-5` | 24 px | relleno de tarjetas, separación entre bloques |
| `--space-6` | 32 px | separación entre secciones |
| `--space-7` | 48 px | respiro de página |

Regla práctica: **si dos elementos se pueden pulsar y están a menos de 8 px, el espaciado está
mal.**

### Forma, elevación y movimiento

- Radios: `--radius-sm` 10, `--radius-md` 14, `--radius-lg` 20, `--radius-xl` 26, `--radius-pill`.
  La jerarquía es: pastillas para lo seleccionable, `lg` para filas y controles agrupados,
  `xl` para tarjetas y la cabecera, `md` para botones y campos.
- Sombras: `--shadow-1` reposo, `--shadow-2` hover, `--shadow-3` flotantes (popover, modal).
- Movimiento: `--dur-fast` 130 ms (color, borde), `--dur-base` 220 ms (posición, tamaño),
  `--dur-slow` 420 ms (entradas). Curvas: `--ease` para todo, `--spring` para lo que rebota.
- Capas: `--z-topbar` 30, `--z-bottomnav` 40, `--z-popover` 90, `--z-modal` 100, `--z-toast` 110.

## 4. Inventario de bloques

| Bloque | Qué es |
| --- | --- |
| `app` | contenedor, contenido, pie y enlace de salto |
| `topbar` | cabecera flotante pegajosa (mismo radio que las tarjetas) |
| `brand` | marca: icono, nombre y mes + punto de guardado |
| `monthnav` | pastilla con mes anterior, selector y siguiente |
| `monthpicker` | selector de mes propio (rejilla de 12) |
| `nav` / `nav--tabs` / `nav--bottom` | navegación de escritorio y barra inferior móvil |
| `popover` | panel flotante en portal, base de los desplegables |
| `select` | desplegable propio con teclado |
| `colorpicker` | paleta de colores |
| `iconpicker` | rejilla de iconos con buscador por categoría |
| `icon`, `iconchip` | icono por máscara y su recuadro tintado |
| `card`, `sectiontitle` | tarjeta y título de sección |
| `layout`, `col--N`, `grid--N`, `stack` | retícula de 12 columnas, rejillas y pilas |
| `hero`, `ring` | bloque principal con el anillo del % |
| `stat`, `badge`, `btn`, `iconbtn` | indicadores y acciones |
| `field`, `input`, `numberfield`, `segmented`, `toggle`, `form` | formularios |
| `modal`, `toast`, `warnings`, `advice`, `empty`, `demobanner` | capas y mensajes |
| `person`, `legend`, `pot`, `contribution`, `personrow` | personas, fondo común y grupo |
| `category`, `expense`, `monthrow` | gastos del catálogo y del mes |
| `goalist`, `goalcard`, `goalgrid` | metas |
| `table`, `summary`, `formula` | datos tabulados y fórmulas |
| `donut`, `splitbar`, `bars`, `progress` | gráficos |

## 5. Estados obligatorios

Todo elemento interactivo define, como mínimo:

```css
.mi-bloque__item:hover { … }          /* solo con @media (hover: hover) si mueve cosas */
.mi-bloque__item:active { transform: scale(0.97); }
.mi-bloque__item:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.mi-bloque__item:disabled { opacity: 0.42; cursor: not-allowed; }
```

Y si representa una selección, `--active` / `--selected` con el acento.

## 6. Micro-interacciones

Están permitidas y son parte del lenguaje, con tres condiciones: **cortas** (≤ 420 ms),
**con `prefers-reduced-motion` respetado** y **sin mover el contenido** (nada que empuje el layout).

Recursos propios: `@property --ring-value` para animar el anillo, `mask-image` para teñir iconos,

`conic-gradient` para el porcentaje, onda con `::after` en `.btn`, entrada escalonada con
`:nth-child` y View Transitions al cambiar de pestaña.

## 7. Accesibilidad

- Objetivo táctil mínimo: 44 px de alto en móvil (`.btn`, `.nav__item`, `.iconbtn`, `.toggle`).
- Todo control sin texto visible lleva `aria-label`.
- Los controles compuestos usan el rol correcto: `role="switch"` en `toggle`, `role="listbox"` /
  `option` en `select`, `role="radiogroup"` en `colorpicker`, `role="progressbar"` en `progress`.
- Los avisos viven en una región `aria-live="polite"`.
- Navegación con teclado: flechas, Inicio/Fin, letra inicial, Enter y Escape en `select`;
  flechas y PageUp/PageDown en `monthpicker`; Escape cierra popovers y modales.
- `<caption class="u-sr-only">` en cada tabla de datos.

## 8. Cómo añadir un bloque

1. ¿Existe ya un bloque que hace esto? Si sí, añade un elemento o un modificador.
2. Define el bloque en `src/styles.css` en la sección que le corresponde, con un comentario de
   sección y en orden alfabético dentro de ella.
3. Usa tokens para color, espacio, radio y duración. Cero valores literales.
4. Añade los estados de la sección 5.
5. Comprueba a 390 px y a 1440 px, y con `prefers-reduced-motion`.

### Trampa conocida: `url()` dentro de una variable CSS

Un `url()` relativo guardado en una variable CSS (`--icon-url: url("./icons/x.png")`) se resuelve
contra **la hoja de estilos**, no contra la página. En desarrollo el CSS va en línea y funciona; en
el build vive en `/assets/`, así que el icono termina buscándose en `/assets/icons/x.png` y da 404
(el icono desaparece y el `background-color` pinta un cuadrado sólido).

Por eso `iconUrl()` devuelve **siempre una URL absoluta** resuelta contra `document.baseURI`.
Hay una prueba que lo fija: `pinta los iconos con una URL absoluta, no relativa al CSS`.

## 9. Verificación visual y auditoría

La interfaz se comprueba con dos herramientas propias, además de las pruebas automáticas.

### Capturas

```bash
node scripts/shot.mjs <url> <salida.png> [ancho] [alto] [--theme=light] \
  [--scrollTo=<selector>] [--do=<expresión>] [--eval=<expresión>] [--full]
```

Usa CDP con `Emulation.setDeviceMetricsOverride`, así que el viewport es el pedido de verdad:
`--window-size` de Chrome en macOS no baja de ~500 px y devuelve una imagen recortada que engaña
(así se colaron dos falsos positivos de «desborde» al principio).

- `--do` interactúa antes de capturar (abrir un modal, desplegar un select…).
- `--eval` mide en la página y devuelve JSON: estilos computados, separaciones reales, etc.

### Auditoría

```bash
node scripts/cdp-audit.mjs [url] [informe.json]     # consola, red, Lighthouse y medición
node scripts/cdp-routes.mjs [base] [informe.json]   # las 6 rutas × móvil/escritorio
```

Ambas usan el **MCP de chrome-devtools** (`scripts/cdp-mcp.mjs`), que aporta Lighthouse
(accesibilidad, SEO, buenas prácticas) y la consola del navegador. Sobre el perfil: el MCP escribe
el suyo en `~/.cache`, que el sandbox bloquea, así que se lanza con `--userDataDir` dentro del
proyecto y **se borra antes de cada auditoría**; si no, el service worker sirve el build anterior y
se audita algo que ya no existe.

`cdp-routes.mjs` comprueba en cada ruta y tamaño: desborde horizontal, contraste de texto,
tamaños de letra, objetivos táctiles, controles sin etiqueta, jerarquía de encabezados e ids
duplicados. Estado actual: **12/12 sin hallazgos**.

### Excepciones deliberadas

- Las etiquetas de la barra de navegación inferior se quedan en **11 px**: con seis destinos en
  390 px, subir a 12 obliga a recortar los nombres.
- Los ejes de los gráficos usan 12 px y las cifras `tabular-nums`, aunque el mínimo general sea 12.

## 10. TypeScript

El proyecto es TypeScript de punta a punta (54 archivos `.ts`/`.tsx`, ningún `.js` en `src`) y **sin
un solo `any`**: no hay `any`, `as any`, `@ts-ignore` ni `@ts-expect-error` en el código ni en los
scripts.

### Configuración

Dos proyectos, porque el código de aplicación y las pruebas no necesitan el mismo rasero:

| | `tsconfig.app.json` (aplicación) | `tsconfig.test.json` (pruebas) |
| --- | --- | --- |
| `strict` | ✓ | ✓ |
| `noUncheckedIndexedAccess` | ✓ | — |
| `noImplicitReturns`, `noImplicitOverride` | ✓ | ✓ |
| `allowUnreachableCode: false` | ✓ | ✓ |
| `noUnusedLocals`, `noUnusedParameters` | ✓ | ✓ |
| `verbatimModuleSyntax`, `erasableSyntaxOnly` | ✓ | ✓ |

`noUncheckedIndexedAccess` se midió: 122 errores, 70 en pruebas. En la aplicación se arreglaron
todos y encontró sitios reales donde un `undefined` se propagaba como `NaN`. En las pruebas, en
cambio, cada acceso indexa un fixture con una clave literal conocida, así que exigir la comprobación
añadía ruido sin atrapar nada: se quedan con `strict` completo.

`exactOptionalPropertyTypes` también se probó y se descartó (10 errores): su aporte es para APIs de
librería que distinguen `undefined` de «ausente», y en props de React solo genera fricción
(`preview={x | undefined}` contra `preview?: T`).

### Cómo se evita el `!` y el `any` en accesos indexados

Las tablas por id (`Record<ID, number>`) se construyen siempre desde la lista de personas, así que la
clave existe por construcción, pero el tipo no puede saberlo. En lugar de silenciarlo con `!` o un
`any`, existe un helper que **falla fuerte**:

```ts
export function at<T>(record: Record<ID, T>, id: ID): T {
  const value = record[id]
  if (value === undefined) throw new Error(`Falta la clave "${id}" en el registro`)
  return value
}
```

Un `undefined` silencioso se propagaba como `NaN` por todos los totales sin avisar.
