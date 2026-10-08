import { apportion, at, formatMoney, round, sum } from './money'
import type {
  AppState,
  Expense,
  ExpenseCategory,
  Goal,
  ID,
  MonthData,
  MonthEntry,
  Person,
  Settings,
} from './types'
import { CATEGORIES } from './types'

/* ------------------------------------------------------------------ *
 * Fechas y meses
 * ------------------------------------------------------------------ */

export function monthIdOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function currentMonthId(today: Date = new Date()): string {
  return monthIdOf(today)
}

export function parseMonthId(monthId: string): { year: number; month: number } {
  const [rawYear, rawMonth] = monthId.split('-').map((part) => Number.parseInt(part, 10))
  return {
    year: Number.isFinite(rawYear) ? (rawYear as number) : new Date().getFullYear(),
    month: Number.isFinite(rawMonth) ? (rawMonth as number) : 1,
  }
}

export function shiftMonth(monthId: string, delta: number): string {
  const { year, month } = parseMonthId(monthId)
  return monthIdOf(new Date(year, month - 1 + delta, 1))
}

export function monthLabel(monthId: string, settings: Settings): string {
  const { year, month } = parseMonthId(monthId)
  const locale = settings.locale.trim() === '' ? undefined : settings.locale
  try {
    const text = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
      new Date(year, month - 1, 1),
    )
    // en español los meses van en minúscula; en la interfaz se capitaliza solo la primera
    return text.charAt(0).toUpperCase() + text.slice(1)
  } catch {
    return monthId
  }
}

/** Etiqueta corta para ejes de gráficos: "oct", "sep"… */
export function monthShortLabel(monthId: string, settings: Settings): string {
  const { year, month } = parseMonthId(monthId)
  const locale = settings.locale.trim() === '' ? undefined : settings.locale
  try {
    return new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(year, month - 1, 1)).replace('.', '')
  } catch {
    return monthId.slice(5)
  }
}

/* ------------------------------------------------------------------ *
 * Tipos de resultado
 * ------------------------------------------------------------------ */

export interface ExpenseAllocation {
  expense: Expense
  entry: MonthEntry
  /** monto efectivo del gasto en el mes (0 si está omitido) */
  amount: number
  parts: Record<ID, number>
  /** peso del gasto sobre el ingreso combinado */
  shareOfIncome: number
}

export interface GoalProgress {
  goal: Goal
  /** lo que corresponde apartar: sueldo × % de la meta */
  target: number
  /**
   * Valor para los cálculos de previsión: lo registrado, y mientras no haya
   * nada registrado la meta, porque «libre tras aporte y metas» supone que sí
   * se aparta. No sirve para editar: para eso está `deposited`.
   */
  actual: number
  /** lo apartado de verdad este mes; 0 mientras no se registre nada */
  deposited: number
  recorded: boolean
}

export interface PersonBreakdown {
  person: Person
  salary: number
  proportional: number
  equal: number
  custom: number
  /** aporte total que le corresponde al fondo común */
  total: number
  /** % de su propio sueldo que aporta */
  effectivePct: number
  /** % del ingreso combinado que representa su aporte */
  shareOfIncome: number
  /** aporte al fondo común: esperado, real y si ya se transfirió */
  contribution: { expected: number; actual: number; done: boolean }
  goals: GoalProgress[]
  goalsTarget: number
  goalsActual: number
  /** sueldo − aporte − metas de ahorro */
  available: number
  distribution: {
    aporte: number
    goals: { id: ID; name: string; color: string; amount: number }[]
    libre: number
  }
}

export interface CategoryTotal {
  category: ExpenseCategory
  amount: number
  pct: number
  count: number
}

export interface Warning {
  id: string
  level: 'info' | 'warn' | 'danger'
  title: string
  detail: string
}

export interface GoalTotal {
  goal: Goal
  target: number
  actual: number
  /** lo apartado de verdad entre todas las personas; 0 si no hay registro */
  deposited: number
  recorded: boolean
}

export interface MonthResult {
  monthId: string
  people: PersonBreakdown[]
  totalIncome: number
  totalShared: number
  /** gastos compartidos / ingreso combinado */
  pct: number
  /** suma de los aportes (debe coincidir con totalShared) */
  totalContributions: number
  /** true si todos aportan el mismo % de su sueldo */
  equitable: boolean
  byCategory: CategoryTotal[]
  allocations: ExpenseAllocation[]
  warnings: Warning[]
  savings: {
    byGoal: GoalTotal[]
    totalGoal: number
    totalActual: number
    /** suma real de lo apartado; 0 mientras no se registre nada */
    totalDeposited: number
  }
  /** estado del fondo común del mes */
  pot: {
    /** lo que debería tener el fondo (suma de aportes esperados) */
    target: number
    /** ya transferido y confirmado */
    contributed: number
    /** aportes aún sin transferir */
    pending: number
    /** facturas ya pagadas desde el fondo */
    spent: number
    /** facturas pendientes de pago */
    pendingBills: number
    /** lo que queda en el fondo */
    balance: number
    /** true si con lo aportado alcanza para las facturas pendientes */
    coversPending: boolean
    paidCount: number
    pendingCount: number
  }
  hasRecordedSavings: boolean
}

/* ------------------------------------------------------------------ *
 * Resolución de un gasto dentro de un mes
 * ------------------------------------------------------------------ */

export function isExpenseVisible(expense: Expense, monthId: string): boolean {
  if (expense.archived) return false
  if (expense.kind === 'oneoff') return expense.month === monthId
  return true
}

export function resolveEntry(expense: Expense, month?: MonthData): MonthEntry {
  const stored = month?.entries?.[expense.id]
  return {
    amount: stored?.amount ?? expense.amount,
    active: stored?.active ?? true,
    paid: stored?.paid ?? false,
  }
}

function zeroParts(ids: ID[]): Record<ID, number> {
  const parts: Record<ID, number> = {}
  for (const id of ids) parts[id] = 0
  return parts
}

function equalWeights(ids: ID[]): Record<ID, number> {
  const weights: Record<ID, number> = {}
  for (const id of ids) weights[id] = 1
  return weights
}

/**
 * Monto efectivo de un gasto: en modo "montos fijos" el total es la suma de los
 * montos por persona, en el resto es el monto del mes.
 */
export function effectiveAmount(expense: Expense, entry: MonthEntry, decimals: number): number {
  if (!entry.active) return 0
  if (expense.splitMode === 'custom') {
    const shares = Object.values(expense.customShares ?? {})
    const declared = sum(shares.map((value) => Math.max(0, value)))
    if (declared > 0) return round(declared, decimals)
  }
  return Math.max(0, round(entry.amount || 0, decimals))
}

/* ------------------------------------------------------------------ *
 * Vista previa de un gasto (para el formulario)
 * ------------------------------------------------------------------ */

export interface ExpensePreview {
  amount: number
  parts: Record<ID, number>
  /** sueldo tomado como referencia para cada persona */
  salaries: Record<ID, number>
  /** % del sueldo de cada persona que representa su parte */
  effectivePct: Record<ID, number>
  /** true cuando alguien tendría que poner más de lo que gana */
  exceedsSalary: boolean
  /** aviso cuando el reparto no es proporcional */
  equitable: boolean
}

/**
 * Reparto de UN gasto sin necesidad de guardarlo: alimenta la vista previa del
 * formulario, para ver quién paga qué antes de guardar (lo que mejor valoran
 * las apps del sector: detectar el error al escribirlo, no después).
 */
export function previewSplit(
  state: AppState,
  expense: Expense,
  monthId?: string,
): ExpensePreview {
  const { settings, people } = state
  const decimals = settings.decimals
  const ids = people.map((person) => person.id)
  const month = monthId ? state.months[monthId] : undefined

  const salaries: Record<ID, number> = {}
  for (const person of people) {
    const stored = month?.salaries?.[person.id]
    salaries[person.id] = Math.max(0, (Number.isFinite(stored) ? (stored as number) : person.salary) || 0)
  }
  const totalIncome = sum(ids.map((id) => at(salaries, id)))

  const entry: MonthEntry = { amount: expense.amount, active: true, paid: false }
  const amount = effectiveAmount(expense, entry, decimals)
  let parts = zeroParts(ids)

  if (amount > 0) {
    if (expense.splitMode === 'custom') {
      const shares = ids.map((id) => Math.max(0, expense.customShares?.[id] ?? 0))
      parts = sum(shares) > 0
        ? apportion(
            amount,
            Object.fromEntries(ids.map((id, i) => [id, shares[i] ?? 0])),
            decimals,
            ids,
          )
        : apportion(amount, equalWeights(ids), decimals, ids)
    } else if (expense.splitMode === 'equal' || totalIncome <= 0) {
      parts = apportion(amount, equalWeights(ids), decimals, ids)
    } else {
      parts = apportion(amount, salaries, decimals, ids)
    }
  }

  const effectivePct: Record<ID, number> = {}
  for (const id of ids) {
    const salary = at(salaries, id)
    effectivePct[id] = salary > 0 ? at(parts, id) / salary : 0
  }

  const withSalary = ids.filter((id) => at(salaries, id) > 0)
  const reference = withSalary.length > 0 ? at(effectivePct, withSalary[0] as ID) : 0
  const equitable =
    expense.splitMode === 'proportional' &&
    withSalary.length > 1 &&
    withSalary.every((id) => Math.abs(at(effectivePct, id) - reference) < 1e-6)

  const exceedsSalary = ids.some(
    (id) => at(salaries, id) > 0 && at(parts, id) > at(salaries, id),
  )

  return { amount, parts, salaries, effectivePct, exceedsSalary, equitable }
}

/* ------------------------------------------------------------------ *
 * Motor principal
 * ------------------------------------------------------------------ */

export function computeMonth(
  state: AppState,
  monthId: string,
  today: Date = new Date(),
): MonthResult {
  const { settings, people } = state
  const decimals = settings.decimals
  const ids = people.map((person) => person.id)
  const month = state.months[monthId]
  const goals = settings.goals ?? []

  const salaries: Record<ID, number> = {}
  for (const person of people) {
    const stored = month?.salaries?.[person.id]
    const value = Number.isFinite(stored) ? (stored as number) : person.salary
    salaries[person.id] = Math.max(0, value || 0)
  }
  const totalIncome = sum(ids.map((id) => at(salaries, id)))

  const visible = state.expenses.filter((expense) => isExpenseVisible(expense, monthId))
  const allocations: ExpenseAllocation[] = []
  const buckets: Record<ID, { proportional: number; equal: number; custom: number }> = {}
  for (const id of ids) buckets[id] = { proportional: 0, equal: 0, custom: 0 }

  let totalShared = 0
  let noSalaryFallback = false
  const customMismatch: { name: string; declared: number; amount: number }[] = []

  for (const expense of visible) {
    const entry = resolveEntry(expense, month)
    const amount = effectiveAmount(expense, entry, decimals)
    let parts = zeroParts(ids)

    if (amount > 0) {
      if (expense.splitMode === 'custom') {
        const shares = ids.map((id) => Math.max(0, expense.customShares?.[id] ?? 0))
        const declared = sum(shares)
        if (declared > 0) {
          parts = apportion(
            amount,
            Object.fromEntries(ids.map((id, i) => [id, shares[i] ?? 0])),
            decimals,
            ids,
          )
          if (Math.abs(declared - (entry.amount || 0)) > 1 / 10 ** decimals) {
            customMismatch.push({ name: expense.name, declared, amount: entry.amount || 0 })
          }
        } else {
          parts = apportion(amount, equalWeights(ids), decimals, ids)
        }
      } else if (expense.splitMode === 'equal') {
        parts = apportion(amount, equalWeights(ids), decimals, ids)
      } else if (totalIncome > 0) {
        parts = apportion(amount, salaries, decimals, ids)
      } else {
        noSalaryFallback = true
        parts = apportion(amount, equalWeights(ids), decimals, ids)
      }
    }

    for (const id of ids) at(buckets, id)[expense.splitMode] += at(parts, id)
    totalShared += amount

    allocations.push({
      expense,
      entry,
      amount,
      parts,
      shareOfIncome: totalIncome > 0 ? amount / totalIncome : 0,
    })
  }

  const pct = totalIncome > 0 ? totalShared / totalIncome : 0

  let paidCount = 0
  let pendingCount = 0
  let spent = 0
  let pendingBills = 0
  for (const allocation of allocations) {
    if (allocation.amount <= 0) continue
    if (allocation.entry.paid) {
      paidCount += 1
      spent += allocation.amount
    } else {
      pendingCount += 1
      pendingBills += allocation.amount
    }
  }

  const breakdowns: PersonBreakdown[] = people.map((person) => {
    const id = person.id
    const salary = at(salaries, id)
    const bucket = at(buckets, id)
    const total = round(bucket.proportional + bucket.equal + bucket.custom, decimals)

    const progress: GoalProgress[] = goals.map((goal) => {
      const target = round((salary * goal.pct) / 100, decimals)
      const stored = month?.savings?.[id]?.[goal.id]
      return {
        goal,
        target,
        actual: stored === undefined ? target : round(stored, decimals),
        deposited: stored === undefined ? 0 : round(stored, decimals),
        recorded: stored !== undefined,
      }
    })

    const goalsTarget = round(sum(progress.map((entry) => entry.target)), decimals)
    const goalsActual = round(sum(progress.map((entry) => entry.actual)), decimals)
    const storedContribution = month?.contributions?.[id]

    return {
      person,
      salary,
      proportional: round(bucket.proportional, decimals),
      equal: round(bucket.equal, decimals),
      custom: round(bucket.custom, decimals),
      total,
      effectivePct: salary > 0 ? total / salary : 0,
      shareOfIncome: totalIncome > 0 ? total / totalIncome : 0,
      contribution: {
        expected: total,
        actual: storedContribution ? round(storedContribution.amount, decimals) : total,
        done: storedContribution?.done ?? false,
      },
      goals: progress,
      goalsTarget,
      goalsActual,
      available: round(salary - total - goalsTarget, decimals),
      distribution: {
        aporte: total,
        goals: progress
          .filter((entry) => entry.target > 0)
          .map((entry) => ({
            id: entry.goal.id,
            name: entry.goal.name,
            color: entry.goal.color,
            amount: entry.target,
          })),
        libre: round(salary - total - goalsTarget, decimals),
      },
    }
  })

  const byCategory: CategoryTotal[] = CATEGORIES.map((category) => {
    const items = allocations.filter(
      (allocation) => allocation.amount > 0 && allocation.expense.category === category,
    )
    const amount = round(sum(items.map((item) => item.amount)), decimals)
    return {
      category,
      amount,
      pct: totalShared > 0 ? amount / totalShared : 0,
      count: items.length,
    }
  }).filter((entry) => entry.count > 0)

  const withSalary = breakdowns.filter((entry) => entry.salary > 0)
  const reference = withSalary.length > 0 ? (withSalary[0] as PersonBreakdown).effectivePct : 0
  const equitable =
    withSalary.length > 1 &&
    withSalary.every((entry) => Math.abs(entry.effectivePct - reference) < 1e-6)

  const contributed = round(
    sum(breakdowns.filter((entry) => entry.contribution.done).map((entry) => entry.contribution.actual)),
    decimals,
  )
  const pendingContributions = round(
    sum(breakdowns.filter((entry) => !entry.contribution.done).map((entry) => entry.contribution.actual)),
    decimals,
  )
  const potBalance = round(contributed - spent, decimals)

  const base: MonthResult = {
    monthId,
    people: breakdowns,
    totalIncome,
    totalShared: round(totalShared, decimals),
    pct,
    totalContributions: round(sum(breakdowns.map((entry) => entry.total)), decimals),
    equitable,
    byCategory,
    allocations,
    warnings: [],
    savings: {
      byGoal: goals.map((goal) => {
        const targets = breakdowns.map(
          (entry) => entry.goals.find((item) => item.goal.id === goal.id)?.target ?? 0,
        )
        const actuals = breakdowns.map(
          (entry) => entry.goals.find((item) => item.goal.id === goal.id)?.actual ?? 0,
        )
        const deposits = breakdowns.map(
          (entry) => entry.goals.find((item) => item.goal.id === goal.id)?.deposited ?? 0,
        )
        const recorded = breakdowns.some(
          (entry) => entry.goals.find((item) => item.goal.id === goal.id)?.recorded,
        )
        return {
          goal,
          target: round(sum(targets), decimals),
          actual: round(sum(actuals), decimals),
          deposited: round(sum(deposits), decimals),
          recorded,
        }
      }),
      totalGoal: 0,
      totalActual: 0,
      totalDeposited: 0,
    },
    pot: {
      target: round(totalShared, decimals),
      contributed,
      pending: pendingContributions,
      spent: round(spent, decimals),
      pendingBills: round(pendingBills, decimals),
      balance: potBalance,
      coversPending: potBalance >= pendingBills - 1 / 10 ** decimals,
      paidCount,
      pendingCount,
    },
    hasRecordedSavings: breakdowns.some((entry) => entry.goals.some((goal) => goal.recorded)),
  }

  base.savings.totalGoal = round(sum(base.savings.byGoal.map((entry) => entry.target)), decimals)
  base.savings.totalActual = round(sum(base.savings.byGoal.map((entry) => entry.actual)), decimals)
  base.savings.totalDeposited = round(
    sum(base.savings.byGoal.map((entry) => entry.deposited)),
    decimals,
  )

  base.warnings = buildWarnings({
    state,
    monthId,
    today,
    totalIncome,
    totalShared,
    pct,
    breakdowns,
    allocations,
    result: base,
    customMismatch,
    noSalaryFallback,
  })

  return base
}

/* ------------------------------------------------------------------ *
 * Alertas
 * ------------------------------------------------------------------ */

interface WarningInput {
  state: AppState
  monthId: string
  today: Date
  totalIncome: number
  totalShared: number
  pct: number
  breakdowns: PersonBreakdown[]
  allocations: ExpenseAllocation[]
  result: MonthResult
  customMismatch: { name: string; declared: number; amount: number }[]
  noSalaryFallback: boolean
}

const DUE_LIST_LIMIT = 4

function buildWarnings(input: WarningInput): Warning[] {
  const { state, monthId, today, totalIncome, totalShared, pct, breakdowns, allocations, result } = input
  const { settings } = state
  const warnings: Warning[] = []
  const money = (value: number) => formatMoney(value, settings)
  const unit = 1 / 10 ** settings.decimals

  if (totalIncome <= 0) {
    warnings.push({
      id: 'no-income',
      level: 'danger',
      title: 'Falta el ingreso del mes',
      detail: 'Ingresa el sueldo de cada persona para calcular el % de aporte equitativo.',
    })
  } else {
    if (pct > 1) {
      warnings.push({
        id: 'overspend-danger',
        level: 'danger',
        title: 'Los gastos compartidos superan el ingreso combinado',
        detail: `Los gastos compartidos son ${Math.round(pct * 100)} % del ingreso total del mes y no queda espacio para las metas.`,
      })
    } else if (pct * 100 > settings.expenseWarnPct) {
      warnings.push({
        id: 'overspend-warn',
        level: 'warn',
        title: `Los gastos compartidos usan más del ${settings.expenseWarnPct} % del ingreso`,
        detail: `Este mes representan el ${Math.round(pct * 100)} % del ingreso combinado. Revisa si hay suscripciones o gastos que puedas ajustar.`,
      })
    }
  }

  const goalsPct = round(sum((settings.goals ?? []).map((goal) => goal.pct)), 2)
  if (totalIncome > 0 && pct * 100 + goalsPct > 100) {
    warnings.push({
      id: 'savings-no-room',
      level: 'warn',
      title: 'Las metas no caben en el presupuesto',
      detail: `Gastos compartidos (${Math.round(pct * 100)} %) + metas (${goalsPct} %) supera el 100 % del ingreso. Ajusta gastos o metas.`,
    })
  }

  for (const entry of breakdowns) {
    const committed = entry.total + entry.goalsTarget
    if (entry.salary > 0 && committed > entry.salary + unit) {
      warnings.push({
        id: `deficit-${entry.person.id}`,
        level: 'danger',
        title: `A ${entry.person.name} no le alcanza el sueldo`,
        detail: `Aporta ${money(entry.total)} + metas ${money(entry.goalsTarget)} = ${money(committed)} sobre un sueldo de ${money(entry.salary)}. Faltan ${money(committed - entry.salary)}.`,
      })
    }
  }

  const { pot } = result
  if (pot.spent > pot.contributed + unit) {
    warnings.push({
      id: 'pot-negative',
      level: 'warn',
      title: 'Se pagaron facturas con dinero que aún no está en el fondo',
      detail: `El fondo tiene ${money(pot.contributed)} y ya se pagaron ${money(pot.spent)}. Faltan ${money(pot.spent - pot.contributed)} por transferir.`,
    })
  } else if (!pot.coversPending && pot.pendingBills > 0) {
    warnings.push({
      id: 'pot-shortfall',
      level: 'warn',
      title: 'El fondo común no alcanza para las facturas pendientes',
      detail: `Quedan ${money(pot.pendingBills)} por pagar y hay ${money(Math.max(0, pot.balance))} en el fondo, más ${money(pot.pending)} de aportes sin transferir.`,
    })
  }

  const subscriptions = allocations.filter(
    (allocation) => allocation.amount > 0 && allocation.expense.subscription,
  )
  const subscriptionTotal = round(sum(subscriptions.map((item) => item.amount)), settings.decimals)
  if (subscriptionTotal > 0 && totalIncome > 0) {
    const share = (subscriptionTotal / totalIncome) * 100
    if (share > settings.subscriptionWarnPct) {
      warnings.push({
        id: 'subscriptions-heavy',
        level: 'warn',
        title: `Las suscripciones son el ${Math.round(share)} % del ingreso`,
        detail: `Suman ${money(subscriptionTotal)} al mes (${money(subscriptionTotal * 12)} al año) en ${subscriptions.length} servicios.`,
      })
    }
  }

  if (monthId === monthIdOf(today)) {
    const day = today.getDate()
    const overdue: string[] = []
    const soon: string[] = []
    for (const allocation of allocations) {
      const { expense, entry, amount } = allocation
      if (amount <= 0 || entry.paid || !expense.dueDay || expense.kind !== 'recurring') continue
      const delta = expense.dueDay - day
      if (delta < 0) overdue.push(`${expense.name} (día ${expense.dueDay})`)
      else if (delta <= settings.dueSoonDays) {
        soon.push(`${expense.name} (${delta === 0 ? 'vence hoy' : `en ${delta} día(s)`})`)
      }
    }
    if (overdue.length > 0) {
      warnings.push({
        id: 'overdue',
        level: 'warn',
        title: `${overdue.length} gasto(s) vencido(s) sin pagar`,
        detail: overdue.slice(0, DUE_LIST_LIMIT).join(' · '),
      })
    }
    if (soon.length > 0) {
      warnings.push({
        id: 'due-soon',
        level: 'info',
        title: `Próximos vencimientos (${settings.dueSoonDays} días)`,
        detail: soon.slice(0, DUE_LIST_LIMIT).join(' · '),
      })
    }
  }

  const forgotten = allocations.filter((allocation) => {
    const { expense } = allocation
    if (!expense.subscription || expense.kind !== 'recurring') return false
    let unpaidMonths = 0
    for (let i = 0; i < 3; i += 1) {
      const id = shiftMonth(monthId, -i)
      const data = state.months[id]
      if (!data) continue
      const entry = resolveEntry(expense, data)
      if (entry.active && !entry.paid) unpaidMonths += 1
    }
    return unpaidMonths >= 2
  })
  if (forgotten.length > 0) {
    warnings.push({
      id: 'forgotten-subscriptions',
      level: 'info',
      title: 'Suscripciones sin registrar como pagadas',
      detail: `${forgotten
        .map((allocation) => allocation.expense.name)
        .slice(0, DUE_LIST_LIMIT)
        .join(' · ')}. Si ya no las usas, desactívalas o elimínalas.`,
    })
  }

  if (input.noSalaryFallback) {
    warnings.push({
      id: 'equal-fallback',
      level: 'info',
      title: 'Sin sueldos: se repartió en partes iguales',
      detail: 'Falta el ingreso de alguna persona, así que los gastos proporcionales se dividieron por igual.',
    })
  }

  for (const mismatch of input.customMismatch) {
    warnings.push({
      id: `custom-mismatch-${mismatch.name}`,
      level: 'info',
      title: `${mismatch.name}: los montos fijos no coinciden con el monto del gasto`,
      detail: `Los montos fijos suman ${money(mismatch.declared)} y el monto anotado es ${money(mismatch.amount)}. Se usa la suma de los montos fijos.`,
    })
  }

  if (totalShared > 0 && totalIncome > 0 && pct <= 1) {
    const totalContributions = sum(breakdowns.map((entry) => entry.total))
    if (Math.abs(totalContributions - totalShared) > unit) {
      warnings.push({
        id: 'rounding',
        level: 'info',
        title: 'Diferencia de redondeo',
        detail: `Los aportes suman ${money(totalContributions)} y los gastos ${money(totalShared)}.`,
      })
    }
  }

  return warnings
}

/* ------------------------------------------------------------------ *
 * Historial
 * ------------------------------------------------------------------ */

export interface HistoryRow {
  monthId: string
  label: string
  shortLabel: string
  totalIncome: number
  totalShared: number
  pct: number
  perPerson: { id: ID; name: string; color: string; contribution: number; effectivePct: number; salary: number }[]
  savings: { total: number; byGoal: { id: ID; name: string; color: string; actual: number }[] }
  pot: { contributed: number; spent: number; pending: number }
  paidCount: number
  pendingCount: number
  hasData: boolean
}

export function buildHistory(
  state: AppState,
  monthIds: string[],
  today: Date = new Date(),
): HistoryRow[] {
  const ids = monthIds.length > 0 ? monthIds : [currentMonthId(today)]
  return ids
    .slice()
    .sort()
    .map((monthId) => {
      const result = computeMonth(state, monthId, today)
      return {
        monthId,
        label: monthLabel(monthId, state.settings),
        shortLabel: monthShortLabel(monthId, state.settings),
        totalIncome: result.totalIncome,
        totalShared: result.totalShared,
        pct: result.pct,
        perPerson: result.people.map((entry) => ({
          id: entry.person.id,
          name: entry.person.name,
          color: entry.person.color,
          contribution: entry.total,
          effectivePct: entry.effectivePct,
          salary: entry.salary,
        })),
        savings: {
          total: result.savings.totalActual,
          byGoal: result.savings.byGoal.map((entry) => ({
            id: entry.goal.id,
            name: entry.goal.name,
            color: entry.goal.color,
            actual: entry.actual,
          })),
        },
        pot: {
          contributed: result.pot.contributed,
          spent: result.pot.spent,
          pending: result.pot.pending,
        },
        paidCount: result.pot.paidCount,
        pendingCount: result.pot.pendingCount,
        hasData: Boolean(state.months[monthId]),
      }
    })
}

/** Meses relevantes: los guardados y, siempre, el mes en curso. */
export function trackedMonths(state: AppState, today: Date = new Date()): string[] {
  const set = new Set(Object.keys(state.months))
  set.add(currentMonthId(today))
  return [...set].sort()
}

/* ------------------------------------------------------------------ *
 * Metas: meta anual, acumulado y proyectado
 * ------------------------------------------------------------------ */

export interface GoalRow {
  /** identificador estable de la fila: meta y persona (o el fondo común) */
  id: string
  goal: Goal
  /** persona de la fila; vacío cuando la meta es conjunta */
  person?: Person
  label: string
  /** lo convenido al mes: el % del sueldo de esa persona, o la suma del grupo */
  monthly: number
  /** meta anual: lo convenido al mes por los doce meses del año */
  target: number
  /** suma real de los meses registrados */
  accumulated: number
  /** acumulado + lo que queda por guardar de aquí a diciembre */
  projected: number
  /** meses del año con montos registrados */
  monthsRecorded: number
  /** meses que quedan del año, contando el actual como transcurrido */
  monthsLeft: number
  /** acumulado / meta */
  progress: number
}

/**
 * Filas de metas para la vista de seguimiento.
 *
 * - Meta: lo que se habría ahorrado aportando lo convenido todos los meses del año.
 * - Acumulado: la suma real mes a mes.
 * - Proyectado: el acumulado más lo que falta por guardar hasta diciembre.
 */
export function buildGoalRows(
  state: AppState,
  monthId: string,
  today: Date = new Date(),
): GoalRow[] {
  const { settings, people } = state
  const decimals = settings.decimals
  const { year, month } = parseMonthId(monthId)
  const monthsLeft = Math.max(0, 12 - month)

  // meses del año en curso hasta el mes elegido, con datos guardados
  const months = trackedMonths(state, today).filter((id) => {
    const parsed = parseMonthId(id)
    return parsed.year === year && parsed.month <= month && Boolean(state.months[id])
  })

  const monthData = state.months[monthId]
  const salaryOf = (person: Person): number => {
    const stored = monthData?.salaries?.[person.id]
    return Math.max(0, (Number.isFinite(stored) ? (stored as number) : person.salary) || 0)
  }

  const accumulatedFor = (goalId: ID, personId?: ID): number =>
    round(
      sum(
        months.map((id) => {
          const savings = state.months[id]?.savings ?? {}
          if (personId) return savings[personId]?.[goalId] ?? 0
          return sum(Object.values(savings).map((byGoal) => byGoal[goalId] ?? 0))
        }),
      ),
      decimals,
    )

  const recordedFor = (goalId: ID, personId?: ID): number =>
    months.filter((id) => {
      const savings = state.months[id]?.savings ?? {}
      if (personId) return savings[personId]?.[goalId] !== undefined
      return Object.values(savings).some((byGoal) => byGoal[goalId] !== undefined)
    }).length

  const rows: GoalRow[] = []

  for (const goal of settings.goals) {
    if (goal.scope === 'personal') {
      for (const person of people) {
        const monthly = round((salaryOf(person) * goal.pct) / 100, decimals)
        const accumulated = accumulatedFor(goal.id, person.id)
        rows.push({
          id: `${goal.id}:${person.id}`,
          goal,
          person,
          label: `${goal.name} · ${person.name}`,
          monthly,
          target: round(monthly * 12, decimals),
          accumulated,
          projected: round(accumulated + monthly * monthsLeft, decimals),
          monthsRecorded: recordedFor(goal.id, person.id),
          monthsLeft,
          progress: monthly > 0 ? accumulated / (monthly * 12) : 1,
        })
      }
      continue
    }

    const monthly = round(
      (sum(people.map(salaryOf)) * goal.pct) / 100,
      decimals,
    )
    const accumulated = accumulatedFor(goal.id)
    rows.push({
      id: goal.id,
      goal,
      label: goal.name,
      monthly,
      target: round(monthly * 12, decimals),
      accumulated,
      projected: round(accumulated + monthly * monthsLeft, decimals),
      monthsRecorded: recordedFor(goal.id),
      monthsLeft,
      progress: monthly > 0 ? accumulated / (monthly * 12) : 1,
    })
  }

  return rows
}
