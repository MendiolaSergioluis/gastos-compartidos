import { Bars } from '../components/charts'
import { Badge, Button, Card, Stat } from '../components/ui'
import { buildHistory, trackedMonths } from '../domain/finance'
import { formatMoney, formatPct } from '../domain/money'
import type { AppState } from '../domain/types'

interface Props {
  state: AppState
  monthId: string
  onSelectMonth: (monthId: string) => void
}

export function HistorialPage({ state, monthId, onSelectMonth }: Props) {
  const { settings } = state
  const money = (value: number) => formatMoney(value, settings)
  const rows = buildHistory(state, trackedMonths(state))
  const current = rows.find((row) => row.monthId === monthId)
  const index = rows.findIndex((row) => row.monthId === monthId)
  const previous = index > 0 ? rows[index - 1] : undefined

  const best = rows.reduce<(typeof rows)[number] | undefined>(
    (acc, row) => (row.totalIncome > 0 && (!acc || row.pct < acc.pct) ? row : acc),
    undefined,
  )
  const worst = rows.reduce<(typeof rows)[number] | undefined>(
    (acc, row) => (row.totalIncome > 0 && (!acc || row.pct > acc.pct) ? row : acc),
    undefined,
  )
  const withData = rows.filter((row) => row.hasData)
  const average =
    withData.length > 0 ? withData.reduce((acc, row) => acc + row.pct, 0) / withData.length : 0

  const delta =
    current && previous && previous.totalIncome > 0 && current.totalIncome > 0
      ? current.pct - previous.pct
      : undefined

  return (
    <div className="stack stack--reveal">
      <div className="grid grid--4">
        <Stat label="Meses con datos" value={String(withData.length)} hint={`${rows.length} meses en total`} />
        <Stat
          label="% promedio"
          value={formatPct(average, settings)}
          tone="accent"
          hint="Gastos compartidos / ingreso"
        />
        <Stat
          label="Mes más liviano"
          value={best ? formatPct(best.pct, settings) : '—'}
          hint={best?.label}
          tone="good"
        />
        <Stat
          label="Mes más pesado"
          value={worst ? formatPct(worst.pct, settings) : '—'}
          hint={worst?.label}
          tone="warn"
        />
      </div>

      {current && (
        <Card
          title={`Comparación de ${current.label}`}
          subtitle={
            previous
              ? `Contra ${previous.label}: ${
                  delta === undefined
                    ? 'sin datos suficientes'
                    : `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)} puntos porcentuales`
                }`
              : 'Sin mes anterior con el que comparar'
          }
        >
          <div className="grid grid--3">
            <Stat label="Ingreso combinado" value={money(current.totalIncome)} />
            <Stat label="Gastos compartidos" value={money(current.totalShared)} tone="accent" />
            <Stat
              label="Aporte de cada uno"
              value={current.perPerson.map((person) => person.contribution).map(money).join(' · ') || '—'}
              hint={current.perPerson
                .map((person) => `${person.name} ${formatPct(person.effectivePct, settings)}`)
                .join(' · ')}
            />
          </div>
          {delta !== undefined && (
            <p className={delta > 0 ? 'u-negative' : 'u-positive'}>
              {delta > 0
                ? `Este mes los gastos compartidos pesan ${(delta * 100).toFixed(1)} puntos más que el mes anterior.`
                : `Este mes los gastos compartidos pesan ${Math.abs(delta * 100).toFixed(1)} puntos menos que el mes anterior.`}
            </p>
          )}
        </Card>
      )}

      <Card title="Evolución del % de gastos compartidos" subtitle="Cada barra es un mes guardado.">
        <Bars
          points={rows.map((row) => ({
            label: row.shortLabel,
            value: row.pct * 100,
            hint: `${row.label}: ${money(row.totalShared)} de ${money(row.totalIncome)}`,
            color:
              row.monthId === monthId
                ? 'var(--color-accent)'
                : row.hasData
                  ? undefined
                  : 'var(--color-surface-3)',
            highlight: row.monthId === monthId,
          }))}
          max={100}
          renderValue={(point) => `${Math.round(point.value)}%`}
        />
      </Card>

      <Card title="Historial" subtitle="Toca un mes para abrirlo en Resumen." padded={false}>
        <div className="table__wrap">
          <table className="table">
            <caption className="u-sr-only">Historial mensual de gastos compartidos</caption>
            <thead className="table__head">
              <tr>
                <th className="table__cell">Mes</th>
                <th className="table__cell table__cell--num">Ingreso</th>
                <th className="table__cell table__cell--num">Gastos</th>
                <th className="table__cell table__cell--num">%</th>
                {state.people.map((person) => (
                  <th className="table__cell table__cell--num" key={person.id}>
                    {person.name}
                  </th>
                ))}
                <th className="table__cell table__cell--num">Metas</th>
                <th className="table__cell table__cell--num">Fondo</th>
                <th className="table__cell" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.monthId}
                  className={`table__row ${row.monthId === monthId ? 'table__row--current' : ''}`}
                >
                  <td className="table__cell" data-label="Mes">
                    {row.label} {row.monthId === monthId && <Badge tone="accent">Actual</Badge>}
                    {!row.hasData && <Badge>Sin guardar</Badge>}
                  </td>
                  <td className="table__cell table__cell--num" data-label="Ingreso">
                    {money(row.totalIncome)}
                  </td>
                  <td className="table__cell table__cell--num" data-label="Gastos">
                    {money(row.totalShared)}
                  </td>
                  <td className="table__cell table__cell--num" data-label="%">
                    <strong>{formatPct(row.pct, settings)}</strong>
                  </td>
                  {state.people.map((person) => {
                    const item = row.perPerson.find((entry) => entry.id === person.id)
                    return (
                      <td className="table__cell table__cell--num" key={person.id} data-label={person.name}>
                        {item ? money(item.contribution) : '—'}
                        <span className="u-muted u-small u-block">
                          {item ? formatPct(item.effectivePct, settings) : ''}
                        </span>
                      </td>
                    )
                  })}
                  <td className="table__cell table__cell--num" data-label="Metas">
                    {money(row.savings.total)}
                  </td>
                  <td className="table__cell table__cell--num" data-label="Fondo">
                    {money(row.pot.contributed)}
                    {row.pot.pending > 0 && (
                      <span className="u-muted u-small u-block">faltan {money(row.pot.pending)}</span>
                    )}
                  </td>
                  <td className="table__cell">
                    <Button size="sm" variant="ghost" onClick={() => onSelectMonth(row.monthId)}>
                      Abrir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="u-muted u-small">
        Los meses «Sin guardar» se calculan con los sueldos base y los montos del catálogo, así puedes
        usarlos como presupuesto proyectado. Edita el mes para guardarlo.
      </p>
    </div>
  )
}
