import type { CSSProperties, Dispatch } from 'react'
import { Bars, Donut, SplitBar } from '../components/charts'
import {
  Badge,
  Card,
  EmptyState,
  ExpenseIcon,
  Progress,
  Stat,
  WarningList,
} from '../components/ui'
import type { Advice } from '../domain/advice'
import type { MonthResult } from '../domain/finance'
import { buildHistory, trackedMonths } from '../domain/finance'
import { iconSlugFor } from '../domain/icons'
import { formatMoney, formatPct } from '../domain/money'
import type { Action } from '../state/reducer'
import { useToast } from '../state/useToast'
import type { AppState } from '../domain/types'
import { CATEGORY_COLORS, CATEGORY_LABELS, SPLIT_LABELS } from '../domain/types'
import type { Tab } from '../App'

interface Props {
  state: AppState
  dispatch: Dispatch<Action>
  monthId: string
  result: MonthResult
  advice: Advice[]
  onNavigate: (tab: Tab) => void
}

const ADVICE_BULLET: Record<Advice['tone'], string> = {
  action: '→',
  warn: '!',
  good: '✓',
}

export function ResumenPage({ state, dispatch, monthId, result, advice, onNavigate }: Props) {
  const { settings } = state
  const toast = useToast()
  const money = (value: number) => formatMoney(value, settings)
  const pct = (value: number) => formatPct(value, settings)
  const goalsPct = result.savings.byGoal.reduce((acc, entry) => acc + entry.goal.pct, 0)
  const freeAfterEverything = result.people.reduce((acc, entry) => acc + entry.available, 0)
  const lastMonths = buildHistory(state, trackedMonths(state)).slice(-6)
  const contributedRatio = result.pot.target > 0 ? result.pot.contributed / result.pot.target : 1

  return (
    <div className="layout layout--reveal">
      {state.demo && (
        <div className="demobanner col col--12">
          <span className="demobanner__text">
            Estás viendo <strong>datos de ejemplo</strong> (Ana 3.000 · Luis 2.000) con seis meses de
            historial. Edítalos en <strong>Ajustes</strong> o empieza de cero.
          </span>
          <div className="demobanner__actions">
            <button className="btn btn--ghost btn--sm" onClick={() => dispatch({ type: 'demo/dismiss' })}>
              Ocultar
            </button>
            <button
              className="btn btn--primary btn--sm"
              onClick={() => {
                const snapshot = state
                dispatch({ type: 'state/empty' })
                toast.push({
                  message: 'Empezaste de cero. ¿Te arrepientes?',
                  tone: 'warn',
                  action: {
                    label: 'Deshacer',
                    run: () => dispatch({ type: 'state/import', state: snapshot }),
                  },
                })
              }}
            >
              Empezar de cero
            </button>
          </div>
        </div>
      )}

      <Card className="hero col col--8" padded={false}>
        <div className="hero__main">
          <div className="ring" style={{ '--ring-value': Math.round(result.pct * 100) } as CSSProperties}>
            <div className="ring__inner">
              <strong className="ring__value" key={result.pct}>
                {pct(result.pct)}
              </strong>
              <span className="ring__label">del ingreso</span>
            </div>
          </div>
          <div className="hero__text">
            <span className="hero__eyebrow">Aporte equitativo</span>
            <div className="hero__formula">
              <span className="hero__fraction">
                <span>{money(result.totalShared)}</span>
                <span className="hero__line" />
                <span>{money(result.totalIncome)}</span>
              </span>
              <span className="hero__equals">=</span>
              <strong className="hero__result">{pct(result.pct)}</strong>
            </div>
            <p className="hero__caption">
              Gastos compartidos ÷ ingreso combinado. Cada uno aporta ese mismo porcentaje de su
              sueldo al fondo común: el esfuerzo es idéntico aunque los sueldos sean distintos.
            </p>
            <div className="hero__badges">
              {result.totalIncome <= 0 ? (
                <Badge>Sin datos todavía: falta el ingreso del mes</Badge>
              ) : result.equitable ? (
                <Badge tone="good">Reparto equitativo ✓</Badge>
              ) : (
                <Badge tone="warn">Hay gastos con reparto distinto: el % efectivo cambia</Badge>
              )}
              <Badge tone="accent">Metas {Math.round(goalsPct)} %</Badge>
            </div>
          </div>
        </div>

        <div className="hero__side">
          <Stat label="Ingreso combinado" value={money(result.totalIncome)} />
          <Stat label="Gastos compartidos" value={money(result.totalShared)} tone="accent" />
          <Stat
            label="Libre tras aporte y metas"
            value={money(freeAfterEverything)}
            tone={freeAfterEverything >= 0 ? 'good' : 'bad'}
            hint={`${pct(result.totalIncome > 0 ? freeAfterEverything / result.totalIncome : 0)} del ingreso`}
          />
        </div>
      </Card>

      <Card
        className="col col--4"
        title="Qué hacer ahora"
        subtitle="Los siguientes pasos de este mes, en orden de urgencia."
      >
        <div className="advice">
          {advice.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`advice__item advice__item--${item.tone}`}
              onClick={() => onNavigate(item.tab)}
            >
              <span className="advice__bullet" aria-hidden="true">
                {ADVICE_BULLET[item.tone]}
              </span>
              <span className="advice__body">
                <strong className="advice__title">{item.title}</strong>
                <p className="advice__text">{item.detail}</p>
              </span>
              <span className="advice__go" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>
      </Card>

      {result.warnings.length > 0 && (
        <div className="col col--12">
          <WarningList warnings={result.warnings} />
        </div>
      )}

      {result.people.map((entry) => {
        const goalsRatio = entry.goalsTarget > 0 ? entry.goalsActual / entry.goalsTarget : 1
        const visibleGoals = entry.distribution.goals.slice(0, 3)
        const extraGoals = entry.distribution.goals.slice(3)
        const extraTotal = extraGoals.reduce((acc, goal) => acc + goal.amount, 0)
        return (
          <Card
            key={entry.person.id}
            className="person col col--4 card--hover"
            style={{ '--person-color': entry.person.color } as CSSProperties}
          >
            <div className="person__head">
              <div>
                <h3 className="person__name">{entry.person.name}</h3>
                <p className="person__salary u-muted u-small">Sueldo {money(entry.salary)}</p>
              </div>
              <Badge tone="accent">{pct(entry.effectivePct)}</Badge>
            </div>

            <div className="person__amount">
              <span className="person__amount-label">Le corresponde aportar</span>
              <strong className="person__amount-value">{money(entry.total)}</strong>
            </div>

            <SplitBar
              segments={[
                { value: entry.distribution.aporte, color: entry.person.color, label: 'Aporte' },
                ...visibleGoals.map((goal) => ({
                  value: goal.amount,
                  color: goal.color,
                  label: goal.name,
                })),
                ...(extraTotal > 0
                  ? [{ value: extraTotal, color: 'var(--color-surface-3)', label: 'Otras metas' }]
                  : []),
                {
                  value: Math.max(0, entry.distribution.libre),
                  color: 'var(--color-surface-3)',
                  label: 'Libre',
                },
              ]}
            />

            <ul className="legend">
              <li className="legend__item">
                <span className="legend__dot" style={{ background: entry.person.color }} />
                Aporte compartido
                <strong className="legend__value">{money(entry.distribution.aporte)}</strong>
              </li>
              {entry.goals.map((goal) => (
                <li className="legend__item" key={goal.goal.id}>
                  <span className="legend__dot" style={{ background: goal.goal.color }} />
                  {goal.goal.name}
                  <strong className="legend__value">
                    {money(goal.actual)}
                    {!goal.recorded && <em className="u-muted u-small"> (meta)</em>}
                  </strong>
                </li>
              ))}
              <li className="legend__item">
                <span className="legend__dot" style={{ background: 'var(--color-surface-3)' }} />
                Libre propio
                <strong className={`legend__value ${entry.available < 0 ? 'u-negative' : ''}`}>
                  {money(entry.available)}
                </strong>
              </li>
            </ul>

            <div className="person__progress">
              <div className="u-row u-row--between">
                <span className="u-muted u-small">Metas del mes</span>
                <span className="u-small">{pct(goalsRatio)}</span>
              </div>
              <Progress
                value={entry.goalsActual}
                max={entry.goalsTarget || 1}
                color={entry.person.color}
                label={`Metas del mes de ${entry.person.name}`}
              />
            </div>
          </Card>
        )
      })}

      <Card
        className="col col--4 card--hover"
        title="Reparto por categoría"
        subtitle={`Total ${money(result.totalShared)}`}
      >
        {result.byCategory.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="Sin gastos este mes"
            detail="Agrega gastos recurrentes en Gastos o uno puntual en Mes."
            action={
              <button className="btn btn--primary btn--sm" onClick={() => onNavigate('gastos')}>
                Agregar gastos
              </button>
            }
          />
        ) : (
          <div className="category">
            <Donut
              slices={result.byCategory.map((entry) => ({
                label: CATEGORY_LABELS[entry.category],
                value: entry.amount,
                color: CATEGORY_COLORS[entry.category],
              }))}
              center={
                <>
                  <strong>{money(result.totalShared)}</strong>
                  <span className="u-muted u-small">al mes</span>
                </>
              }
            />
            <ul className="legend">
              {result.byCategory.map((entry) => (
                <li className="legend__item" key={entry.category}>
                  <span className="legend__dot" style={{ background: CATEGORY_COLORS[entry.category] }} />
                  {CATEGORY_LABELS[entry.category]}
                  <strong className="legend__value">{money(entry.amount)}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card
        className="col col--5 card--hover"
        title="Fondo común"
        subtitle="Cada uno transfiere su porción y desde ahí se pagan las facturas. Nadie le debe a nadie."
      >
        <div className="pot">
          <div className="pot__headline">
            <div>
              <span className="pot__label">Transferido al fondo</span>
              <strong className="pot__value">
                {money(result.pot.contributed)}
                <span className="pot__target"> de {money(result.pot.target)}</span>
              </strong>
            </div>
            <Badge tone={contributedRatio >= 1 ? 'good' : 'warn'}>{pct(contributedRatio)}</Badge>
          </div>
          <Progress
            value={result.pot.contributed}
            max={result.pot.target || 1}
            color="var(--color-accent)"
            label="Aporte transferido al fondo común"
          />
          <ul className="pot__stats">
            <li>
              <span className="u-muted u-small">Pagado desde el fondo</span>
              <strong>{money(result.pot.spent)}</strong>
            </li>
            <li>
              <span className="u-muted u-small">Queda en el fondo</span>
              <strong className={result.pot.balance < 0 ? 'u-negative' : ''}>
                {money(result.pot.balance)}
              </strong>
            </li>
            <li>
              <span className="u-muted u-small">Facturas pendientes</span>
              <strong>{money(result.pot.pendingBills)}</strong>
            </li>
          </ul>

          <ul className="pot__people">
            {result.people.map((entry) => (
              <li key={entry.person.id} className="pot__person">
                <span className="legend__dot" style={{ background: entry.person.color }} />
                <span className="pot__person-name">{entry.person.name}</span>
                <span className="pot__person-amount">{money(entry.contribution.actual)}</span>
                {entry.contribution.done ? (
                  <Badge tone="good">Transferido</Badge>
                ) : (
                  <Badge tone="warn">Pendiente</Badge>
                )}
              </li>
            ))}
          </ul>

          <div className="u-row u-row--wrap pot__footer">
            <Badge tone={result.pot.paidCount > 0 ? 'good' : 'neutral'}>
              {result.pot.paidCount} facturas pagadas
            </Badge>
            <Badge tone={result.pot.pendingCount > 0 ? 'warn' : 'good'}>
              {result.pot.pendingCount} por pagar
            </Badge>
          </div>
        </div>
      </Card>

      {lastMonths.length > 1 && (
        <Card
          className="col col--7 card--hover"
          title="Peso de los gastos compartidos"
          subtitle="Porcentaje del ingreso combinado que se va en gastos comunes."
        >
          <Bars
            points={lastMonths.map((row) => ({
              label: row.shortLabel,
              value: row.pct * 100,
              hint: `${row.label}: ${money(row.totalShared)} de ${money(row.totalIncome)}`,
              highlight: row.monthId === monthId,
              color: row.monthId === monthId ? 'var(--color-accent)' : undefined,
            }))}
            renderValue={(point) => `${Math.round(point.value)}%`}
            max={100}
          />
        </Card>
      )}

      <Card
        className="col col--12"
        title="Detalle del mes"
        subtitle="Cuánto aporta cada uno en cada gasto, con el mismo % de su sueldo."
        padded={false}
      >
        <div className="table__wrap">
          <table className="table">
            <caption className="u-sr-only">
              Gastos compartidos del mes y aporte de cada persona
            </caption>
            <thead className="table__head">
              <tr>
                <th className="table__cell">Gasto</th>
                <th className="table__cell">Reparto</th>
                <th className="table__cell table__cell--num">Monto</th>
                {result.people.map((entry) => (
                  <th className="table__cell table__cell--num" key={entry.person.id}>
                    {entry.person.name}
                  </th>
                ))}
                <th className="table__cell">Estado</th>
              </tr>
            </thead>
            <tbody>
              {result.allocations
                .filter((allocation) => allocation.amount > 0 || allocation.expense.kind === 'recurring')
                .map((allocation) => (
                  <tr
                    key={allocation.expense.id}
                    className={`table__row ${allocation.amount === 0 ? 'table__row--muted' : ''}`}
                  >
                    <td className="table__cell" data-label="Gasto">
                      <span className="table__title">
                        <ExpenseIcon
                          slug={iconSlugFor(allocation.expense)}
                          size={18}
                          color={CATEGORY_COLORS[allocation.expense.category]}
                        />
                        {allocation.expense.name}
                        {allocation.expense.subscription && <Badge>Suscripción</Badge>}
                      </span>
                      <span className="u-muted u-small">
                        {CATEGORY_LABELS[allocation.expense.category]}
                      </span>
                    </td>
                    <td className="table__cell" data-label="Reparto">
                      <span className="u-muted u-small">
                        {SPLIT_LABELS[allocation.expense.splitMode]}
                        {allocation.expense.splitMode === 'proportional' &&
                          ` · ${pct(result.pct)} del sueldo`}
                      </span>
                    </td>
                    <td className="table__cell table__cell--num" data-label="Monto">
                      {allocation.amount > 0 ? money(allocation.amount) : '—'}
                    </td>
                    {result.people.map((entry) => (
                      <td
                        className="table__cell table__cell--num"
                        key={entry.person.id}
                        data-label={entry.person.name}
                      >
                        {allocation.amount > 0 ? (
                          <span style={{ color: entry.person.color }}>
                            {money(allocation.parts[entry.person.id] ?? 0)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    ))}
                    <td className="table__cell" data-label="Estado">
                      {allocation.amount === 0 ? (
                        <Badge>Omitido</Badge>
                      ) : allocation.entry.paid ? (
                        <Badge tone="good">Pagado</Badge>
                      ) : (
                        <Badge tone="warn">Pendiente</Badge>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="table__row">
                <td className="table__cell" colSpan={2}>
                  Total
                </td>
                <td className="table__cell table__cell--num">{money(result.totalShared)}</td>
                {result.people.map((entry) => (
                  <td
                    className="table__cell table__cell--num"
                    key={entry.person.id}
                    data-label={entry.person.name}
                  >
                    <strong>{money(entry.total)}</strong>
                  </td>
                ))}
                <td className="table__cell" />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}
