import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, GOAL_PERSONAL_ID, GOAL_VACATION_ID } from './defaults'
import {
  buildGoalRows,
  computeMonth,
  effectiveAmount,
  isExpenseVisible,
  previewSplit,
  shiftMonth,
} from './finance'
import { apportion, formatMoney, parseNumber, round } from './money'
import { normalizeState } from './storage'
import type { AppState, Expense, Goal, MonthData, Settings } from './types'

const A = 'a'
const B = 'b'
const TODAY = new Date(2026, 9, 7)

const GOALS: Goal[] = [
  { id: GOAL_PERSONAL_ID, name: 'Ahorro personal', pct: 10, color: '#34d399', scope: 'personal' },
  { id: GOAL_VACATION_ID, name: 'Vacaciones', pct: 10, color: '#fbbf24', scope: 'joint' },
]

function makeState(
  expenses: Array<Partial<Expense>>,
  options: { settings?: Partial<Settings>; months?: Record<string, MonthData> } = {},
): AppState {
  return {
    version: 2,
    people: [
      { id: A, name: 'Ana', color: '#111111', salary: 3000 },
      { id: B, name: 'Luis', color: '#222222', salary: 2000 },
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
    months: options.months ?? {},
    settings: { ...DEFAULT_SETTINGS, goals: GOALS, ...options.settings },
  }
}

function monthWith(
  entries: MonthData['entries'] = {},
  savings: MonthData['savings'] = {},
  contributions: MonthData['contributions'] = {},
): MonthData {
  return { id: '2025-01', salaries: { [A]: 3000, [B]: 2000 }, entries, savings, contributions }
}

/* ------------------------------------------------------------------ */

describe('apportion (reparto proporcional exacto)', () => {
  it('reparte según el peso de cada sueldo', () => {
    const parts = apportion(2000, { [A]: 3000, [B]: 2000 }, 2, [A, B])
    expect(parts[A]).toBe(1200)
    expect(parts[B]).toBe(800)
  })

  it('la suma de las partes es exactamente el monto, incluso con divisiones feas', () => {
    const thirds = apportion(1000, { x: 1, y: 1, z: 1 }, 2, ['x', 'y', 'z'])
    expect(round(Object.values(thirds).reduce((acc, v) => acc + v, 0), 2)).toBe(1000)

    const sevenths = apportion(100, { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 }, 2, [
      'a', 'b', 'c', 'd', 'e', 'f', 'g',
    ])
    expect(round(Object.values(sevenths).reduce((acc, v) => acc + v, 0), 2)).toBe(100)
  })

  it('sin pesos utilizables reparte en partes iguales', () => {
    const parts = apportion(90, { [A]: 0, [B]: 0 }, 2, [A, B])
    expect(parts[A]).toBe(45)
    expect(parts[B]).toBe(45)
  })
})

describe('fórmula de equidad: % = Gasto / (sueldo1 + sueldo2 + …)', () => {
  const state = makeState([{ amount: 2000 }])
  const result = computeMonth(state, '2025-01')

  it('calcula el porcentaje de aporte', () => {
    expect(result.totalIncome).toBe(5000)
    expect(result.totalShared).toBe(2000)
    expect(result.pct).toBeCloseTo(0.4, 10)
  })

  it('multiplica el % por cada sueldo', () => {
    const [ana, luis] = result.people
    expect(ana.total).toBe(1200)
    expect(luis.total).toBe(800)
  })

  it('todos aportan el mismo % de su propio sueldo', () => {
    const [ana, luis] = result.people
    expect(ana.effectivePct).toBeCloseTo(0.4, 10)
    expect(luis.effectivePct).toBeCloseTo(0.4, 10)
    expect(result.equitable).toBe(true)
  })

  it('los aportes suman exactamente los gastos compartidos', () => {
    expect(result.totalContributions).toBe(result.totalShared)
  })

  it('funciona igual con tres personas (piso compartido)', () => {
    const shared = makeState([{ amount: 1800 }])
    shared.people.push({ id: 'c', name: 'Sofía', color: '#333', salary: 1000 })
    const three = computeMonth(shared, '2025-01')
    expect(three.totalIncome).toBe(6000)
    expect(three.pct).toBeCloseTo(0.3, 10)
    expect(three.people.map((entry) => entry.total)).toEqual([900, 600, 300])
    expect(three.equitable).toBe(true)
    expect(three.totalContributions).toBe(1800)
  })

  it('el % de cada uno sobre el ingreso combinado suma el % global', () => {
    const total = result.people.reduce((acc, person) => acc + person.shareOfIncome, 0)
    expect(total).toBeCloseTo(result.pct, 10)
  })
})

describe('modos de reparto', () => {
  it('partes iguales ignora el sueldo y rompe la equidad de porcentaje', () => {
    const state = makeState([{ amount: 1000, splitMode: 'equal' }])
    const result = computeMonth(state, '2025-01')
    expect(result.people[0].total).toBe(500)
    expect(result.people[1].total).toBe(500)
    expect(result.equitable).toBe(false)
  })

  it('montos fijos: el total del gasto es la suma de los montos declarados', () => {
    const state = makeState([
      { amount: 999, splitMode: 'custom', customShares: { [A]: 700, [B]: 300 } },
    ])
    const result = computeMonth(state, '2025-01')
    expect(result.totalShared).toBe(1000)
    expect(result.people[0].total).toBe(700)
    expect(result.people[1].total).toBe(300)
  })

  it('ignora los gastos desactivados en el mes', () => {
    const state = makeState([{ amount: 2000 }], {
      months: { '2025-01': monthWith({ e0: { amount: 2000, active: false, paid: false } }) },
    })
    const result = computeMonth(state, '2025-01')
    expect(result.totalShared).toBe(0)
    expect(result.pct).toBe(0)
  })
})

describe('gastos puntuales vs recurrentes', () => {
  it('un gasto puntual solo existe en su mes', () => {
    const expense = {
      id: 'x',
      name: 'x',
      category: 'otros',
      splitMode: 'proportional',
      kind: 'oneoff',
      month: '2025-03',
      amount: 100,
    } as Expense
    expect(isExpenseVisible(expense, '2025-03')).toBe(true)
    expect(isExpenseVisible(expense, '2025-04')).toBe(false)
  })

  it('un recurrente aparece en todos los meses', () => {
    const state = makeState([{ amount: 100 }])
    expect(computeMonth(state, '2025-03').totalShared).toBe(100)
    expect(computeMonth(state, '2030-11').totalShared).toBe(100)
  })
})

describe('metas de ahorro personalizables', () => {
  const state = makeState([{ amount: 2000 }])
  const result = computeMonth(state, '2025-01')

  it('calcula la meta de cada persona como % de su sueldo', () => {
    const [ana, luis] = result.people
    expect(ana.goals.map((goal) => goal.target)).toEqual([300, 300])
    expect(luis.goals.map((goal) => goal.target)).toEqual([200, 200])
    expect(ana.goalsTarget).toBe(600)
    expect(luis.goalsTarget).toBe(400)
  })

  it('la previsión usa la meta mientras no se registre, pero lo apartado es cero', () => {
    expect(result.hasRecordedSavings).toBe(false)
    expect(result.people[0].goals[0].actual).toBe(300)
    expect(result.people[0].goals[0].deposited).toBe(0)
    expect(result.people[0].goals[0].recorded).toBe(false)
  })

  it('respeta los montos reales registrados', () => {
    const withSavings = computeMonth(
      makeState([{ amount: 2000 }], {
        months: { '2025-01': monthWith({}, { [A]: { [GOAL_PERSONAL_ID]: 250 } }) },
      }),
      '2025-01',
    )
    expect(withSavings.hasRecordedSavings).toBe(true)
    expect(withSavings.people[0].goals[0].actual).toBe(250)
    expect(withSavings.people[0].goals[0].deposited).toBe(250)
    expect(withSavings.people[0].goals[0].target).toBe(300)
    // la meta sin registrar sigue mostrando su meta en la previsión, pero no
    // cuenta como dinero apartado
    expect(withSavings.people[1].goals[1].actual).toBe(200)
    expect(withSavings.people[1].goals[1].deposited).toBe(0)
  })

  it('acepta metas propias como aporte a los padres o caridad', () => {
    const custom = makeState([{ amount: 2000 }], {
      settings: {
        goals: [
          ...GOALS,
          { id: 'padres', name: 'Aporte a los padres', pct: 5, color: '#60a5fa', scope: 'joint' },
          { id: 'iglesia', name: 'Caridad', pct: 3, color: '#f472b6', scope: 'joint' },
        ],
      },
    })
    const withGoals = computeMonth(custom, '2025-01')
    const ana = withGoals.people[0]
    expect(ana.goals).toHaveLength(4)
    expect(ana.goals[2].target).toBe(150)
    expect(ana.goals[3].target).toBe(90)
    expect(ana.goalsTarget).toBe(840)
    expect(ana.available).toBe(3000 - 1200 - 840)
    expect(withGoals.savings.byGoal.map((entry) => entry.target)).toEqual([500, 500, 250, 150])
  })

  it('el total de metas agrega a todas las personas', () => {
    expect(result.savings.totalGoal).toBe(1000)
    expect(result.savings.totalActual).toBe(1000)
    // sin nada registrado, «apartado real» es cero aunque la previsión sume 1000
    expect(result.savings.totalDeposited).toBe(0)
    expect(result.savings.byGoal.every((entry) => entry.deposited === 0)).toBe(true)
  })
})

describe('fondo común', () => {
  const state = makeState([{ amount: 1000 }])

  it('sin aportes confirmados todo queda pendiente de transferir', () => {
    const result = computeMonth(state, '2025-01')
    expect(result.pot.target).toBe(1000)
    expect(result.pot.contributed).toBe(0)
    expect(result.pot.pending).toBe(1000)
    expect(result.people.every((entry) => !entry.contribution.done)).toBe(true)
  })

  it('suma lo transferido y lo ya pagado', () => {
    const result = computeMonth(
      makeState([{ amount: 1000 }], {
        months: {
          '2025-01': monthWith(
            { e0: { amount: 1000, active: true, paid: true } },
            {},
            {
              [A]: { amount: 600, done: true },
              [B]: { amount: 400, done: false },
            },
          ),
        },
      }),
      '2025-01',
    )
    expect(result.pot.contributed).toBe(600)
    expect(result.pot.pending).toBe(400)
    expect(result.pot.spent).toBe(1000)
    expect(result.pot.balance).toBe(-400)
    expect(result.pot.paidCount).toBe(1)
    expect(result.pot.pendingCount).toBe(0)
    expect(result.people[0].contribution).toEqual({ expected: 600, actual: 600, done: true })
  })

  it('no genera deudas entre personas: no hay transferencias ni saldos', () => {
    const result = computeMonth(state, '2025-01')
    expect('transfers' in result).toBe(false)
    expect('balance' in (result.people[0] as object)).toBe(false)
  })

  it('avisa cuando se pagó más de lo que hay en el fondo', () => {
    const result = computeMonth(
      makeState([{ amount: 1000 }], {
        months: { '2025-01': monthWith({ e0: { amount: 1000, active: true, paid: true } }) },
      }),
      '2025-01',
    )
    expect(result.warnings.map((warning) => warning.id)).toContain('pot-negative')
  })

  it('avisa cuando el fondo no alcanza para las facturas pendientes', () => {
    const result = computeMonth(
      makeState([{ amount: 1000 }, { amount: 1000 }], {
        months: {
          '2025-01': monthWith(
            {
              e0: { amount: 1000, active: true, paid: true },
              e1: { amount: 1000, active: true, paid: false },
            },
            {},
            { [A]: { amount: 600, done: true }, [B]: { amount: 400, done: true } },
          ),
        },
      }),
      '2025-01',
    )
    expect(result.pot.balance).toBe(0)
    expect(result.pot.pendingBills).toBe(1000)
    expect(result.pot.coversPending).toBe(false)
    expect(result.warnings.map((warning) => warning.id)).toContain('pot-shortfall')
  })
})

describe('alertas', () => {
  it('avisa cuando las metas no caben en el presupuesto', () => {
    const state = {
      ...makeState([{ amount: 900 }]),
      people: [
        { id: A, name: 'Ana', color: '#111', salary: 1000 },
        { id: B, name: 'Luis', color: '#222', salary: 0 },
      ],
    }
    const ids = computeMonth(state, '2025-01').warnings.map((warning) => warning.id)
    expect(ids).toContain('savings-no-room')
    expect(ids).toContain('deficit-a')
  })

  it('avisa cuando faltan los sueldos', () => {
    const state = {
      ...makeState([{ amount: 900 }]),
      people: [
        { id: A, name: 'Ana', color: '#111', salary: 0 },
        { id: B, name: 'Luis', color: '#222', salary: 0 },
      ],
    }
    const result = computeMonth(state, '2025-01')
    expect(result.warnings.map((warning) => warning.id)).toContain('no-income')
    expect(result.pct).toBe(0)
  })

  it('avisa si las suscripciones pesan demasiado', () => {
    const state = makeState([{ amount: 400, subscription: true, category: 'suscripciones' }])
    expect(computeMonth(state, '2025-01').warnings.map((warning) => warning.id)).toContain(
      'subscriptions-heavy',
    )
  })

  it('avisa de gastos vencidos y por vencer en el mes en curso', () => {
    const state = makeState([
      { amount: 100, dueDay: 1, name: 'Arriendo' },
      { amount: 50, dueDay: 10, name: 'Luz' },
    ])
    const ids = computeMonth(state, '2025-01', new Date(2025, 0, 8)).warnings.map((w) => w.id)
    expect(ids).toContain('overdue')
    expect(ids).toContain('due-soon')
  })
})

describe('monto efectivo de un gasto', () => {
  it('en modo montos fijos el total sale de los montos por persona', () => {
    const expense = {
      id: 'x',
      name: 'x',
      category: 'otros',
      kind: 'recurring',
      amount: 999,
      splitMode: 'custom',
      customShares: { [A]: 10, [B]: 20 },
    } as Expense
    expect(effectiveAmount(expense, { amount: 999, active: true, paid: false }, 2)).toBe(30)
    expect(effectiveAmount(expense, { amount: 999, active: false, paid: false }, 2)).toBe(0)
  })
})

describe('formato y análisis de números agnóstico a la moneda', () => {
  it('formatea con separadores y decimales configurados', () => {
    const settings = { ...DEFAULT_SETTINGS, locale: 'en-US', currencySymbol: '$', decimals: 2 }
    expect(formatMoney(1234.5, settings)).toBe('$1,234.50')
  })

  it('formatea con código ISO cuando se define', () => {
    const settings = { ...DEFAULT_SETTINGS, locale: 'en-US', currencyCode: 'USD', decimals: 2 }
    expect(formatMoney(1234.5, settings)).toBe('$1,234.50')
  })

  it('funciona sin símbolo ni código (solo unidades)', () => {
    const settings = { ...DEFAULT_SETTINGS, locale: 'en-US', currencyCode: '', currencySymbol: '' }
    expect(formatMoney(1234.5, settings)).toBe('1,234.50')
  })

  it('interpreta números escritos con coma o punto decimal', () => {
    expect(parseNumber('1.234,56', 2)).toBe(1234.56)
    expect(parseNumber('1,234.56', 2)).toBe(1234.56)
    expect(parseNumber('1200', 2)).toBe(1200)
    expect(parseNumber('$ 1.200', 0)).toBe(1200)
    expect(parseNumber('', 2)).toBe(0)
  })
})

describe('utilidades de mes', () => {
  it('cambia de mes correctamente en los bordes de año', () => {
    expect(shiftMonth('2025-01', -1)).toBe('2024-12')
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
  })
})

describe('normalizeState', () => {
  it('convierte basura en un estado válido', () => {
    const state = normalizeState({ people: 'nope', expenses: 42, months: { malo: {} } })
    expect(state.people.length).toBeGreaterThanOrEqual(2)
    expect(state.expenses).toEqual([])
    expect(Object.keys(state.months)).toEqual([])
    expect(state.settings.decimals).toBe(2)
    expect(state.settings.goals).toHaveLength(2)
  })

  it('migra los dos porcentajes fijos antiguos a metas', () => {
    const state = normalizeState({
      settings: { personalSavingsPct: 12, vacationSavingsPct: 8 },
    })
    expect(state.settings.goals.map((goal) => goal.pct)).toEqual([12, 8])
    expect(state.settings.goals[0].name).toBe('Ahorro personal')
  })

  it('migra el ahorro antiguo (personal/vacaciones) al formato por meta', () => {
    const state = normalizeState({
      people: [{ id: 'z', name: 'Zoe', color: '#fff', salary: 100 }],
      months: {
        '2025-05': { savings: { z: { personal: 30, vacation: 20 } } },
      },
    })
    expect(state.months['2025-05'].savings.z[GOAL_PERSONAL_ID]).toBe(30)
    expect(state.months['2025-05'].savings.z[GOAL_VACATION_ID]).toBe(20)
  })

  it('descarta el "paidBy" antiguo y conserva el estado de pago', () => {
    const state = normalizeState({
      people: [{ id: 'z', name: 'Zoe', color: '#fff', salary: 100 }],
      expenses: [{ id: 'e', name: 'Luz', amount: 50 }],
      months: { '2025-05': { entries: { e: { amount: 50, paid: true, paidBy: 'z' } } } },
    })
    expect(state.months['2025-05'].entries.e.paid).toBe(true)
    expect('paidBy' in state.months['2025-05'].entries.e).toBe(false)
  })

  it('conserva las metas personalizadas y sus porcentajes', () => {
    const state = normalizeState({
      settings: {
        goals: [
          { id: 'g1', name: 'Padres', pct: 7, color: '#fff', scope: 'joint' },
          { id: 'g2', name: 'Iglesia', pct: 3, color: '#000', scope: 'joint' },
        ],
      },
    })
    expect(state.settings.goals).toHaveLength(2)
    expect(state.settings.goals[0].name).toBe('Padres')
  })
})

describe('vista previa de un gasto (formulario)', () => {
  it('reparte proporcionalmente y calcula el % de cada sueldo', () => {
    const state = makeState([])
    const preview = previewSplit(state, {
      id: 'x',
      name: 'Cena',
      category: 'alimentacion',
      kind: 'recurring',
      amount: 1000,
      splitMode: 'proportional',
    } as Expense)
    expect(preview.amount).toBe(1000)
    expect(preview.parts[A]).toBe(600)
    expect(preview.parts[B]).toBe(400)
    expect(preview.effectivePct[A]).toBeCloseTo(0.2, 10)
    expect(preview.equitable).toBe(true)
    expect(preview.exceedsSalary).toBe(false)
  })

  it('avisa cuando la parte supera el sueldo de alguien', () => {
    const state = makeState([])
    const preview = previewSplit(state, {
      id: 'x',
      name: 'Coche',
      category: 'transporte',
      kind: 'oneoff',
      amount: 20000,
      splitMode: 'proportional',
    } as Expense)
    expect(preview.parts[A]).toBe(12000)
    expect(preview.salaries[A]).toBe(3000)
    expect(preview.exceedsSalary).toBe(true)
  })

  it('refleja el modo de reparto elegido', () => {
    const state = makeState([])
    const equal = previewSplit(state, {
      id: 'x',
      name: 'Taxi',
      category: 'transporte',
      kind: 'recurring',
      amount: 1000,
      splitMode: 'equal',
    } as Expense)
    expect(equal.parts[A]).toBe(500)
    expect(equal.equitable).toBe(false)

    const custom = previewSplit(state, {
      id: 'y',
      name: 'Luz',
      category: 'servicios',
      kind: 'recurring',
      amount: 999,
      splitMode: 'custom',
      customShares: { [A]: 700, [B]: 300 },
    } as Expense)
    expect(custom.amount).toBe(1000)
    expect(custom.parts[A]).toBe(700)
  })

  it('usa los sueldos del mes cuando se indica', () => {
    const state = makeState([], {
      months: {
        '2025-01': {
          id: '2025-01',
          salaries: { [A]: 1000, [B]: 1000 },
          entries: {},
          contributions: {},
          savings: {},
        },
      },
    })
    const preview = previewSplit(
      state,
      {
        id: 'x',
        name: 'Cena',
        category: 'alimentacion',
        kind: 'recurring',
        amount: 1000,
        splitMode: 'proportional',
      } as Expense,
      '2025-01',
    )
    expect(preview.parts[A]).toBe(500)
    expect(preview.parts[B]).toBe(500)
  })
})

describe('seguimiento de metas (meta, acumulado y proyectado)', () => {
  const state = makeState([], {
    months: {
      '2026-09': {
        id: '2026-09',
        salaries: { [A]: 3000, [B]: 2000 },
        entries: {},
        contributions: {},
        savings: {
          [A]: { [GOAL_PERSONAL_ID]: 280, [GOAL_VACATION_ID]: 260 },
          [B]: { [GOAL_PERSONAL_ID]: 190, [GOAL_VACATION_ID]: 170 },
        },
      },
      '2026-10': {
        id: '2026-10',
        salaries: { [A]: 3000, [B]: 2000 },
        entries: {},
        contributions: {},
        savings: {
          [A]: { [GOAL_PERSONAL_ID]: 300, [GOAL_VACATION_ID]: 250 },
          [B]: { [GOAL_PERSONAL_ID]: 200, [GOAL_VACATION_ID]: 150 },
        },
      },
    },
  })
  const rows = buildGoalRows(state, '2026-10', TODAY)

  it('una meta personal genera una fila por persona', () => {
    const personales = rows.filter((row) => row.goal.id === GOAL_PERSONAL_ID)
    expect(personales).toHaveLength(2)
    expect(personales.map((row) => row.label)).toEqual([
      'Ahorro personal · Ana',
      'Ahorro personal · Luis',
    ])
  })

  it('una meta conjunta genera una sola fila con la suma del grupo', () => {
    const conjuntas = rows.filter((row) => row.goal.id === GOAL_VACATION_ID)
    expect(conjuntas).toHaveLength(1)
    expect(conjuntas[0].label).toBe('Vacaciones')
    // 10 % de 5.000
    expect(conjuntas[0].monthly).toBe(500)
    // 260 + 170 + 250 + 150
    expect(conjuntas[0].accumulated).toBe(830)
  })

  it('la meta es lo convenido al mes por doce', () => {
    const ana = rows.find((row) => row.label.endsWith('Ana') && row.goal.id === GOAL_PERSONAL_ID)
    expect(ana?.monthly).toBe(300)
    expect(ana?.target).toBe(3600)
  })

  it('el acumulado suma los meses registrados', () => {
    const ana = rows.find((row) => row.label.endsWith('Ana') && row.goal.id === GOAL_PERSONAL_ID)
    expect(ana?.accumulated).toBe(580)
    expect(ana?.monthsRecorded).toBe(2)
  })

  it('el proyectado añade lo que queda por guardar hasta diciembre', () => {
    const ana = rows.find((row) => row.label.endsWith('Ana') && row.goal.id === GOAL_PERSONAL_ID)
    // octubre → quedan noviembre y diciembre
    expect(ana?.monthsLeft).toBe(2)
    expect(ana?.projected).toBe(580 + 300 * 2)
  })

  it('el progreso es el acumulado sobre la meta', () => {
    const ana = rows.find((row) => row.label.endsWith('Ana') && row.goal.id === GOAL_PERSONAL_ID)
    expect(ana?.progress).toBeCloseTo(580 / 3600, 6)
  })

  it('en diciembre no queda nada por proyectar', () => {
    const diciembre = buildGoalRows(state, '2026-12', TODAY)
    const ana = diciembre.find(
      (row) => row.label.endsWith('Ana') && row.goal.id === GOAL_PERSONAL_ID,
    )
    expect(ana?.monthsLeft).toBe(0)
    expect(ana?.projected).toBe(ana?.accumulated)
  })

  it('sin meses guardados el acumulado es cero y todo queda proyectado', () => {
    const vacio = buildGoalRows(makeState([]), '2026-10', TODAY)
    const ana = vacio.find((row) => row.label.endsWith('Ana'))
    expect(ana?.accumulated).toBe(0)
    expect(ana?.projected).toBe(600)
  })
})
