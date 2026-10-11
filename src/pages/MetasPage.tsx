import { type CSSProperties, type Dispatch } from 'react'
import {
  Badge,
  Card,
  EmptyState,
  ExpenseIcon,
  Progress,
  SectionTitle,
  Stat,
} from '../components/ui'
import {
  buildGoalRows,
  computeMonth,
  monthLabel,
  trackedMonths,
  type MonthResult,
} from '../domain/finance'
import { formatMoney, formatPct } from '../domain/money'
import type { Action } from '../state/reducer'
import type { AppState, Goal } from '../domain/types'

interface Props {
  state: AppState
  dispatch: Dispatch<Action>
  monthId: string
  result: MonthResult
}

export function MetasPage({ state, monthId, result }: Props) {
  const { settings } = state
  const money = (value: number) => formatMoney(value, settings)
  const goals = settings.goals

  const rows = buildGoalRows(state, monthId)
  const accumulatedTotal = rows.reduce((acc, row) => acc + row.accumulated, 0)
  const monthsRecorded = rows.reduce((acc, row) => Math.max(acc, row.monthsRecorded), 0)
  const monthsLeft = rows[0]?.monthsLeft ?? 0

  const monthsWithData = trackedMonths(state).filter((id) => state.months[id])
  const monthRows = monthsWithData.map((id) => ({
    id,
    label: monthLabel(id, settings),
    result: computeMonth(state, id),
  }))

  const personales = goals.filter((goal) => goal.scope === 'personal')
  const conjuntas = goals.filter((goal) => goal.scope === 'joint')

  /** Una celda por meta y mes: el monto apartado, o null si ese mes no se registró. */
  type Celda = { goal: Goal; value: number | null }

  /**
   * Cuadros de «Acumulado por mes»: uno por persona con sus metas personales y
   * otro con las conjuntas. Antes había una sola columna «Ahorro personal» con
   * la suma de todos, y no se sabía a quién correspondían los montos.
   */
  const cuadros: {
    id: string
    title: string
    color?: string | undefined
    metas: Goal[]
    /** aportado entre todas las personas (solo en el cuadro conjunto) */
    grupo?: boolean
    filas: { id: string; label: string; celdas: Celda[]; total: number; registrado: boolean }[]
    acumulado: number
  }[] = [
    ...state.people
      .filter(() => personales.length > 0)
      .map((person) => ({
        id: person.id,
        title: person.name,
        color: person.color,
        metas: personales,
        filas: monthRows.map((row) => {
          const entry = row.result.people.find((item) => item.person.id === person.id)
          const celdas: Celda[] = personales.map((goal) => {
            const progress = entry?.goals.find((item) => item.goal.id === goal.id)
            return { goal, value: progress?.recorded ? progress.deposited : null }
          })
          return {
            id: row.id,
            label: row.label,
            celdas,
            total: celdas.reduce((acc, celda) => acc + (celda.value ?? 0), 0),
            registrado: celdas.some((celda) => celda.value !== null),
          }
        }),
        acumulado: rows
          .filter((row) => row.person?.id === person.id && row.goal.scope === 'personal')
          .reduce((acc, row) => acc + row.accumulated, 0),
      })),
    ...(conjuntas.length > 0
      ? [
          {
            id: 'conjuntas',
            title: conjuntas.length === 1 ? (conjuntas[0]?.name ?? 'Conjuntas') : 'Metas conjuntas',
            grupo: true,
            metas: conjuntas,
            filas: monthRows.map((row) => {
              const celdas: Celda[] = conjuntas.map((goal) => {
                const total = row.result.savings.byGoal.find((item) => item.goal.id === goal.id)
                return { goal, value: total?.recorded ? total.deposited : null }
              })
              return {
                id: row.id,
                label: row.label,
                celdas,
                total: celdas.reduce((acc, celda) => acc + (celda.value ?? 0), 0),
                registrado: celdas.some((celda) => celda.value !== null),
              }
            }),
            acumulado: rows
              .filter((row) => row.goal.scope === 'joint')
              .reduce((acc, row) => acc + row.accumulated, 0),
          },
        ]
      : []),
  ]

  const resumenCuadro = (cuadro: (typeof cuadros)[number]): string => {
    const meses = cuadro.filas.filter((fila) => fila.registrado).length
    return `${money(cuadro.acumulado)} en el año · ${
      meses === 0 ? 'sin registrar todavía' : `${meses} mes(es) registrados`
    }`
  }

  if (goals.length === 0) {
    return (
      <div className="stack stack--reveal">
        <Card title="Metas">
          <EmptyState
            icon="🎯"
            title="Todavía no hay metas"
            detail="Crea metas con un porcentaje del sueldo: ahorro personal, vacaciones, aporte a los padres, caridad…"
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="stack stack--reveal">
      <div className="grid grid--3">
        <Stat
          label="Metas del mes"
          value={money(result.savings.totalGoal)}
          hint={`${goals.reduce((acc, goal) => acc + goal.pct, 0)} % del ingreso`}
          tone="accent"
        />
        <Stat
          label="Apartado real del mes"
          value={money(result.savings.totalDeposited)}
          hint={result.hasRecordedSavings ? 'Registrado' : 'Sin registrar todavía'}
          tone="good"
        />
        <Stat
          label="Acumulado del año"
          value={money(accumulatedTotal)}
          hint={`${monthsRecorded} mes(es) con datos`}
        />
      </div>

      <Card
        title="Seguimiento de metas"
        subtitle={`Meta: lo convenido al mes por doce. Proyectado: lo acumulado más lo que queda por guardar hasta diciembre (${monthsLeft} mes(es)).`}
        padded={false}
      >
        <div className="goalrows">
          {rows.map((row) => (
            <article
              className="goalrow"
              key={row.id}
              style={{ '--goal-color': row.goal.color } as CSSProperties}
            >
              <div className="goalrow__head">
                <span className="goalrow__icon">
                  {row.goal.icon ? (
                    <ExpenseIcon slug={row.goal.icon} size={22} color={row.goal.color} />
                  ) : (
                    <span className="legend__dot" style={{ background: row.goal.color }} />
                  )}
                </span>
                <div className="goalrow__text">
                  <h3 className="goalrow__name">{row.label}</h3>
                  <span className="goalrow__hint">
                    {money(row.monthly)} al mes ·{' '}
                    {row.monthsRecorded === 0
                      ? 'sin registrar todavía'
                      : `${row.monthsRecorded} mes(es) registrados`}
                  </span>
                </div>
                <Badge tone={row.progress >= 1 ? 'good' : 'neutral'}>
                  {formatPct(row.progress, settings)}
                </Badge>
              </div>

              <div className="goalrow__bar">
                <Progress
                  value={row.accumulated}
                  max={row.target || 1}
                  color={row.goal.color}
                  label={`${row.label}: acumulado sobre la meta anual`}
                />
              </div>

              <dl className="goalrow__numbers">
                <div className="goalrow__number">
                  <dt>Meta</dt>
                  <dd className="goalrow__number-strong">{money(row.target)}</dd>
                </div>
                <div className="goalrow__number">
                  <dt>Acumulado</dt>
                  <dd>{money(row.accumulated)}</dd>
                </div>
                <div className="goalrow__number">
                  <dt>Proyectado</dt>
                  <dd>{money(row.projected)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </Card>

      {monthsWithData.length === 0 ? (
        <Card title="Acumulado por mes">
          <p className="u-muted">
            Todavía no hay meses guardados. Edita el mes para empezar a registrar.
          </p>
        </Card>
      ) : (
        <>
          <SectionTitle
            title="Acumulado por mes"
            hint={`${monthsWithData.length} mes(es) guardados · un cuadro por persona${
              conjuntas.length > 0 ? ' y otro para las metas conjuntas' : ''
            }. Los montos reales se editan en la pestaña Mes.`}
          />

          {cuadros.map((cuadro) => (
            <Card
              key={cuadro.id}
              title={
                <span className="field__inline">
                  {cuadro.color && (
                    <span className="legend__dot" style={{ background: cuadro.color }} />
                  )}
                  {cuadro.title}
                </span>
              }
              subtitle={resumenCuadro(cuadro)}
              padded={false}
            >
              <div className="table__wrap">
                <table className="table">
                  <caption className="u-sr-only">
                    {`Ahorro registrado por mes · ${cuadro.title}`}
                  </caption>
                  <thead className="table__head">
                    <tr>
                      <th className="table__cell">Mes</th>
                      {cuadro.metas.map((goal) => (
                        <th className="table__cell table__cell--num" key={goal.id}>
                          {goal.name}
                        </th>
                      ))}
                      <th className="table__cell table__cell--num">
                        {cuadro.grupo ? 'Total del grupo' : 'Total'}
                      </th>
                      <th className="table__cell">Registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuadro.filas.map((fila) => (
                      <tr
                        key={fila.id}
                        className={`table__row ${fila.id === monthId ? 'table__row--current' : ''}`}
                      >
                        <td className="table__cell" data-label="Mes">
                          {fila.label}
                          {fila.id === monthId && <Badge tone="accent">Actual</Badge>}
                        </td>
                        {fila.celdas.map((celda) => (
                          <td
                            className="table__cell table__cell--num"
                            key={celda.goal.id}
                            data-label={celda.goal.name}
                          >
                            {celda.value === null ? (
                              <span className="u-muted" title="Sin registro este mes">
                                —
                              </span>
                            ) : (
                              money(celda.value)
                            )}
                          </td>
                        ))}
                        <td className="table__cell table__cell--num" data-label="Total">
                          <strong>{money(fila.total)}</strong>
                        </td>
                        <td className="table__cell" data-label="Registro">
                          {fila.registrado ? (
                            <Badge tone="good">Real</Badge>
                          ) : (
                            <Badge>Sin registro</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  )
}
