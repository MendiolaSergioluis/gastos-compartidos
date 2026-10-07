# Iconos: prompt, generación en fal.ai y recorte

## Modelo y parámetros

| | |
| --- | --- |
| Endpoint | `openai/gpt-image-2.5/flare/text-to-image` |
| Quality | `high` |
| Formato | `png` |
| Fondo | `transparent` |
| Tamaño | `1536 × 2048` (grilla 3 × 4, celdas de 512 px) |
| Imágenes | 2 hojas = 24 iconos |
| Costo | ~1 USD por imagen |

Se pidieron **dos hojas de 12 iconos** en lugar de una de 24 porque los modelos de imagen respetan
mucho mejor una grilla de 3 × 4 que una de 6 × 4, y así cada hoja se podía revisar y repetir por
separado.

## El prompt

El prompt no se escribe a mano cada vez: vive en `scripts/icon-sheets.mjs`, que es la fuente única
de verdad (plantilla + lista de iconos + parámetros). Se puede imprimir con:

```bash
node scripts/icon-sheets.mjs
```

Plantilla (rellenada con la lista de cada hoja):

```text
Flat monochrome icon sheet for a personal-finance app. A strict grid of 3 columns by 4 rows
containing exactly 12 isolated pictograms, evenly spaced and in reading order (left to right,
then top to bottom).

Every icon sits inside its own invisible square cell of exactly the same size, optically centered
both horizontally and vertically, with a generous even gutter between neighbours. Nothing touches
a cell edge, nothing overlaps, and no icon is bigger or heavier than another.

STYLE: flat solid pure black (#000000) pictograms. Bold, simplified, geometric shapes that are
readable at 24 pixels. No outline, no stroke, no shading, no gradient, no highlight, no drop
shadow, no 3D, no perspective, no texture, no photorealism, no grain, no glow. Interior details
are cut out as clean negative space. All 12 icons must read as one coherent family with identical
optical weight and identical visual size.

BACKGROUND: fully transparent. Absolutely no background color, no panel, no rounded rectangle
behind the icons, no grid lines, no cell borders, no dividers, no frame.

Absolutely no text, no letters, no numbers, no captions, no labels, no logos, no watermarks,
no extra decoration.

The 12 icons, in reading order:
1. …
```

### Decisiones del prompt que importan

- **Monocromo en negro puro sobre transparente.** No es una limitación estética: es lo que permite
  usar cada PNG como `mask-image` y teñirlo con el color del tema o de la categoría, sin generar
  más imágenes ni duplicar archivos.
- **«Familia coherente, mismo peso óptico, mismo tamaño visual».** Sin esta frase la hoja sale con
  iconos de grosores y escalas dispares.
- **«Nada toca el borde de su celda».** Evita que el recorte corte puntas.
- **«Sin texto, sin números, sin etiquetas».** Los modelos tienden a añadir rótulos bajo cada
  icono; aquí estorban porque las etiquetas las pone la interfaz.
- **«El detalle interior se recorta como espacio negativo».** Da iconos sólidos reconocibles a
  24 px, en lugar de contornos finos que desaparecen.

### Las dos hojas

**Hoja 1 · hogar, servicios y alimentación** (`sheet-hogar.png`)

| # | slug | icono | categoría |
| --- | --- | --- | --- |
| 1 | `house` | casa con tejado a dos aguas | vivienda |
| 2 | `building` | edificio con rejilla de ventanas | vivienda |
| 3 | `key` | llave antigua | vivienda |
| 4 | `sofa` | sofá de dos plazas | vivienda |
| 5 | `bulb` | bombilla con dos destellos | servicios |
| 6 | `water` | gota de agua | servicios |
| 7 | `flame` | llama de gas | servicios |
| 8 | `wifi` | router con tres arcos de señal | servicios |
| 9 | `cart` | carrito de supermercado | alimentación |
| 10 | `coffee` | vaso de café para llevar | alimentación |
| 11 | `pot` | olla con tapa | alimentación |
| 12 | `cleaning` | pulverizador de limpieza | servicios |

**Hoja 2 · transporte, entretenimiento, finanzas y otros** (`sheet-vida.png`)

| # | slug | icono | categoría |
| --- | --- | --- | --- |
| 1 | `bus` | autobús urbano de frente | transporte |
| 2 | `car` | auto compacto de perfil | transporte |
| 3 | `fuel` | surtidor de bencina | transporte |
| 4 | `tv` | pantalla con triángulo de reproducción | suscripciones |
| 5 | `music` | audífonos de diadema | suscripciones |
| 6 | `games` | mando de videojuegos | suscripciones |
| 7 | `card` | tarjeta con banda y chip | deudas |
| 8 | `bank` | banco con frontón y columnas | deudas |
| 9 | `piggy` | alcancía con ranura | otros |
| 10 | `gift` | caja de regalo con lazo | otros |
| 11 | `pet` | huella de mascota | otros |
| 12 | `travel` | avión en diagonal | otros |

## Cómo se generaron

Por el MCP de fal.ai (`https://mcp.fal.ai/mcp`, autenticado con la key del Keychain de macOS),
con un cliente MCP propio en `scripts/lib/fal-mcp.mjs` porque el servidor no estaba expuesto como
herramienta en la sesión.

```bash
node scripts/fal-submit-icons.mjs   # encola las dos hojas
node scripts/fal-fetch-icons.mjs    # sondea y descarga cuando terminan
node scripts/slice-icons.mjs        # recorta los 24 iconos
```

Las hojas quedan en `assets/generated/` (no se versionan si no se quiere) y los iconos finales en
`public/icons/`.

## Cómo se recortan

`scripts/slice-icons.mjs` no se limita a cortar por cuadrícula, porque el modelo no coloca los
iconos con precisión de píxel:

1. **Detecta el modo de fondo.** Si el PNG trae transparencia real (fue el caso: 79 % de píxeles
   transparentes) usa el canal alfa; si viniera opaco, usa el color de la esquina como clave y la
   oscuridad como tinta.
2. **Etiqueta las manchas de tinta** de toda la hoja por 8-conectividad. Cada icono se reconstruye
   con **todas** sus piezas (los 5 trozos de la huella, los 3 del auto, las columnas del banco) y
   se descarta cualquier resto que pertenezca al icono vecino: solo se conservan las manchas cuyo
   centro de masa cae dentro de la celda.
3. **Normaliza el tamaño óptico**, no el alto: escala cada icono para que la media geométrica de su
   rectángulo de tinta sea constante, con un límite duro del 92 % del lienzo. Así un auto ancho y
   una TV alta se ven del mismo peso, y ninguno se sale.
4. **Reduce promediando áreas** (sin alias) a 256 × 256, con el icono centrado y un margen del 10 %.
5. **Avisa** si una celda quedó vacía o si la tinta llega al borde de su celda (posible corte del
   modelo).

Además escribe `assets/generated/contact-sheet.png` (una hoja de contacto para revisar los 24 de un
vistazo) y `src/domain/icon-assets.ts` con los slugs realmente generados, para que la interfaz caiga
al emoji de respaldo si algún PNG falta.

## Uso en la interfaz

```tsx
<ExpenseIcon slug="tv" size={20} color="var(--accent)" />
```

```css
.icon {
  background-color: var(--icon-color, currentColor);
  mask-image: var(--icon-url);
  mask-size: contain;
}
```

Cada gasto guarda su `icon` (o usa el de su categoría), y el formulario de gasto incluye un
selector con los 24.

## ¿Y un SVG de verdad?

El modelo devuelve ráster: `gpt-image-2.5` no emite SVG. Para la interfaz da igual, porque
`mask-image` escala sin pérdida aparente y permite teñir; si en algún momento hace falta vector
real, habría que pasarlos por un vectorizador (potrace) y revisar los trazados a mano.
