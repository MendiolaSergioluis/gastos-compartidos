import type { ID, Settings } from './types'

export function round(value: number, decimals: number): number {
  const scale = 10 ** decimals
  return Math.round((value + Number.EPSILON) * scale) / scale
}

export function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0)
}

/**
 * Lee un valor de un registro indexado por id.
 *
 * Estas tablas se construyen siempre a partir de la lista de personas, así que
 * la clave existe por construcción; el tipo, con `noUncheckedIndexedAccess`, no
 * puede saberlo. En vez de silenciarlo con `!`, se comprueba y se falla fuerte:
 * un `undefined` silencioso se propagaba como `NaN` por todos los totales.
 */
export function at<T>(record: Record<ID, T>, id: ID): T {
  const value = record[id]
  if (value === undefined) throw new Error(`Falta la clave "${id}" en el registro`)
  return value
}

/**
 * Reparte `amount` entre varios pesos usando el método del resto mayor, de forma
 * que la suma de las partes sea exactamente `amount` con la precisión pedida.
 * Es la base del reparto equitativo: parts_i = amount * peso_i / suma(pesos),
 * que equivale a aporte_i = sueldo_i * (amount / ingreso_total).
 */
export function apportion(
  amount: number,
  weights: Record<ID, number>,
  decimals: number,
  order?: ID[],
): Record<ID, number> {
  const ids = order ?? Object.keys(weights)
  const scale = 10 ** decimals
  const target = Math.round(amount * scale)
  const clean = ids.map((id) => ({ id, weight: Math.max(0, weights[id] ?? 0) }))
  const totalWeight = sum(clean.map((c) => c.weight))

  if (target === 0) {
    const parts: Record<ID, number> = {}
    for (const id of ids) parts[id] = 0
    return parts
  }

  // Sin pesos utilizables: reparto en partes iguales.
  const effective = clean.map((c) => ({
    id: c.id,
    weight: totalWeight > 0 ? c.weight : 1,
  }))
  const effectiveTotal = totalWeight > 0 ? totalWeight : effective.length

  const shares = effective.map((c) => {
    const exact = (target * c.weight) / effectiveTotal
    const units = Math.floor(exact)
    return { id: c.id, units, fraction: exact - units }
  })

  let assigned = sum(shares.map((s) => s.units))
  const ranked = shares
    .map((share, index) => ({ share, index, weight: effective[index]?.weight ?? 0 }))
    .sort(
      (a, b) =>
        b.share.fraction - a.share.fraction ||
        b.weight - a.weight ||
        a.index - b.index,
    )
    .map((entry) => entry.share)
  let index = 0
  while (assigned < target && ranked.length > 0) {
    const next = ranked[index % ranked.length]
    if (next) next.units += 1
    assigned += 1
    index += 1
  }

  const parts: Record<ID, number> = {}
  for (const id of ids) parts[id] = 0
  for (const share of shares) parts[share.id] = share.units / scale
  return parts
}

export interface MoneyFormatOptions {
  /** fuerza una cantidad de decimales distinta a la configurada */
  decimals?: number
  /** muestra el signo + en valores positivos */
  signed?: boolean
}

function numberFormat(settings: Settings, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const locale = settings.locale.trim() === '' ? undefined : settings.locale
  try {
    return new Intl.NumberFormat(locale, options)
  } catch {
    return new Intl.NumberFormat(undefined, options)
  }
}

export function formatMoney(
  value: number,
  settings: Settings,
  options: MoneyFormatOptions = {},
): string {
  const decimals = options.decimals ?? settings.decimals
  const safe = Number.isFinite(value) ? value : 0
  const code = settings.currencyCode.trim().toUpperCase()
  let text: string

  if (code !== '') {
    try {
      text = numberFormat(settings, {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(safe)
    } catch {
      text = numberFormat(settings, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(safe)
    }
  } else {
    text =
      settings.currencySymbol.trim() +
      numberFormat(settings, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(safe)
  }

  if (options.signed && safe > 0) text = `+${text}`
  return text
}

/** value se expresa como fracción: 0.42 -> "42 %" */
export function formatPct(value: number, settings: Settings, decimals = 1): string {
  const safe = Number.isFinite(value) ? value : 0
  return numberFormat(settings, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe)
}

export function parseNumber(input: string, decimals: number): number {
  const cleaned = input
    .replace(/\s/g, '')
    .replace(/[^\d.,-]/g, '')
    .trim()
  if (cleaned === '') return 0

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  let normalized = cleaned

  if (lastComma > -1 && lastDot > -1) {
    // el último separador es el decimal
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '')
  } else if (lastComma > -1) {
    const isDecimal = decimals > 0 && cleaned.length - lastComma - 1 <= decimals
    normalized = isDecimal ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '')
  } else if (lastDot > -1) {
    const isDecimal = decimals > 0 && cleaned.length - lastDot - 1 <= decimals
    normalized = isDecimal ? cleaned : cleaned.replace(/\./g, '')
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}
