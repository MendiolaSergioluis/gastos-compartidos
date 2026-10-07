import { computeMonth, trackedMonths, monthLabel } from './finance'
import { formatPct } from './money'
import type { AppState } from './types'

/** Escapa un campo para CSV (comillas dobles y separador). */
function cell(value: string | number): string {
  const text = String(value)
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Libro mayor en CSV: una fila por gasto y mes, con el aporte de cada persona.
 * Es el formato que espera una hoja de cálculo (Splid y Settle Up también lo
 * ofrecen; el JSON sirve para respaldos, no para analizar).
 */
export function buildCsv(state: AppState, today: Date = new Date()): string {
  const { settings, people } = state
  const months = trackedMonths(state, today).filter((id) => state.months[id])
  const header = [
    'mes',
    'gasto',
    'categoria',
    'tipo',
    'reparto',
    'monto',
    ...people.map((person) => `aporte_${person.name}`),
    ...settings.goals.map((goal) => `meta_${goal.name}`),
    'pagado',
    'sueldo_total',
    'porcentaje_aportes',
  ]

  const rows: string[] = [header.map(cell).join(';')]

  for (const monthId of months) {
    const result = computeMonth(state, monthId, today)
    const label = monthLabel(monthId, settings)
    const savings = state.months[monthId]?.savings ?? {}

    for (const allocation of result.allocations) {
      if (allocation.amount <= 0) continue
      rows.push(
        [
          label,
          allocation.expense.name,
          allocation.expense.category,
          allocation.expense.kind === 'oneoff' ? 'puntual' : 'recurrente',
          allocation.expense.splitMode,
          allocation.amount,
          ...people.map((person) => allocation.parts[person.id] ?? 0),
          ...settings.goals.map((goal) => savings[people[0]?.id ?? '']?.[goal.id] ?? ''),
          allocation.entry.paid ? 'si' : 'no',
          result.totalIncome,
          formatPct(result.pct, settings),
        ].map(cell).join(';'),
      )
    }
  }

  return `${rows.join('\n')}\n`
}

export function downloadCsv(content: string, filename = 'gastos-compartidos.csv'): void {
  // el BOM hace que Excel abra el archivo en UTF-8 sin romper los acentos
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
