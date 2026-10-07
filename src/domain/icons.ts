import type { Expense, ExpenseCategory } from './types'

export interface IconDef {
  slug: string
  label: string
  category: ExpenseCategory
  /** emoji de respaldo mientras el icono generado no está disponible */
  fallback: string
}

/**
 * Catálogo de iconos generados con fal.ai (gpt-image-2.5) y recortados por
 * scripts/slice-icons.mjs. Los PNG son monocromos y se usan como `mask-image`,
 * así heredan el color del tema y el de cada categoría.
 */
export const ICONS: IconDef[] = [
  { slug: 'house', label: 'Casa / arriendo', category: 'vivienda', fallback: '🏠' },
  { slug: 'building', label: 'Edificio / hipoteca', category: 'vivienda', fallback: '🏢' },
  { slug: 'key', label: 'Llave / contrato', category: 'vivienda', fallback: '🔑' },
  { slug: 'sofa', label: 'Muebles', category: 'vivienda', fallback: '🛋️' },
  { slug: 'bulb', label: 'Luz', category: 'servicios', fallback: '💡' },
  { slug: 'water', label: 'Agua', category: 'servicios', fallback: '💧' },
  { slug: 'flame', label: 'Gas / calefacción', category: 'servicios', fallback: '🔥' },
  { slug: 'wifi', label: 'Internet', category: 'servicios', fallback: '📶' },
  { slug: 'cleaning', label: 'Aseo', category: 'servicios', fallback: '🧴' },
  { slug: 'cart', label: 'Supermercado', category: 'alimentacion', fallback: '🛒' },
  { slug: 'coffee', label: 'Café / comer fuera', category: 'alimentacion', fallback: '☕' },
  { slug: 'pot', label: 'Cocina', category: 'alimentacion', fallback: '🍲' },
  { slug: 'bus', label: 'Transporte público', category: 'transporte', fallback: '🚌' },
  { slug: 'car', label: 'Auto', category: 'transporte', fallback: '🚗' },
  { slug: 'fuel', label: 'Combustible', category: 'transporte', fallback: '⛽' },
  { slug: 'tv', label: 'Streaming / TV', category: 'suscripciones', fallback: '📺' },
  { slug: 'music', label: 'Música', category: 'suscripciones', fallback: '🎧' },
  { slug: 'games', label: 'Videojuegos', category: 'suscripciones', fallback: '🎮' },
  { slug: 'card', label: 'Tarjeta', category: 'deudas', fallback: '💳' },
  { slug: 'bank', label: 'Banco / préstamo', category: 'deudas', fallback: '🏦' },
  { slug: 'piggy', label: 'Ahorro', category: 'otros', fallback: '🐖' },
  { slug: 'gift', label: 'Regalo', category: 'otros', fallback: '🎁' },
  { slug: 'pet', label: 'Mascota', category: 'otros', fallback: '🐾' },
  { slug: 'travel', label: 'Viajes', category: 'otros', fallback: '✈️' },
]

export const ICON_BY_SLUG = new Map(ICONS.map((icon) => [icon.slug, icon]))

export const DEFAULT_ICON_BY_CATEGORY: Record<ExpenseCategory, string> = {
  vivienda: 'house',
  servicios: 'bulb',
  alimentacion: 'cart',
  suscripciones: 'tv',
  transporte: 'bus',
  deudas: 'card',
  otros: 'gift',
}

/**
 * URL del PNG del icono. Se resuelve contra la página (no contra la hoja de
 * estilos): el valor viaja dentro de una variable CSS y los `url()` relativos de
 * una variable se resuelven contra el archivo CSS, que en el build vive en
 * /assets/, así que un "./icons/x.png" terminaría en /assets/icons/x.png (404).
 */
export function iconUrl(slug: string): string {
  const relative = `${import.meta.env.BASE_URL || './'}icons/${slug}.png`
  if (typeof document === 'undefined') return relative
  try {
    return new URL(relative, document.baseURI).href
  } catch {
    return relative
  }
}

/** Icono efectivo de un gasto: el elegido a mano o el de su categoría. */
export function iconSlugFor(expense: Pick<Expense, 'icon' | 'category'>): string {
  if (expense.icon && ICON_BY_SLUG.has(expense.icon)) return expense.icon
  return DEFAULT_ICON_BY_CATEGORY[expense.category] ?? 'gift'
}

export function iconFallback(slug: string, category?: ExpenseCategory): string {
  const icon = ICON_BY_SLUG.get(slug)
  if (icon) return icon.fallback
  if (category) return ICON_BY_SLUG.get(DEFAULT_ICON_BY_CATEGORY[category])?.fallback ?? '📦'
  return '📦'
}

export function iconsForCategory(category: ExpenseCategory): IconDef[] {
  return ICONS.filter((icon) => icon.category === category)
}
