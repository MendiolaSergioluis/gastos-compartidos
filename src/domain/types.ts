export type ID = string

export interface Person {
  id: ID
  name: string
  /** color usado en gráficos */
  color: string
  /** sueldo base mensual: valor por defecto de cada mes */
  salary: number
}

/**
 * Meta de ahorro personalizable: un porcentaje del sueldo de cada persona.
 * Sirve para ahorro propio, vacaciones, aporte a los padres, caridad, etc.
 */
/** Una meta es de cada persona por separado o un fondo común del grupo. */
export type GoalScope = 'personal' | 'joint'

export const SCOPE_LABELS: Record<GoalScope, string> = {
  personal: 'Personal (cada uno la suya)',
  joint: 'Conjunta (un solo fondo)',
}

export interface Goal {
  id: ID
  name: string
  /** % del sueldo de cada persona que se reserva para esta meta */
  pct: number
  color: string
  /** slug del icono (ver domain/icons.ts) */
  icon?: string
  /** personal: se sigue por persona · joint: se suma en un fondo común */
  scope: GoalScope
}

export interface Settings {
  /** locale para formatear números ('' = el del navegador) */
  locale: string
  /** código ISO 4217 (ej. 'CLP'); si está vacío se usa el símbolo libre */
  currencyCode: string
  /** símbolo libre para moneda agnóstica (ej. '$', '€', '') */
  currencySymbol: string
  /** decimales a mostrar y a usar en el prorrateo */
  decimals: number
  /** metas de ahorro, cada una con su porcentaje del sueldo */
  goals: Goal[]
  /** alerta cuando los gastos compartidos superan este % del ingreso combinado */
  expenseWarnPct: number
  /** alerta cuando las suscripciones superan este % del ingreso combinado */
  subscriptionWarnPct: number
  /** días de antelación para avisar de un gasto recurrente por vencer */
  dueSoonDays: number
}

export const CATEGORIES = [
  'vivienda',
  'servicios',
  'alimentacion',
  'suscripciones',
  'transporte',
  'deudas',
  'otros',
] as const

export type ExpenseCategory = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  vivienda: 'Vivienda',
  servicios: 'Servicios',
  alimentacion: 'Alimentación',
  suscripciones: 'Suscripciones',
  transporte: 'Transporte',
  deudas: 'Deudas',
  otros: 'Otros',
}

export const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  vivienda: '🏠',
  servicios: '💡',
  alimentacion: '🛒',
  suscripciones: '📺',
  transporte: '🚌',
  deudas: '🏦',
  otros: '📦',
}

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  vivienda: '#6d5efc',
  servicios: '#12b3a8',
  alimentacion: '#f59f0b',
  suscripciones: '#f0577c',
  transporte: '#3b82f6',
  deudas: '#a855f7',
  otros: '#94a3b8',
}

export type SplitMode = 'proportional' | 'equal' | 'custom'

export const SPLIT_LABELS: Record<SplitMode, string> = {
  proportional: 'Proporcional',
  equal: 'Partes iguales',
  custom: 'Montos fijos',
}

export const SPLIT_HELP: Record<SplitMode, string> = {
  proportional: 'Cada uno aporta el mismo % de su sueldo (reparto equitativo).',
  equal: 'El gasto se divide en partes iguales, sin mirar el sueldo.',
  custom: 'Tú defines cuánto pone cada uno. El total del gasto es la suma.',
}

export type ExpenseKind = 'recurring' | 'oneoff'

export const KIND_LABELS: Record<ExpenseKind, string> = {
  recurring: 'Recurrente',
  oneoff: 'Puntual',
}

export interface Expense {
  id: ID
  name: string
  category: ExpenseCategory
  kind: ExpenseKind
  /** monto de referencia; en modo "montos fijos" es la suma de los montos por persona */
  amount: number
  splitMode: SplitMode
  /** slug del icono generado (ver domain/icons.ts); vacío = el de su categoría */
  icon?: string
  /** solo para splitMode 'custom': monto fijo por persona */
  customShares?: Record<ID, number>
  /** día del mes en que vence (solo recurrentes) */
  dueDay?: number
  /** marcado como suscripción de entretenimiento/servicio */
  subscription?: boolean
  notes?: string
  archived?: boolean
  /** 'YYYY-MM'; solo para gastos puntuales */
  month?: string
}

/** Valores de un gasto dentro de un mes concreto */
export interface MonthEntry {
  amount: number
  /** false = este mes no se paga (se omite del cálculo) */
  active: boolean
  /** la factura ya se pagó desde el fondo común */
  paid: boolean
}

/**
 * Aporte de una persona al fondo común del mes. No genera deudas entre las
 * personas: el fondo es de todos y desde ahí se pagan los gastos compartidos.
 */
export interface ContributionEntry {
  /** monto que esta persona puso en el fondo este mes */
  amount: number
  /** ya lo transfirió */
  done: boolean
}

export interface MonthData {
  /** 'YYYY-MM' */
  id: string
  salaries: Record<ID, number>
  entries: Record<ID, MonthEntry>
  /** aporte real de cada persona al fondo común */
  contributions: Record<ID, ContributionEntry>
  /** ahorro real registrado: por persona y por meta */
  savings: Record<ID, Record<ID, number>>
  note?: string
}

export interface AppState {
  version: number
  /** true mientras la app muestra los datos de ejemplo */
  demo?: boolean
  /** versión del generador de datos de ejemplo, para refrescarlos al cambiarlos */
  demoSeed?: number
  people: Person[]
  expenses: Expense[]
  months: Record<string, MonthData>
  settings: Settings
}
