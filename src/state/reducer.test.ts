import { describe, expect, it } from 'vitest'
import { createEmptyState, GOAL_VACATION_ID } from '../domain/defaults'
import { computeMonth } from '../domain/finance'
import { normalizeState } from '../domain/storage'
import type { AppState, Expense, MonthData } from '../domain/types'
import { reducer } from './reducer'

const A = 'a'
const B = 'b'

function base(): AppState {
  const state = createEmptyState()
  return {
    ...state,
    people: [
      { id: A, name: 'Ana', color: '#111111', salary: 3000 },
      { id: B, name: 'Luis', color: '#222222', salary: 2000 },
    ],
    expenses: [
      {
        id: 'e1',
        name: 'Arriendo',
        category: 'vivienda',
        kind: 'recurring',
        amount: 1500,
        splitMode: 'proportional',
      },
    ],
  }
}

describe('reducer', () => {
  it('crea el mes al editar un gasto y guarda el cambio', () => {
    const state = reducer(base(), {
      type: 'month/entry',
      monthId: '2025-07',
      expenseId: 'e1',
      patch: { paid: true, amount: 1600 },
    })
    expect(state.months['2025-07'].entries.e1).toMatchObject({ amount: 1600, paid: true })
    expect(state.months['2025-07'].salaries).toEqual({ [A]: 3000, [B]: 2000 })
    expect(state.months['2025-07'].contributions).toEqual({})
  })

  it('guarda el aporte al fondo común de cada persona', () => {
    const withContribution = reducer(base(), {
      type: 'month/contribution',
      monthId: '2025-07',
      personId: A,
      patch: { amount: 900, done: true },
    })
    expect(withContribution.months['2025-07'].contributions[A]).toEqual({
      amount: 900,
      done: true,
    })
    const patched = reducer(withContribution, {
      type: 'month/contribution',
      monthId: '2025-07',
      personId: A,
      patch: { done: false },
    })
    expect(patched.months['2025-07'].contributions[A]).toEqual({ amount: 900, done: false })
  })

  it('registra el ahorro por meta', () => {
    const state = reducer(base(), {
      type: 'month/savings',
      monthId: '2025-07',
      personId: A,
      goalId: GOAL_VACATION_ID,
      value: 250,
    })
    expect(state.months['2025-07'].savings[A][GOAL_VACATION_ID]).toBe(250)
  })

  it('un cero deja la meta sin registrar, no registrada en cero', () => {
    const conValor = reducer(base(), {
      type: 'month/savings',
      monthId: '2025-07',
      personId: A,
      goalId: GOAL_VACATION_ID,
      value: 250,
    })
    const borrado = reducer(conValor, {
      type: 'month/savings',
      monthId: '2025-07',
      personId: A,
      goalId: GOAL_VACATION_ID,
      value: 0,
    })
    expect(borrado.months['2025-07'].savings[A][GOAL_VACATION_ID]).toBeUndefined()
  })

  it('hereda los sueldos del mes guardado más reciente', () => {
    const withMonth = reducer(base(), { type: 'month/salary', monthId: '2025-05', personId: A, value: 3500 })
    const next = reducer(withMonth, { type: 'month/ensure', monthId: '2025-06' })
    expect(next.months['2025-06'].salaries[A]).toBe(3500)
  })

  it('cambiar el sueldo base propaga el valor a todos los meses', () => {
    const withMonth = reducer(base(), {
      type: 'month/salary',
      monthId: '2025-05',
      personId: A,
      value: 3500,
    })
    const updated = reducer(withMonth, {
      type: 'person/upsert',
      person: { id: A, name: 'Ana', color: '#111111', salary: 4000 },
    })
    expect(updated.months['2025-05'].salaries[A]).toBe(4000)
  })

  it('renombrar a una persona NO pisa los sueldos personalizados del mes', () => {
    const withMonth = reducer(base(), {
      type: 'month/salary',
      monthId: '2025-05',
      personId: A,
      value: 3500,
    })
    const renamed = reducer(withMonth, {
      type: 'person/upsert',
      person: { id: A, name: 'Ana María', color: '#333333', salary: 3000 },
    })
    expect(renamed.people[0].name).toBe('Ana María')
    expect(renamed.months['2025-05'].salaries[A]).toBe(3500)
  })

  it('eliminar un gasto limpia sus registros de todos los meses', () => {
    const withEntry = reducer(base(), {
      type: 'month/entry',
      monthId: '2025-05',
      expenseId: 'e1',
      patch: { paid: true },
    })
    const removed = reducer(withEntry, { type: 'expense/remove', id: 'e1' })
    expect(removed.expenses).toHaveLength(0)
    expect(removed.months['2025-05'].entries.e1).toBeUndefined()
  })

  it('eliminar una persona limpia su sueldo, su ahorro, su aporte y sus montos fijos', () => {
    const state: AppState = {
      ...base(),
      expenses: [
        {
          id: 'e1',
          name: 'Auto',
          category: 'transporte',
          kind: 'recurring',
          amount: 300,
          splitMode: 'custom',
          customShares: { [A]: 100, [B]: 200 },
        } as Expense,
      ],
      months: {
        '2025-05': {
          id: '2025-05',
          salaries: { [A]: 3000, [B]: 2000 },
          entries: {},
          contributions: { [A]: { amount: 200, done: true }, [B]: { amount: 100, done: false } },
          savings: {
            [A]: { [GOAL_VACATION_ID]: 300 },
            [B]: { [GOAL_VACATION_ID]: 200 },
          },
        } as MonthData,
      },
    }
    const removed = reducer(state, { type: 'person/remove', id: B })
    expect(removed.people.map((person) => person.id)).toEqual([A])
    expect(removed.months['2025-05'].salaries[B]).toBeUndefined()
    expect(removed.months['2025-05'].savings[B]).toBeUndefined()
    expect(removed.months['2025-05'].contributions[B]).toBeUndefined()
    expect(removed.expenses[0].customShares).toEqual({ [A]: 100 })
  })

  it('añade, edita y elimina metas, limpiando el ahorro asociado', () => {
    const added = reducer(base(), {
      type: 'goal/upsert',
      goal: { id: 'padres', name: 'Aporte a los padres', pct: 5, color: '#60a5fa', scope: 'joint' },
    })
    expect(added.settings.goals.map((goal) => goal.id)).toContain('padres')

    const edited = reducer(added, {
      type: 'goal/upsert',
      goal: { id: 'padres', name: 'Aporte a los padres', pct: 7, color: '#60a5fa', scope: 'joint' },
    })
    expect(edited.settings.goals.find((goal) => goal.id === 'padres')?.pct).toBe(7)

    const withSavings = reducer(edited, {
      type: 'month/savings',
      monthId: '2025-05',
      personId: A,
      goalId: 'padres',
      value: 120,
    })
    expect(withSavings.months['2025-05'].savings[A].padres).toBe(120)

    const removed = reducer(withSavings, { type: 'goal/remove', id: 'padres' })
    expect(removed.settings.goals.map((goal) => goal.id)).not.toContain('padres')
    expect(removed.months['2025-05'].savings[A].padres).toBeUndefined()
  })

  it('importar un JSON normalizado deja el estado utilizable', () => {
    const imported = reducer(base(), {
      type: 'state/import',
      state: normalizeState({ people: [{ id: 'x', name: 'X', salary: '1000' }] }),
    })
    expect(imported.people[0].salary).toBe(1000)
    expect(computeMonth(imported, '2025-07').totalIncome).toBe(1000)
  })

  it('desactivar un gasto lo saca del cálculo del mes', () => {
    const state = reducer(base(), {
      type: 'month/entry',
      monthId: '2025-07',
      expenseId: 'e1',
      patch: { active: false },
    })
    expect(computeMonth(state, '2025-07').totalShared).toBe(0)
  })
})
