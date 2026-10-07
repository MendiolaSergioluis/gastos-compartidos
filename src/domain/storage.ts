import {
  DEFAULT_GOALS,
  DEFAULT_SETTINGS,
  DEMO_SEED,
  GOAL_PERSONAL_ID,
  GOAL_VACATION_ID,
  STATE_VERSION,
  createDemoState,
  goalTemplate,
  newId,
  personTemplate,
} from './defaults'
import {
  CATEGORIES,
  type AppState,
  type Expense,
  type ExpenseCategory,
  type Goal,
  type MonthData,
  type Person,
  type Settings,
  type SplitMode,
} from './types'

export const STORAGE_KEY = 'gastos-compartidos.state.v1'
/** clave de la versión anterior de la app: se migra al vuelo, sin perder datos */
export const LEGACY_STORAGE_KEY = 'gastos-pareja.state.v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

/** Las metas anteriores a `scope` se deducen por su id conocido. */
function coerceScope(raw: unknown, id: string): Goal['scope'] {
  if (raw === 'personal' || raw === 'joint') return raw
  if (id === GOAL_PERSONAL_ID) return 'personal'
  return 'joint'
}

function coerceGoals(raw: unknown, legacy: Record<string, unknown>): Goal[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter(isRecord).map((item, index) => {
      const id = str(item.id) || newId('g')
      return {
        id,
        name: str(item.name) || `Meta ${index + 1}`,
        pct: Math.max(0, num(item.pct, 0)),
        color: str(item.color) || goalTemplate(index).color,
        scope: coerceScope(item.scope, id),
        ...(str(item.icon) ? { icon: str(item.icon) } : {}),
      }
    })
  }

  // migración desde la versión de dos porcentajes fijos
  const [personal, vacation] = DEFAULT_GOALS
  if (!personal || !vacation) return DEFAULT_GOALS.map((goal) => ({ ...goal }))
  return [
    { ...personal, pct: num(legacy.personalSavingsPct, personal.pct) },
    { ...vacation, pct: num(legacy.vacationSavingsPct, vacation.pct) },
  ]
}

function coerceSettings(raw: unknown): Settings {
  const source = isRecord(raw) ? raw : {}
  return {
    locale: str(source.locale, DEFAULT_SETTINGS.locale),
    currencyCode: str(source.currencyCode, DEFAULT_SETTINGS.currencyCode),
    currencySymbol: str(source.currencySymbol, DEFAULT_SETTINGS.currencySymbol),
    decimals: Math.min(4, Math.max(0, Math.round(num(source.decimals, DEFAULT_SETTINGS.decimals)))),
    goals: coerceGoals(source.goals, source),
    expenseWarnPct: num(source.expenseWarnPct, DEFAULT_SETTINGS.expenseWarnPct),
    subscriptionWarnPct: num(source.subscriptionWarnPct, DEFAULT_SETTINGS.subscriptionWarnPct),
    dueSoonDays: num(source.dueSoonDays, DEFAULT_SETTINGS.dueSoonDays),
  }
}

function coercePeople(raw: unknown): Person[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isRecord).map((item, index) => {
    const base = personTemplate(index)
    return {
      id: str(item.id) || base.id,
      name: str(item.name) || base.name,
      color: str(item.color) || base.color,
      salary: num(item.salary, 0),
    }
  })
}

function coerceExpense(raw: unknown, personIds: string[]): Expense | null {
  if (!isRecord(raw)) return null
  const category = CATEGORIES.includes(raw.category as ExpenseCategory)
    ? (raw.category as ExpenseCategory)
    : 'otros'
  const splitMode: SplitMode =
    raw.splitMode === 'equal' || raw.splitMode === 'custom' ? raw.splitMode : 'proportional'
  const shares: Record<string, number> = {}
  if (isRecord(raw.customShares)) {
    for (const id of personIds) shares[id] = num(raw.customShares[id], 0)
  }
  return {
    id: str(raw.id) || newId('e'),
    name: str(raw.name) || 'Gasto',
    category,
    kind: raw.kind === 'oneoff' ? 'oneoff' : 'recurring',
    amount: num(raw.amount, 0),
    splitMode,
    ...(str(raw.icon) ? { icon: str(raw.icon) } : {}),
    ...(splitMode === 'custom' ? { customShares: shares } : {}),
    ...(raw.dueDay === undefined || raw.dueDay === null
      ? {}
      : { dueDay: Math.min(31, Math.max(1, Math.round(num(raw.dueDay, 1)))) }),
    subscription: bool(raw.subscription),
    ...(str(raw.notes) ? { notes: str(raw.notes) } : {}),
    archived: bool(raw.archived),
    ...(str(raw.month) ? { month: str(raw.month) } : {}),
  }
}

/** Ahorro por persona: acepta el formato nuevo (por meta) y el antiguo. */
function coerceSavings(raw: unknown, goalIds: string[]): Record<string, Record<string, number>> {
  const savings: Record<string, Record<string, number>> = {}
  if (!isRecord(raw)) return savings

  for (const [personId, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue
    const byGoal: Record<string, number> = {}
    const looksLegacy = 'personal' in value || 'vacation' in value
    if (looksLegacy) {
      byGoal[GOAL_PERSONAL_ID] = num(value.personal, 0)
      byGoal[GOAL_VACATION_ID] = num(value.vacation, 0)
    } else {
      for (const goalId of goalIds) {
        if (goalId in value) byGoal[goalId] = num(value[goalId], 0)
      }
    }
    savings[personId] = byGoal
  }
  return savings
}

function coerceMonth(raw: unknown, id: string, goalIds: string[]): MonthData | null {
  if (!isRecord(raw)) return null

  const salaries: Record<string, number> = {}
  if (isRecord(raw.salaries)) {
    for (const [key, value] of Object.entries(raw.salaries)) salaries[key] = num(value, 0)
  }

  const entries: MonthData['entries'] = {}
  if (isRecord(raw.entries)) {
    for (const [key, value] of Object.entries(raw.entries)) {
      if (!isRecord(value)) continue
      entries[key] = {
        amount: num(value.amount, 0),
        active: value.active === undefined ? true : bool(value.active, true),
        paid: bool(value.paid),
      }
    }
  }

  const contributions: MonthData['contributions'] = {}
  if (isRecord(raw.contributions)) {
    for (const [key, value] of Object.entries(raw.contributions)) {
      if (!isRecord(value)) continue
      contributions[key] = { amount: num(value.amount, 0), done: bool(value.done) }
    }
  }

  return {
    id,
    salaries,
    entries,
    contributions,
    savings: coerceSavings(raw.savings, goalIds),
    ...(str(raw.note) ? { note: str(raw.note) } : {}),
  }
}

/** Convierte cualquier JSON en un AppState válido, rellenando lo que falte. */
export function normalizeState(raw: unknown): AppState {
  const source = isRecord(raw) ? raw : {}
  const people = coercePeople(source.people)
  const safePeople = people.length >= 1 ? people : [personTemplate(0), personTemplate(1)]
  const personIds = safePeople.map((person) => person.id)
  const settings = coerceSettings(source.settings)
  const goalIds = settings.goals.map((goal) => goal.id)

  const expenses: Expense[] = Array.isArray(source.expenses)
    ? source.expenses
        .map((item) => coerceExpense(item, personIds))
        .filter((item): item is Expense => item !== null)
    : []

  const months: Record<string, MonthData> = {}
  if (isRecord(source.months)) {
    for (const [id, value] of Object.entries(source.months)) {
      if (!/^\d{4}-\d{2}$/.test(id)) continue
      const month = coerceMonth(value, id, goalIds)
      if (month) months[id] = month
    }
  }

  return {
    version: STATE_VERSION,
    demo: bool(source.demo),
    demoSeed: num(source.demoSeed, 0),
    people: safePeople,
    expenses,
    months,
    settings,
  }
}

/**
 * Carga el estado guardado. Los datos de ejemplo no son datos del usuario: si
 * vienen de una versión anterior del ejemplo, se regeneran para que la app
 * muestre el historial completo en lugar de quedarse con un ejemplo obsoleto.
 */
export function loadState(): AppState | null {
  if (typeof localStorage === 'undefined') return null
  try {
    let raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      // migración desde la versión anterior: se conserva lo que había
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
      if (!legacy) return null
      const migrated = normalizeState(JSON.parse(legacy))
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      const fresh = migrated.demo && migrated.demoSeed !== DEMO_SEED ? createDemoState() : migrated
      saveState(fresh)
      return fresh
    }

    const state = normalizeState(JSON.parse(raw))
    if (state.demo && state.demoSeed !== DEMO_SEED) {
      const fresh = createDemoState()
      saveState(fresh)
      return fresh
    }
    return state
  } catch {
    return null
  }
}

export function saveState(state: AppState): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* almacenamiento lleno o bloqueado: la app sigue funcionando en memoria */
  }
}

export function exportState(state: AppState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)
}

export function downloadState(state: AppState, filename = 'gastos-compartidos.json'): void {
  const blob = new Blob([exportState(state)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function clearStorage(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
