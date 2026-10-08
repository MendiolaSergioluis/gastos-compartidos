import type {
  AppState,
  ContributionEntry,
  Expense,
  Goal,
  ID,
  MonthData,
  MonthEntry,
  Person,
  Settings,
} from '../domain/types'
import { createDemoState, createEmptyState } from '../domain/defaults'

export type Action =
  | { type: 'settings/patch'; patch: Partial<Settings> }
  | { type: 'demo/dismiss' }
  | { type: 'person/upsert'; person: Person }
  | { type: 'person/remove'; id: ID }
  | { type: 'goal/upsert'; goal: Goal }
  | { type: 'goal/remove'; id: ID }
  | { type: 'expense/upsert'; expense: Expense }
  | { type: 'expense/remove'; id: ID }
  | { type: 'expense/archive'; id: ID; archived: boolean }
  | { type: 'month/ensure'; monthId: string }
  | { type: 'month/salary'; monthId: string; personId: ID; value: number }
  | { type: 'month/entry'; monthId: string; expenseId: ID; patch: Partial<MonthEntry> }
  | { type: 'month/entryReset'; monthId: string; expenseId: ID }
  | { type: 'month/contribution'; monthId: string; personId: ID; patch: Partial<ContributionEntry> }
  | { type: 'month/savings'; monthId: string; personId: ID; goalId: ID; value: number }
  | { type: 'month/note'; monthId: string; note: string }
  | { type: 'month/clear'; monthId: string }
  | { type: 'state/import'; state: AppState }
  | { type: 'state/demo' }
  | { type: 'state/empty' }

/** Crea el mes si no existe, heredando los sueldos del mes guardado más reciente. */
export function ensureMonth(state: AppState, monthId: string): AppState {
  if (state.months[monthId]) return state
  const previousId = Object.keys(state.months)
    .filter((id) => id < monthId)
    .sort()
    .pop()
  const previous = previousId ? state.months[previousId] : undefined
  const salaries: Record<ID, number> = {}
  for (const person of state.people) {
    salaries[person.id] = previous?.salaries?.[person.id] ?? person.salary ?? 0
  }
  const month: MonthData = { id: monthId, salaries, entries: {}, contributions: {}, savings: {} }
  return { ...state, months: { ...state.months, [monthId]: month } }
}

function patchMonth(
  state: AppState,
  monthId: string,
  update: (month: MonthData) => MonthData,
): AppState {
  const base = ensureMonth(state, monthId)
  const month = base.months[monthId]
  if (!month) return base
  return { ...base, months: { ...base.months, [monthId]: update(month) } }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'settings/patch':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case 'demo/dismiss':
      return { ...state, demo: false }

    case 'person/upsert': {
      const previous = state.people.find((person) => person.id === action.person.id)
      const exists = Boolean(previous)
      const people = exists
        ? state.people.map((person) => (person.id === action.person.id ? action.person : person))
        : [...state.people, action.person]

      // El sueldo base se propaga a todos los meses para que el % se recalcule,
      // pero solo si cambió: renombrar o cambiar el color no debe pisar los
      // sueldos que el usuario ajustó mes a mes.
      if (previous && previous.salary === action.person.salary) {
        return { ...state, people }
      }
      const months: Record<string, MonthData> = {}
      for (const [id, month] of Object.entries(state.months)) {
        months[id] = {
          ...month,
          salaries: { ...month.salaries, [action.person.id]: action.person.salary },
        }
      }
      return { ...state, people, months }
    }

    case 'person/remove': {
      const people = state.people.filter((person) => person.id !== action.id)
      if (people.length === 0) return state
      const months: Record<string, MonthData> = {}
      for (const [id, month] of Object.entries(state.months)) {
        const { [action.id]: _salary, ...salaries } = month.salaries
        const { [action.id]: _savings, ...savings } = month.savings
        const { [action.id]: _contribution, ...contributions } = month.contributions ?? {}
        months[id] = { ...month, salaries, savings, contributions }
      }
      const expenses = state.expenses.map((expense) => {
        if (!expense.customShares) return expense
        const { [action.id]: _share, ...customShares } = expense.customShares
        return { ...expense, customShares }
      })
      return { ...state, people, months, expenses }
    }

    case 'goal/upsert': {
      const goals = state.settings.goals.some((goal) => goal.id === action.goal.id)
        ? state.settings.goals.map((goal) => (goal.id === action.goal.id ? action.goal : goal))
        : [...state.settings.goals, action.goal]
      return { ...state, settings: { ...state.settings, goals } }
    }

    case 'goal/remove': {
      const goals = state.settings.goals.filter((goal) => goal.id !== action.id)
      const months: Record<string, MonthData> = {}
      for (const [id, month] of Object.entries(state.months)) {
        const savings: MonthData['savings'] = {}
        for (const [personId, byGoal] of Object.entries(month.savings ?? {})) {
          const { [action.id]: _removed, ...rest } = byGoal
          savings[personId] = rest
        }
        months[id] = { ...month, savings }
      }
      return { ...state, settings: { ...state.settings, goals }, months }
    }

    case 'expense/upsert': {
      const exists = state.expenses.some((expense) => expense.id === action.expense.id)
      const expenses = exists
        ? state.expenses.map((expense) =>
            expense.id === action.expense.id ? action.expense : expense,
          )
        : [...state.expenses, action.expense]
      return { ...state, expenses }
    }

    case 'expense/remove': {
      const months: Record<string, MonthData> = {}
      for (const [id, month] of Object.entries(state.months)) {
        const { [action.id]: _entry, ...entries } = month.entries
        months[id] = { ...month, entries }
      }
      return { ...state, expenses: state.expenses.filter((e) => e.id !== action.id), months }
    }

    case 'expense/archive':
      return {
        ...state,
        expenses: state.expenses.map((expense) =>
          expense.id === action.id ? { ...expense, archived: action.archived } : expense,
        ),
      }

    case 'month/ensure':
      return ensureMonth(state, action.monthId)

    case 'month/salary':
      return patchMonth(state, action.monthId, (month) => ({
        ...month,
        salaries: { ...month.salaries, [action.personId]: action.value },
      }))

    case 'month/entry':
      return patchMonth(state, action.monthId, (month) => {
        const current = month.entries[action.expenseId]
        const expense = state.expenses.find((item) => item.id === action.expenseId)
        const fallback: MonthEntry = {
          amount: expense?.amount ?? 0,
          active: true,
          paid: false,
        }
        return {
          ...month,
          entries: {
            ...month.entries,
            [action.expenseId]: { ...(current ?? fallback), ...action.patch },
          },
        }
      })

    case 'month/entryReset':
      return patchMonth(state, action.monthId, (month) => {
        const { [action.expenseId]: _removed, ...entries } = month.entries
        return { ...month, entries }
      })

    case 'month/contribution':
      return patchMonth(state, action.monthId, (month) => {
        const contributions = month.contributions ?? {}
        const current = contributions[action.personId] ?? { amount: 0, done: false }
        return {
          ...month,
          contributions: {
            ...contributions,
            [action.personId]: { ...current, ...action.patch },
          },
        }
      })

    case 'month/savings':
      return patchMonth(state, action.monthId, (month) => {
        const savings = month.savings ?? {}
        const current = savings[action.personId] ?? {}
        // un 0 es «sin registrar», no un registro de cero: se borra la clave
        const { [action.goalId]: _removed, ...rest } = current
        return {
          ...month,
          savings: {
            ...savings,
            [action.personId]:
              action.value === 0 ? rest : { ...current, [action.goalId]: action.value },
          },
        }
      })

    case 'month/note':
      return patchMonth(state, action.monthId, (month) => ({ ...month, note: action.note }))

    case 'month/clear': {
      const months = { ...state.months }
      delete months[action.monthId]
      return { ...state, months }
    }

    case 'state/import':
      return action.state

    case 'state/demo':
      return createDemoState()

    case 'state/empty':
      return createEmptyState()

    default:
      return state
  }
}
