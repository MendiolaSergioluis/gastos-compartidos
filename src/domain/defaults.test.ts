// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_SEED, createDemoState, createEmptyState } from './defaults'
import { buildCsv } from './csv'
import { buildHistory, computeMonth, trackedMonths } from './finance'
import { LEGACY_STORAGE_KEY, STORAGE_KEY, loadState } from './storage'

const TODAY = new Date(2026, 9, 6) // 6 de octubre de 2026

beforeEach(() => {
  localStorage.clear()
})

describe('datos de ejemplo', () => {
  const state = createDemoState(TODAY)
  const months = trackedMonths(state, TODAY)

  it('precarga seis meses consecutivos, no solo el mes en curso', () => {
    expect(months).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
    expect(Object.keys(state.months).sort()).toEqual(months)
  })

  it('lleva la versión del generador para poder refrescarse solo', () => {
    expect(state.demoSeed).toBe(DEMO_SEED)
    expect(state.demo).toBe(true)
  })

  it('cada mes cuadra al céntimo', () => {
    for (const id of months) {
      const result = computeMonth(state, id, TODAY)
      expect(result.totalContributions, `mes ${id}`).toBe(result.totalShared)
      expect(result.totalIncome, `mes ${id}`).toBe(5000)
    }
  })

  it('la evolución tiene variación real y no una línea plana', () => {
    const pcts = months.map((id) => computeMonth(state, id, TODAY).pct)
    const spread = Math.max(...pcts) - Math.min(...pcts)
    expect(spread).toBeGreaterThan(0.03)
    expect(new Set(pcts.map((pct) => pct.toFixed(4))).size).toBeGreaterThanOrEqual(5)
  })

  it('los meses pasados quedan cerrados: facturas pagadas y aportes hechos', () => {
    for (const id of months.slice(0, -1)) {
      const result = computeMonth(state, id, TODAY)
      expect(result.pot.pendingCount, `mes ${id}`).toBe(0)
      expect(result.pot.paidCount, `mes ${id}`).toBeGreaterThan(0)
      expect(result.pot.pending, `mes ${id}`).toBe(0)
      expect(result.people.every((entry) => entry.contribution.done), `mes ${id}`).toBe(true)
    }
  })

  it('el mes en curso tiene facturas por pagar y aportes sin transferir', () => {
    const current = computeMonth(state, months.at(-1) as string, TODAY)
    expect(current.pot.paidCount).toBeGreaterThan(0)
    expect(current.pot.pendingCount).toBeGreaterThan(0)
    expect(current.pot.pending).toBeGreaterThan(0)
  })

  it('los gastos puntuales viven solo en su mes', () => {
    const extras = state.expenses.filter((expense) => expense.kind === 'oneoff')
    expect(extras.length).toBe(3)
    for (const extra of extras) {
      const own = computeMonth(state, extra.month as string, TODAY)
      expect(own.allocations.some((allocation) => allocation.expense.id === extra.id)).toBe(true)
      const other = months.find((id) => id !== extra.month) as string
      const elsewhere = computeMonth(state, other, TODAY)
      expect(elsewhere.allocations.some((allocation) => allocation.expense.id === extra.id)).toBe(false)
    }
  })

  it('las metas del historial están registradas, no solo como meta', () => {
    for (const id of months) {
      expect(computeMonth(state, id, TODAY).hasRecordedSavings, `mes ${id}`).toBe(true)
    }
    const accumulated = buildHistory(state, months, TODAY).reduce(
      (acc, row) => acc + row.savings.total,
      0,
    )
    expect(accumulated).toBeGreaterThan(0)
  })

  it('el mes en curso es el único con el gasto de regalo', () => {
    const gift = state.expenses.find((expense) => expense.name === 'Regalo de cumpleaños')
    expect(gift?.month).toBe('2026-10')
  })
})

describe('estado vacío', () => {
  it('no trae gastos ni meses guardados, pero sí dos personas y las metas por defecto', () => {
    const state = createEmptyState()
    expect(state.expenses).toEqual([])
    expect(Object.keys(state.months)).toEqual([])
    expect(state.people).toHaveLength(2)
    expect(state.settings.goals).toHaveLength(2)
    expect(state.demo).toBe(false)
  })
})

describe('carga del estado guardado', () => {
  it('refresca los datos de ejemplo de una versión anterior', () => {
    localStorage.clear()
    const stale = { ...createDemoState(TODAY), demoSeed: 1 }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stale))
    const loaded = loadState()
    expect(loaded?.demoSeed).toBe(DEMO_SEED)
    expect(Object.keys(loaded?.months ?? {})).toHaveLength(6)
  })

  it('no toca los datos propios del usuario', () => {
    localStorage.clear()
    const mine = createEmptyState()
    mine.expenses = [
      {
        id: 'x',
        name: 'Mi arriendo',
        category: 'vivienda',
        kind: 'recurring',
        amount: 500,
        splitMode: 'proportional',
      },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mine))
    const loaded = loadState()
    expect(loaded?.expenses).toHaveLength(1)
    expect(loaded?.demo).toBe(false)
  })

  it('migra los datos guardados con la clave anterior sin perderlos', () => {
    localStorage.clear()
    const legacy = createEmptyState()
    legacy.expenses = [
      {
        id: 'viejo',
        name: 'Gasto antiguo',
        category: 'otros',
        kind: 'recurring',
        amount: 99,
        splitMode: 'proportional',
      },
    ]
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy))
    const loaded = loadState()
    expect(loaded?.expenses[0].name).toBe('Gasto antiguo')
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy()
  })
})

describe('exportación CSV', () => {
  it('saca una fila por gasto y mes, con el aporte de cada persona', () => {
    const csv = buildCsv(createDemoState(TODAY), TODAY)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toContain('mes;gasto;categoria')
    expect(lines[0]).toContain('aporte_Ana')
    expect(lines[0]).toContain('meta_Ahorro personal')
    // seis meses con siete recurrentes y tres puntuales repartidos
    expect(lines.length).toBe(1 + 6 * 7 + 3)
    expect(lines[1]).toContain('Arriendo')
    expect(csv.endsWith('\n')).toBe(true)
  })

  it('escapa los campos con punto y coma o comillas', () => {
    const state = createEmptyState()
    state.expenses = [
      {
        id: 'x',
        name: 'Cena; con "amigos"',
        category: 'otros',
        kind: 'recurring',
        amount: 100,
        splitMode: 'proportional',
      },
    ]
    // la exportación recorre los meses guardados: hace falta uno
    state.months = {
      '2026-10': { id: '2026-10', salaries: {}, entries: {}, contributions: {}, savings: {} },
    }
    const csv = buildCsv(state, TODAY)
    expect(csv).toContain('"Cena; con ""amigos"""')
  })

  it('no exporta meses sin datos guardados', () => {
    const state = createDemoState(TODAY)
    state.months = {}
    const csv = buildCsv(state, TODAY)
    expect(csv.trim().split('\n')).toHaveLength(1)
  })
})
