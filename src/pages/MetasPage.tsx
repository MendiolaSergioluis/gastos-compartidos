import { type CSSProperties, type Dispatch } from 'react'
import { Badge, Card, EmptyState, ExpenseIcon, Progress, Stat } from '../components/ui'
import {
  buildGoalRows,
  computeMonth,
  monthLabel,
  trackedMonths,
  type MonthResult,
} from '../domain/finance'
import { formatMoney, formatPct } from '../domain/money'
import type { Action } from '../state/reducer'
import type { AppState } from '../domain/types'

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

      <Card
        title="Acumulado por mes"
        subtitle={`${monthsWithData.length} mes(es) guardados · los montos reales se editan en la pestaña Mes`}
        padded={false}
      >
        {monthsWithData.length === 0 ? (
          <div className="u-pad">
            <p className="u-muted">
              Todavía no hay meses guardados. Edita el mes para empezar a registrar.
            </p>
          </div>
        ) : (
          <div className="table__wrap">
            <table className="table">
              <caption className="u-sr-only">Ahorro registrado por meta y mes</caption>
              <thead className="table__head">
                <tr>
                  <th className="table__cell">Mes</th>
                  {goals.map((goal) => (
                    <th className="table__cell table__cell--num" key={goal.id}>
                      {goal.name}
                    </th>
                  ))}
                  <th className="table__cell table__cell--num">Total</th>
                  <th className="table__cell">Registro</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((row) => (
                  <tr
                    key={row.id}
                    className={`table__row ${row.id === monthId ? 'table__row--current' : ''}`}
                  >
                    <td className="table__cell" data-label="Mes">
                      {row.label}
                      {row.id === monthId && <Badge tone="accent">Actual</Badge>}
                    </td>
                    {goals.map((goal) => {
                      const entry = row.result.savings.byGoal.find(
                        (item) => item.goal.id === goal.id,
                      )
                      return (
                        <td
                          className="table__cell table__cell--num"
                          key={goal.id}
                          data-label={goal.name}
                        >
                          {entry?.recorded ? (
                            money(entry.deposited)
                          ) : (
                            <span className="u-muted" title="Sin registro este mes">
                              —
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td className="table__cell table__cell--num" data-label="Total">
                      <strong>{money(row.result.savings.totalDeposited)}</strong>
                    </td>
                    <td className="table__cell" data-label="Registro">
                      {row.result.hasRecordedSavings ? (
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
        )}
      </Card>
    </div>
  )
}
