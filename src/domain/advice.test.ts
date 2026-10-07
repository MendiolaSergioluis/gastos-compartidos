import { describe, expect, it } from 'vitest'
import { suggestAdvice } from './advice'
import { DEFAULT_SETTINGS, GOAL_PERSONAL_ID, GOAL_VACATION_ID } from './defaults'
import { computeMonth } from './finance'
import { DEFAULT_ICON_BY_CATEGORY, ICONS, iconSlugFor } from './icons'
import type { AppState, Expense, Goal, MonthData } from './types'

const A = 'a'
const B = 'b'

const GOALS: Goal[] = [
  { id: GOAL_PERSONAL_ID, name: 'Ahorro personal', pct: 10, color: '#34d399', scope: 'personal' },
  { id: GOAL_VACATION_ID, name: 'Vacaciones', pct: 10, color: '#fbbf24', scope: 'joint' },
]

function makeState(expenses: Partial<Expense>[], months: Record<string, MonthData> = {}): AppState {
  return {
    version: 2,
    people: [
      { id: A, name: 'Ana', color: '#2dd4bf', salary: 3000 },
      { id: B, name: 'Luis', color: '#f472b6', salary: 2000 },
    ],
    expenses: expenses.map((expense, index) => ({
      id: `e${index}`,
      name: `Gasto ${index}`,
      category: 'otros',
      kind: 'recurring',
      amount: 0,
      splitMode: 'proportional',
      ...expense,
    })) as Expense[],
    months,
    settings: { ...DEFAULT_SETTINGS, goals: GOALS },
  }
}

const monthWith = (
  entries: MonthData['entries'] = {},
  savings: MonthData['savings'] = {},
  contributions: MonthData['contributions'] = {},
): MonthData => ({
  id: '2025-01',
  salaries: { [A]: 3000, [B]: 2000 },
  entries,
  savings,
  contributions,
})

const FULL_SAVINGS = {
  [A]: { [GOAL_PERSONAL_ID]: 300, [GOAL_VACATION_ID]: 300 },
  [B]: { [GOAL_PERSONAL_ID]: 200, [GOAL_VACATION_ID]: 200 },
}

describe('sugerencias de acción', () => {
  it('sin catálogo pide empezar por los gastos', () => {
    const state = makeState([])
    const advice = suggestAdvice(state, computeMonth(state, '2025-01'))
    expect(advice[0].id).toBe('no-expenses')
    expect(advice[0].tab).toBe('gastos')
  })

  it('avisa cuando falta un sueldo', () => {
    const state = makeState([{ amount: 500 }])
    state.people[1].salary = 0
    const advice = suggestAdvice(state, computeMonth(state, '2025-01'))
    expect(advice.map((item) => item.id)).toContain('missing-salary')
    expect(advice.find((item) => item.id === 'missing-salary')?.title).toContain('Luis')
  })

  it('recuerda transferir el aporte al fondo común', () => {
    const state = makeState([{ amount: 1000 }], { '2025-01': monthWith() })
    const advice = suggestAdvice(state, computeMonth(state, '2025-01'))
    const item = advice.find((entry) => entry.id === 'contributions-pending')
    expect(item).toBeTruthy()
    expect(item?.title).toContain('1,000')
    expect(item?.tab).toBe('mes')
  })

  it('cuando todo está pagado y transferido, avisa lo que falta registrar', () => {
    const state = makeState([{ amount: 1000 }], {
      '2025-01': monthWith(
        { e0: { amount: 1000, active: true, paid: true } },
        FULL_SAVINGS,
        { [A]: { amount: 600, done: true }, [B]: { amount: 400, done: true } },
      ),
    })
    const ids = suggestAdvice(state, computeMonth(state, '2025-01')).map((item) => item.id)
    expect(ids).not.toContain('contributions-pending')
    expect(ids).not.toContain('nothing-paid')
    expect(ids).not.toContain('no-savings')
    expect(ids).not.toContain('pot-negative')
  })

  it('marca el fondo en rojo cuando se pagó de más', () => {
    const state = makeState([{ amount: 1000 }], {
      '2025-01': monthWith(
        { e0: { amount: 1000, active: true, paid: true } },
        FULL_SAVINGS,
        { [A]: { amount: 600, done: true } },
      ),
    })
    const advice = suggestAdvice(state, computeMonth(state, '2025-01'))
    expect(advice.map((item) => item.id)).toContain('pot-negative')
    expect(advice[0].tone).toBe('warn')
  })

  it('propone marcar las facturas cuando no hay ninguna pagada', () => {
    const state = makeState([{ amount: 500 }, { amount: 300 }], { '2025-01': monthWith() })
    const item = suggestAdvice(state, computeMonth(state, '2025-01')).find(
      (entry) => entry.id === 'nothing-paid',
    )
    expect(item?.detail).toContain('2 facturas')
  })

  it('pone las advertencias primero y nunca devuelve más de tres', () => {
    // 4200 de gastos sobre 5000 de ingreso = 84 % + 20 % de metas → déficit
    const state = makeState([{ amount: 4200 }], { '2025-01': monthWith() })
    const advice = suggestAdvice(state, computeMonth(state, '2025-01'))
    expect(advice.length).toBeLessThanOrEqual(3)
    expect(advice[0].tone).toBe('warn')
    expect(advice.map((entry) => entry.id)).toContain('deficit')
    // el déficit reemplaza al aviso genérico de "gastos altos": no se repiten
    expect(advice.map((entry) => entry.id)).not.toContain('heavy')
  })

  it('avisa de gastos altos cuando aún hay espacio para las metas', () => {
    const state = makeState([{ amount: 2800 }], { '2025-01': monthWith() })
    const ids = suggestAdvice(state, computeMonth(state, '2025-01')).map((entry) => entry.id)
    expect(ids).toContain('heavy')
    expect(ids).not.toContain('deficit')
  })
})

describe('catálogo de iconos', () => {
  it('cada categoría tiene un icono por defecto que existe', () => {
    const slugs = new Set(ICONS.map((icon) => icon.slug))
    for (const slug of Object.values(DEFAULT_ICON_BY_CATEGORY)) {
      expect(slugs.has(slug)).toBe(true)
    }
  })

  it('usa el icono elegido y cae al de la categoría si falta', () => {
    expect(iconSlugFor({ icon: 'piggy', category: 'otros' })).toBe('piggy')
    expect(iconSlugFor({ category: 'transporte' })).toBe('bus')
    expect(iconSlugFor({ icon: 'inexistente', category: 'vivienda' })).toBe('house')
  })

  it('no hay slugs repetidos', () => {
    expect(new Set(ICONS.map((icon) => icon.slug)).size).toBe(ICONS.length)
  })
})
