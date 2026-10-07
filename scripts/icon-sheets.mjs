/**
 * Fuente única de verdad para las hojas de iconos que se generan con fal.ai.
 *
 * El diseño es deliberadamente monocromo (negro puro sobre fondo transparente)
 * para poder usarlo como `mask-image` en CSS: así el icono hereda el color del
 * tema y el color de cada categoría sin volver a generar imágenes.
 *
 *   node scripts/fal-submit-icons.mjs        # envía las hojas a la cola de fal.ai
 */

export const GRID = { columns: 3, rows: 4, cell: 512 }

export const MODEL = 'openai/gpt-image-2.5/flare/text-to-image'

export const GENERATION_INPUT = {
  quality: 'high',
  output_format: 'png',
  background: 'transparent',
  num_images: 1,
  image_size: { width: GRID.columns * GRID.cell, height: GRID.rows * GRID.cell },
}

/** Plantilla del prompt: se rellena con la lista de iconos de cada hoja. */
export function buildPrompt(sheet) {
  const list = sheet.icons
    .map((icon, index) => `${index + 1}. ${icon.prompt}`)
    .join('\n')

  return `Flat monochrome icon sheet for a personal-finance app. A strict grid of ${GRID.columns} columns by ${GRID.rows} rows containing exactly ${sheet.icons.length} isolated pictograms, evenly spaced and in reading order (left to right, then top to bottom).

Every icon sits inside its own invisible square cell of exactly the same size, optically centered both horizontally and vertically, with a generous even gutter between neighbours. Nothing touches a cell edge, nothing overlaps, and no icon is bigger or heavier than another.

STYLE: flat solid pure black (#000000) pictograms. Bold, simplified, geometric shapes that are readable at 24 pixels. No outline, no stroke, no shading, no gradient, no highlight, no drop shadow, no 3D, no perspective, no texture, no photorealism, no grain, no glow. Interior details are cut out as clean negative space. All ${sheet.icons.length} icons must read as one coherent family with identical optical weight and identical visual size.

BACKGROUND: fully transparent. Absolutely no background color, no panel, no rounded rectangle behind the icons, no grid lines, no cell borders, no dividers, no frame.

Absolutely no text, no letters, no numbers, no captions, no labels, no logos, no watermarks, no extra decoration.

The ${sheet.icons.length} icons, in reading order:
${list}`
}

export const SHEETS = [
  {
    id: 'hogar',
    title: 'Hogar, servicios y alimentación',
    file: 'sheet-hogar.png',
    icons: [
      { slug: 'house', label: 'Casa / arriendo', category: 'vivienda', prompt: 'a simple house with a pitched roof, a door and one window — rent and home' },
      { slug: 'building', label: 'Edificio / hipoteca', category: 'vivienda', prompt: 'an apartment building with a flat roof and a grid of windows — mortgage and condominium' },
      { slug: 'key', label: 'Llave / contrato', category: 'vivienda', prompt: 'a single old-fashioned key with a round bow and two teeth — contract and deposit' },
      { slug: 'sofa', label: 'Muebles / hogar', category: 'vivienda', prompt: 'a two-seat sofa seen from the front with two cushions and four short legs — furniture and furnishing' },
      { slug: 'bulb', label: 'Luz / electricidad', category: 'servicios', prompt: 'a classic incandescent light bulb with a screw base and two short rays — electricity' },
      { slug: 'water', label: 'Agua', category: 'servicios', prompt: 'a single large water drop with a small round highlight cut out of its upper left — water utility' },
      { slug: 'flame', label: 'Gas / calefacción', category: 'servicios', prompt: 'a stylized gas flame with a small inner flame cut out as negative space — gas and heating' },
      { slug: 'wifi', label: 'Internet / wifi', category: 'servicios', prompt: 'a wifi router box with two antennas and three curved signal arcs above it — internet and phone plan' },
      { slug: 'cart', label: 'Supermercado', category: 'alimentacion', prompt: 'a shopping cart seen from the side with two wheels and a handle — groceries' },
      { slug: 'coffee', label: 'Café / comida fuera', category: 'alimentacion', prompt: 'a takeaway coffee cup with a lid, a sleeve and a small steam curl — eating out and coffee' },
      { slug: 'pot', label: 'Cocina', category: 'alimentacion', prompt: 'a cooking pot with a lid, two side handles and a small knob on the lid — cooking at home' },
      { slug: 'cleaning', label: 'Aseo / limpieza', category: 'servicios', prompt: 'a spray bottle with a trigger nozzle and three small droplets in front of it — cleaning supplies' },
    ],
  },
  {
    id: 'vida',
    title: 'Transporte, entretenimiento, finanzas y otros',
    file: 'sheet-vida.png',
    icons: [
      { slug: 'bus', label: 'Transporte público', category: 'transporte', prompt: 'a city bus seen from the front with a large windshield, two headlights and two wheels — public transport' },
      { slug: 'car', label: 'Auto', category: 'transporte', prompt: 'a small compact car seen from the side with two wheels, a windshield and a door line — car' },
      { slug: 'fuel', label: 'Combustible', category: 'transporte', prompt: 'a fuel pump with a hose and a nozzle, plus a small fuel drop — petrol and tolls' },
      { slug: 'tv', label: 'Streaming / TV', category: 'suscripciones', prompt: 'a television screen on a small stand with a play triangle cut out of the centre — streaming subscriptions' },
      { slug: 'music', label: 'Música', category: 'suscripciones', prompt: 'a pair of over-ear headphones with a headband and two ear cups — music subscriptions' },
      { slug: 'games', label: 'Videojuegos', category: 'suscripciones', prompt: 'a game controller with a d-pad on the left and two round buttons on the right — video games' },
      { slug: 'card', label: 'Tarjeta', category: 'deudas', prompt: 'a credit card seen from the front with a magnetic stripe and a chip — card payment' },
      { slug: 'bank', label: 'Banco / préstamo', category: 'deudas', prompt: 'a bank building with a triangular pediment and three vertical columns — loan and bank fees' },
      { slug: 'piggy', label: 'Ahorro', category: 'otros', prompt: 'a piggy bank seen from the side with a coin slot on its back and four short legs — savings' },
      { slug: 'gift', label: 'Regalo', category: 'otros', prompt: 'a gift box with a ribbon crossing it and a bow on top — presents' },
      { slug: 'pet', label: 'Mascota', category: 'otros', prompt: 'a single animal paw print with one large pad and four toe pads — pet expenses' },
      { slug: 'travel', label: 'Viajes / vacaciones', category: 'otros', prompt: 'a passenger airplane seen from above flying diagonally — travel and holidays' },
    ],
  },
]

export const ALL_ICONS = SHEETS.flatMap((sheet) =>
  sheet.icons.map((icon) => ({ ...icon, sheet: sheet.id })),
)

if (process.argv[1]?.endsWith('icon-sheets.mjs')) {
  for (const sheet of SHEETS) {
    console.log(`\n===== ${sheet.id} · ${sheet.title} (${sheet.icons.length} iconos) =====\n`)
    console.log(buildPrompt(sheet))
  }
}
