import { formatMoney } from './money'
import type { MonthResult } from './finance'
import type { AppState } from './types'

export type AdviceTone = 'action' | 'warn' | 'good'

export interface Advice {
  id: string
  tone: AdviceTone
  title: string
  detail: string
  /** pestaña donde se resuelve */
  tab: 'resumen' | 'mes' | 'gastos' | 'metas' | 'historial' | 'ajustes'
}

/**
 * Convierte el estado del mes en una lista corta de cosas que hacer.
 * La app mostraba números correctos pero ninguna indicación de qué hacer con ellos.
 */
export function suggestAdvice(state: AppState, result: MonthResult): Advice[] {
  const advice: Advice[] = []
  const { settings } = state
  const money = (value: number) => formatMoney(value, settings)

  const activeExpenses = state.expenses.filter((expense) => !expense.archived)
  const missingSalary = result.people.filter((entry) => entry.salary <= 0)
  const belowMinimum = result.people.filter(
    (entry) => entry.salary > 0 && entry.total + entry.goalsTarget > entry.salary,
  )
  const goalsPct = result.savings.byGoal.reduce((acc, entry) => acc + entry.goal.pct, 0)

  if (activeExpenses.length === 0) {
    advice.push({
      id: 'no-expenses',
      tone: 'action',
      title: 'Agrega los gastos compartidos',
      detail: 'Arriendo, servicios, alimentación y suscripciones: se repetirán cada mes automáticamente.',
      tab: 'gastos',
    })
  }

  if (missingSalary.length > 0) {
    advice.push({
      id: 'missing-salary',
      tone: 'action',
      title: `Falta el sueldo de ${missingSalary.map((entry) => entry.person.name).join(' y ')}`,
      detail: 'Sin todos los sueldos no se puede calcular el porcentaje de aporte equitativo.',
      tab: 'mes',
    })
  }

  if (!state.months[result.monthId] && activeExpenses.length > 0) {
    advice.push({
      id: 'unsaved-month',
      tone: 'action',
      title: 'Este mes todavía no está guardado',
      detail: 'Se está calculando con los sueldos base y los montos del catálogo. Ajusta y guarda el mes.',
      tab: 'mes',
    })
  }

  const missingContributions = result.people.filter((entry) => !entry.contribution.done)
  if (result.pot.pending > 0 && missingContributions.length > 0) {
    advice.push({
      id: 'contributions-pending',
      tone: 'action',
      title: `Falta transferir ${money(result.pot.pending)} al fondo común`,
      detail: `${missingContributions.map((entry) => entry.person.name).join(' y ')} todavía no confirman su aporte de este mes.`,
      tab: 'mes',
    })
  }

  if (result.pot.spent > result.pot.contributed + 1 / 10 ** settings.decimals) {
    advice.push({
      id: 'pot-negative',
      tone: 'warn',
      title: 'Se pagaron facturas con dinero que no estaba en el fondo',
      detail: `Hay ${money(result.pot.contributed)} transferidos y ${money(result.pot.spent)} pagados. Completa los aportes para cuadrarlo.`,
      tab: 'mes',
    })
  } else if (!result.pot.coversPending && result.pot.pendingBills > 0) {
    advice.push({
      id: 'pot-shortfall',
      tone: 'warn',
      title: 'El fondo no alcanza para las facturas que faltan',
      detail: `Quedan ${money(result.pot.pendingBills)} por pagar y el fondo tiene ${money(Math.max(0, result.pot.balance))}.`,
      tab: 'mes',
    })
  }

  if (result.pot.pendingCount > 0 && result.pot.paidCount === 0) {
    advice.push({
      id: 'nothing-paid',
      tone: 'action',
      title: 'Ninguna factura marcada como pagada',
      detail: `Marca las ${result.pot.pendingCount} facturas del mes a medida que salen del fondo común.`,
      tab: 'mes',
    })
  } else if (result.pot.pendingCount > 0) {
    advice.push({
      id: 'pending-left',
      tone: 'action',
      title: `Quedan ${result.pot.pendingCount} factura(s) por pagar`,
      detail: `Ya se pagaron ${result.pot.paidCount} desde el fondo común.`,
      tab: 'mes',
    })
  }

  if (!result.hasRecordedSavings && result.totalIncome > 0 && result.savings.byGoal.length > 0) {
    advice.push({
      id: 'no-savings',
      tone: 'action',
      title: 'Registra las metas del mes',
      detail: `Se están mostrando las metas calculadas (${money(result.savings.totalGoal)}). Anota lo que efectivamente apartaron.`,
      tab: 'metas',
    })
  }

  if (belowMinimum.length > 0) {
    advice.push({
      id: 'deficit',
      tone: 'warn',
      title: `A ${belowMinimum.map((entry) => entry.person.name).join(' y ')} no le alcanza el sueldo`,
      detail: 'El aporte compartido más las metas superan el sueldo del mes. Ajusta los gastos o las metas.',
      tab: 'ajustes',
    })
  } else if (result.totalIncome > 0 && result.pct * 100 + goalsPct > 100) {
    advice.push({
      id: 'no-room',
      tone: 'warn',
      title: 'Las metas no caben en el presupuesto',
      detail: `Gastos compartidos (${Math.round(result.pct * 100)} %) + metas (${goalsPct} %) supera el 100 % del ingreso.`,
      tab: 'ajustes',
    })
  } else if (result.totalIncome > 0 && result.pct * 100 > settings.expenseWarnPct) {
    advice.push({
      id: 'heavy',
      tone: 'warn',
      title: `Los gastos compartidos son el ${Math.round(result.pct * 100)} % del ingreso`,
      detail: `Por encima del ${settings.expenseWarnPct} % que fijaste como cómodo. Revisa suscripciones o gastos grandes.`,
      tab: 'gastos',
    })
  }

  if (result.totalIncome > 0 && !result.equitable) {
    advice.push({
      id: 'not-equitable',
      tone: 'warn',
      title: 'Hay gastos que rompen el reparto equitativo',
      detail: 'Algún gasto usa partes iguales o montos fijos, así que el % efectivo no es igual para todos.',
      tab: 'resumen',
    })
  }

  if (advice.length === 0) {
    advice.push({
      id: 'all-good',
      tone: 'good',
      title: 'Todo en orden este mes',
      detail: `Cada uno aporta el ${Math.round(result.pct * 100)} % de su sueldo, las facturas están pagadas y las metas cubiertas.`,
      tab: 'resumen',
    })
  }

  // lo urgente primero, y como máximo 3 para que sea una lista de acción real
  const order: Record<AdviceTone, number> = { warn: 0, action: 1, good: 2 }
  return advice.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 3)
}
