import { currentMonthId, shiftMonth } from './finance'
import { round } from './money'
import type {
  AppState,
  Expense,
  Goal,
  ID,
  MonthData,
  MonthEntry,
  Person,
  Settings,
} from './types'

export const STATE_VERSION = 2

/** Súbela al cambiar los datos de ejemplo: así se refrescan solos al abrir la app. */
export const DEMO_SEED = 3

export const GOAL_PERSONAL_ID = 'goal-personal'
export const GOAL_VACATION_ID = 'goal-vacation'

export const DEFAULT_GOALS: Goal[] = [
  {
    id: GOAL_PERSONAL_ID,
    name: 'Ahorro personal',
    pct: 10,
    color: '#34d399',
    icon: 'piggy',
    scope: 'personal',
  },
  {
    id: GOAL_VACATION_ID,
    name: 'Vacaciones conjuntas',
    pct: 10,
    color: '#fbbf24',
    icon: 'travel',
    scope: 'joint',
  },
]

export const DEFAULT_SETTINGS: Settings = {
  locale: '',
  currencyCode: '',
  currencySymbol: '',
  decimals: 2,
  goals: DEFAULT_GOALS.map((goal) => ({ ...goal })),
  expenseWarnPct: 50,
  subscriptionWarnPct: 5,
  dueSoonDays: 5,
}

/** Colores de persona, deliberadamente lejos del violeta de interacción. */
export const PERSON_COLORS = ['#2dd4bf', '#f472b6', '#fbbf24', '#60a5fa', '#a78bfa', '#4ade80']

/** Paleta para metas nuevas. */
export const GOAL_COLORS = ['#34d399', '#fbbf24', '#f472b6', '#60a5fa', '#a78bfa', '#fb7185', '#2dd4bf', '#f97316']

let counter = 0

export function newId(prefix = 'id'): string {
  counter += 1
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${random}`
}

export function personTemplate(index: number): Person {
  return {
    id: newId('p'),
    name: `Persona ${index + 1}`,
    color: PERSON_COLORS[index % PERSON_COLORS.length] ?? '#2dd4bf',
    salary: 0,
  }
}

export function goalTemplate(index: number): Goal {
  return {
    id: newId('g'),
    name: '',
    pct: 5,
    color: GOAL_COLORS[index % GOAL_COLORS.length] ?? '#34d399',
    scope: 'joint',
  }
}

interface SeedExpense {
  name: string
  category: Expense['category']
  amount: number
  dueDay?: number
  subscription?: boolean
  splitMode?: Expense['splitMode']
  icon?: string
}

const SEED_EXPENSES: SeedExpense[] = [
  { name: 'Arriendo', category: 'vivienda', amount: 1200, dueDay: 5, icon: 'house' },
  {
    name: 'Servicios básicos (luz, agua, gas)',
    category: 'servicios',
    amount: 220,
    dueDay: 15,
    icon: 'bulb',
  },
  { name: 'Supermercado', category: 'alimentacion', amount: 650, dueDay: 20, icon: 'cart' },
  { name: 'Internet', category: 'servicios', amount: 45, dueDay: 10, subscription: true, icon: 'wifi' },
  { name: 'Netflix', category: 'suscripciones', amount: 15, dueDay: 8, subscription: true, icon: 'tv' },
  { name: 'Spotify', category: 'suscripciones', amount: 11, dueDay: 8, subscription: true, icon: 'music' },
  { name: 'Transporte', category: 'transporte', amount: 180, dueDay: 1, icon: 'bus' },
]

interface DemoMonth {
  /** meses hacia atrás respecto al mes en curso */
  offset: number
  /** la luz y el gas suben en invierno */
  utilities: number
  groceries: number
  /** true = el mes quedó cerrado, con las facturas pagadas y los aportes hechos */
  closed: boolean
  extras?: { name: string; category: Expense['category']; amount: number; icon: string }[]
}

/**
 * Historial de ejemplo: seis meses con variación creíble para que la evolución,
 * la comparación entre meses y el seguimiento de metas tengan contenido real.
 */
const DEMO_MONTHS: DemoMonth[] = [
  { offset: -5, utilities: 195, groceries: 610, closed: true },
  { offset: -4, utilities: 205, groceries: 640, closed: true },
  {
    offset: -3,
    utilities: 240,
    groceries: 655,
    closed: true,
    extras: [{ name: 'Reparación de la lavadora', category: 'otros', amount: 180, icon: 'cleaning' }],
  },
  { offset: -2, utilities: 210, groceries: 620, closed: true },
  {
    offset: -1,
    utilities: 225,
    groceries: 660,
    closed: true,
    extras: [{ name: 'Seguro del auto', category: 'transporte', amount: 350, icon: 'car' }],
  },
  {
    offset: 0,
    utilities: 220,
    groceries: 650,
    closed: false,
    extras: [{ name: 'Regalo de cumpleaños', category: 'otros', amount: 120, icon: 'gift' }],
  },
]

/** Ahorro real registrado en el ejemplo, por meta y persona. */
const DEMO_SAVINGS: Record<string, { personal: number; vacation: number }> = {
  '-5': { personal: 280, vacation: 260 },
  '-4': { personal: 300, vacation: 300 },
  '-3': { personal: 300, vacation: 300 },
  '-2': { personal: 250, vacation: 240 },
  '-1': { personal: 320, vacation: 310 },
  0: { personal: 280, vacation: 250 },
}

/** Estado de ejemplo: 2 personas, sueldos 3000 / 2000 y seis meses de historial. */
export function createDemoState(today: Date = new Date()): AppState {
  const first: Person = { id: newId('p'), name: 'Ana', color: PERSON_COLORS[0] ?? '#2dd4bf', salary: 3000 }
  const second: Person = { id: newId('p'), name: 'Luis', color: PERSON_COLORS[1] ?? '#f472b6', salary: 2000 }

  const recurring: Expense[] = SEED_EXPENSES.map((seed) => ({
    id: newId('e'),
    name: seed.name,
    category: seed.category,
    kind: 'recurring',
    amount: seed.amount,
    splitMode: seed.splitMode ?? 'proportional',
    subscription: seed.subscription ?? false,
    ...(seed.dueDay === undefined ? {} : { dueDay: seed.dueDay }),
    ...(seed.icon === undefined ? {} : { icon: seed.icon }),
  }))

  const utilitiesId = recurring.find(
    (expense) => expense.category === 'servicios' && !expense.subscription,
  )?.id
  const groceriesId = recurring.find((expense) => expense.category === 'alimentacion')?.id

  const expenses: Expense[] = [...recurring]
  const months: Record<string, MonthData> = {}

  DEMO_MONTHS.forEach((demo) => {
    const monthId = shiftMonth(currentMonthId(today), demo.offset)
    const entries: Record<ID, MonthEntry> = {}
    let total = 0

    recurring.forEach((expense, index) => {
      const amount =
        expense.id === utilitiesId
          ? demo.utilities
          : expense.id === groceriesId
            ? demo.groceries
            : expense.amount
      total += amount
      // en el mes en curso solo las dos primeras facturas están pagadas, para que
      // se vea el estado pendiente y el panel de acciones tenga qué proponer
      const paid = demo.closed || index < 2
      entries[expense.id] = { amount, active: true, paid }
    })

    for (const extra of demo.extras ?? []) {
      const expense: Expense = {
        id: newId('e'),
        name: extra.name,
        category: extra.category,
        kind: 'oneoff',
        amount: extra.amount,
        splitMode: 'proportional',
        month: monthId,
        icon: extra.icon,
      }
      expenses.push(expense)
      entries[expense.id] = { amount: extra.amount, active: true, paid: true }
      total += extra.amount
    }

    const savings = DEMO_SAVINGS[String(demo.offset)] ?? { personal: 0, vacation: 0 }
    // todos los gastos del ejemplo son proporcionales y los sueldos son 60/40
    const firstShare = round((total * first.salary) / (first.salary + second.salary), 2)
    const secondShare = round(total - firstShare, 2)

    months[monthId] = {
      id: monthId,
      salaries: { [first.id]: first.salary, [second.id]: second.salary },
      entries,
      contributions: {
        [first.id]: { amount: firstShare, done: demo.closed },
        [second.id]: { amount: secondShare, done: demo.closed },
      },
      savings: {
        [first.id]: { [GOAL_PERSONAL_ID]: savings.personal, [GOAL_VACATION_ID]: savings.vacation },
        [second.id]: {
          [GOAL_PERSONAL_ID]: round(savings.personal * 0.68, 0),
          [GOAL_VACATION_ID]: round(savings.vacation * 0.68, 0),
        },
      },
    }
  })

  return {
    version: STATE_VERSION,
    demo: true,
    demoSeed: DEMO_SEED,
    people: [first, second],
    expenses,
    months,
    settings: { ...DEFAULT_SETTINGS, goals: DEFAULT_GOALS.map((goal) => ({ ...goal })) },
  }
}

/** Estado vacío, listo para que el grupo cargue sus propios datos. */
export function createEmptyState(): AppState {
  return {
    version: STATE_VERSION,
    demo: false,
    demoSeed: DEMO_SEED,
    people: [personTemplate(0), personTemplate(1)],
    expenses: [],
    months: {},
    settings: { ...DEFAULT_SETTINGS, goals: DEFAULT_GOALS.map((goal) => ({ ...goal })) },
  }
}
