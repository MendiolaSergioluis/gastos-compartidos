import { useState, type CSSProperties, type Dispatch } from 'react'
import { ExpenseForm } from '../components/ExpenseForm'
import { Select } from '../components/Select'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconChip,
  MoneyInput,
  Modal,
  TextInput,
  Toggle,
} from '../components/ui'
import { previewSplit, resolveEntry, type MonthResult } from '../domain/finance'
import { newId } from '../domain/defaults'
import { iconSlugFor } from '../domain/icons'
import { formatMoney, formatPct } from '../domain/money'
import type { Action } from '../state/reducer'
import { useToast } from '../state/useToast'
import type { AppState, Expense, SplitMode } from '../domain/types'
import { CATEGORY_COLORS, KIND_LABELS, SPLIT_LABELS } from '../domain/types'

interface Props {
  state: AppState
  dispatch: Dispatch<Action>
  monthId: string
  result: MonthResult
}

function blankOneOff(monthId: string): Expense {
  return {
    id: newId('e'),
    name: '',
    category: 'otros',
    kind: 'oneoff',
    amount: 0,
    splitMode: 'proportional',
    month: monthId,
  }
}

export function MesPage({ state, dispatch, monthId, result }: Props) {
  const { settings, people } = state
  const toast = useToast()
  const [draft, setDraft] = useState<Expense | null>(null)
  const draftPreview = draft ? previewSplit(state, draft, monthId) : undefined
  const money = (value: number) => formatMoney(value, settings)

  const visible = state.expenses.filter((expense) => {
    if (expense.archived) return false
    if (expense.kind === 'oneoff') return expense.month === monthId
    return true
  })

  const note = state.months[monthId]?.note ?? ''

  const saveOneOff = () => {
    if (!draft || draft.name.trim() === '') return
    dispatch({ type: 'expense/upsert', expense: { ...draft, month: monthId } })
    toast.push({ message: `«${draft.name}» agregado a este mes`, tone: 'good' })
    setDraft(null)
  }

  return (
    <div className="stack stack--reveal">
      <Card
        title="Sueldos del mes"
        subtitle="El % de aporte se recalcula solo: gastos compartidos ÷ suma de sueldos."
        actions={
          state.months[monthId] ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const snapshot = state
                dispatch({ type: 'month/clear', monthId })
                toast.push({
                  message: 'Montos del mes restablecidos al catálogo',
                  tone: 'warn',
                  action: {
                    label: 'Deshacer',
                    run: () => dispatch({ type: 'state/import', state: snapshot }),
                  },
                })
              }}
            >
              Restablecer mes
            </Button>
          ) : undefined
        }
      >
        <div className="grid grid--2">
          {people.map((person) => (
            <Field key={person.id} label={`Sueldo de ${person.name}`}>
              <MoneyInput
                value={result.people.find((entry) => entry.person.id === person.id)?.salary ?? 0}
                onChange={(value) =>
                  dispatch({ type: 'month/salary', monthId, personId: person.id, value })
                }
                decimals={settings.decimals}
                symbol={settings.currencySymbol}
              />
            </Field>
          ))}
        </div>
        <div className="summary">
          <span className="summary__item">
            Ingreso combinado <strong>{money(result.totalIncome)}</strong>
          </span>
          <span className="summary__item">
            Gastos compartidos <strong>{money(result.totalShared)}</strong>
          </span>
          <span className="summary__item">
            % de aporte <strong>{formatPct(result.pct, settings)}</strong>
          </span>
          {people.map((person) => {
            const entry = result.people.find((item) => item.person.id === person.id)
            if (!entry) return null
            return (
              <span className="summary__item" key={person.id}>
                <span className="legend__dot" style={{ background: person.color }} /> {person.name}{' '}
                <strong>{money(entry.total)}</strong>
              </span>
            )
          })}
        </div>
      </Card>

      <Card
        title="Fondo común"
        subtitle="Cada uno transfiere su porción a la cuenta común y desde ahí se pagan las facturas. Así nadie le debe a nadie."
      >
        <div className="grid grid--2">
          {people.map((person) => {
            const entry = result.people.find((item) => item.person.id === person.id)
            const contribution = entry?.contribution
            return (
              <div className="contribution" key={person.id}>
                <h3 className="contribution__name">
                  <span className="legend__dot" style={{ background: person.color }} />
                  {person.name}
                </h3>
                <Field
                  label="Aporte al fondo"
                  hint={`Le corresponde ${money(contribution?.expected ?? 0)}`}
                >
                  <MoneyInput
                    value={contribution?.actual ?? 0}
                    decimals={settings.decimals}
                    symbol={settings.currencySymbol}
                    onChange={(value) =>
                      dispatch({
                        type: 'month/contribution',
                        monthId,
                        personId: person.id,
                        patch: { amount: value },
                      })
                    }
                  />
                </Field>
                <div className="contribution__status">
                  <Toggle
                    checked={contribution?.done ?? false}
                    label={`Aporte transferido de ${person.name}`}
                    onChange={(done) =>
                      dispatch({
                        type: 'month/contribution',
                        monthId,
                        personId: person.id,
                        patch: { done },
                      })
                    }
                  />
                  <span className="u-muted u-small">
                    {contribution?.done ? 'Ya lo transfirió' : 'Aún no lo transfiere'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="summary">
          <span className="summary__item">
            En el fondo <strong>{money(result.pot.contributed)}</strong>{' '}
            <span className="u-muted">de {money(result.pot.target)}</span>
          </span>
          <span className="summary__item">
            Falta transferir{' '}
            <strong className={result.pot.pending > 0 ? 'u-warn' : ''}>{money(result.pot.pending)}</strong>
          </span>
          <span className="summary__item">
            Pagado desde el fondo <strong>{money(result.pot.spent)}</strong>
          </span>
          <span className="summary__item">
            Queda <strong className={result.pot.balance < 0 ? 'u-negative' : ''}>{money(result.pot.balance)}</strong>
          </span>
        </div>
      </Card>

      <Card
        title="Gastos del mes"
        subtitle="Ajusta el monto y marca las facturas a medida que salen del fondo. Los cambios se guardan al salir del campo."
        actions={
          <Button variant="primary" size="sm" onClick={() => setDraft(blankOneOff(monthId))}>
            + Gasto puntual
          </Button>
        }
        padded={false}
      >
        {visible.length === 0 ? (
          <div className="u-pad">
            <EmptyState
              icon="🧾"
              title="Sin gastos este mes"
              detail="Crea los recurrentes en Gastos para que aparezcan cada mes, o agrega uno puntual aquí."
              action={
                <Button variant="primary" onClick={() => setDraft(blankOneOff(monthId))}>
                  Agregar gasto puntual
                </Button>
              }
            />
          </div>
        ) : (
          <div className="u-pad">
            <div className="monthrow__list">
              {visible.map((expense) => {
                const entry = resolveEntry(expense, state.months[monthId])
                const allocation = result.allocations.find((item) => item.expense.id === expense.id)
                const amount = allocation?.amount ?? 0
                return (
                  <div
                    key={expense.id}
                    className={`monthrow ${entry.active ? '' : 'monthrow--omitted'}`}
                    style={{ '--row-color': CATEGORY_COLORS[expense.category] } as CSSProperties}
                  >
                    <Toggle
                      checked={entry.active}
                      label={`Activo ${expense.name}`}
                      onChange={(active) =>
                        dispatch({
                          type: 'month/entry',
                          monthId,
                          expenseId: expense.id,
                          patch: { active },
                        })
                      }
                    />

                    <div className="monthrow__main">
                      <span className="monthrow__name">
                        <IconChip
                          slug={iconSlugFor(expense)}
                          color={CATEGORY_COLORS[expense.category]}
                          size={15}
                          chipSize="sm"
                        />
                        <span className="monthrow__text">{expense.name || 'Sin nombre'}</span>
                        {expense.kind === 'oneoff' && <Badge>{KIND_LABELS.oneoff}</Badge>}
                        {expense.subscription && <Badge tone="accent">Suscripción</Badge>}
                      </span>
                      <span className="monthrow__meta">
                        {entry.active && amount > 0 ? (
                          <>
                            {people.map((person, index) => (
                              <span key={person.id}>
                                {index > 0 && ' · '}
                                <span style={{ color: person.color }}>
                                  {person.name} {money(allocation?.parts[person.id] ?? 0)}
                                </span>
                              </span>
                            ))}
                            {expense.dueDay ? ` · vence el día ${expense.dueDay}` : ''}
                          </>
                        ) : (
                          'Omitido este mes'
                        )}
                      </span>
                    </div>

                    {expense.splitMode === 'custom' ? (
                      <span className="u-muted u-small">Montos fijos: {money(amount)}</span>
                    ) : (
                      <MoneyInput
                        value={entry.amount}
                        decimals={settings.decimals}
                        symbol={settings.currencySymbol}
                        aria-label={`Monto de ${expense.name}`}
                        onChange={(value) =>
                          dispatch({
                            type: 'month/entry',
                            monthId,
                            expenseId: expense.id,
                            patch: { amount: value },
                          })
                        }
                      />
                    )}

                    <div className="monthrow__extra">
                      <Select
                        compact
                        value={expense.splitMode}
                        ariaLabel={`Reparto de ${expense.name}`}
                        options={(['proportional', 'equal', 'custom'] as SplitMode[]).map((mode) => ({
                          value: mode,
                          label: SPLIT_LABELS[mode],
                        }))}
                        onChange={(mode) =>
                          dispatch({
                            type: 'expense/upsert',
                            expense: { ...expense, splitMode: mode as SplitMode },
                          })
                        }
                      />

                      {expense.splitMode === 'custom' && (
                        <div className="monthrow__shares">
                          {people.map((person) => (
                            <MoneyInput
                              key={person.id}
                              value={expense.customShares?.[person.id] ?? 0}
                              decimals={settings.decimals}
                              symbol={settings.currencySymbol}
                              aria-label={`Monto fijo de ${person.name}`}
                              onChange={(value) => {
                                const customShares = {
                                  ...(expense.customShares ?? {}),
                                  [person.id]: value,
                                }
                                dispatch({
                                  type: 'expense/upsert',
                                  expense: {
                                    ...expense,
                                    customShares,
                                    amount: Object.values(customShares).reduce(
                                      (acc, item) => acc + item,
                                      0,
                                    ),
                                  },
                                })
                              }}
                            />
                          ))}
                        </div>
                      )}

                      <span className="monthrow__paid">
                        <Toggle
                          checked={entry.paid}
                          label={`Pagada ${expense.name}`}
                          onChange={(paid) =>
                            dispatch({
                              type: 'month/entry',
                              monthId,
                              expenseId: expense.id,
                              patch: { paid },
                            })
                          }
                        />
                        <span className="u-muted u-small">{entry.paid ? 'Pagada' : 'Por pagar'}</span>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="summary">
              <span className="summary__item">
                Total <strong>{money(result.totalShared)}</strong>
              </span>
              {result.people.map((entry) => (
                <span className="summary__item" key={entry.person.id}>
                  <span className="legend__dot" style={{ background: entry.person.color }} />
                  {entry.person.name} <strong>{money(entry.total)}</strong>{' '}
                  <span className="u-muted">({formatPct(entry.effectivePct, settings)})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Metas del mes"
        subtitle="Un porcentaje del sueldo de cada uno. Las metas se configuran en Ajustes."
      >
        <div className="goalgrid">
          {people.map((person) => {
            const entry = result.people.find((item) => item.person.id === person.id)
            return (
              <div className="goalcard" key={person.id}>
                <h3 className="goalcard__title">
                  <span className="legend__dot" style={{ background: person.color }} />
                  {person.name}
                </h3>
                {entry?.goals.map((goal) => (
                  <Field
                    key={goal.goal.id}
                    label={
                      <span className="field__inline">
                        <span className="legend__dot" style={{ background: goal.goal.color }} />
                        {goal.goal.name}
                        <span className="u-muted"> {goal.goal.pct} %</span>
                      </span>
                    }
                    hint={`Meta ${money(goal.target)}`}
                  >
                    <MoneyInput
                      value={goal.actual}
                      decimals={settings.decimals}
                      symbol={settings.currencySymbol}
                      onChange={(value) =>
                        dispatch({
                          type: 'month/savings',
                          monthId,
                          personId: person.id,
                          goalId: goal.goal.id,
                          value,
                        })
                      }
                    />
                  </Field>
                ))}
                {!state.months[monthId]?.savings?.[person.id] && (
                  <p className="u-muted u-small">
                    Sin registrar: se muestran las metas. Al escribir se guarda el monto real.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="Notas del mes">
        <TextInput
          value={note}
          aria-label="Notas del mes"
          placeholder="Ej: este mes subió la luz, pagamos el seguro anual…"
          onChange={(event) => dispatch({ type: 'month/note', monthId, note: event.target.value })}
        />
      </Card>

      <Modal
        open={draft !== null}
        title="Nuevo gasto puntual"
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={saveOneOff} disabled={!draft?.name.trim()}>
              Agregar
            </Button>
          </>
        }
      >
        {draft && (
          <ExpenseForm
            value={draft}
            onChange={setDraft}
            people={people}
            settings={settings}
            showKind={false}
            preview={draftPreview}
          />
        )}
      </Modal>
    </div>
  )
}
