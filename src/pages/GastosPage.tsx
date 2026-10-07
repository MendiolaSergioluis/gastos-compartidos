import { useState, type CSSProperties, type Dispatch } from 'react'
import { ExpenseForm } from '../components/ExpenseForm'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconChip,
  Modal,
  Stat,
} from '../components/ui'
import { formatMoney, formatPct } from '../domain/money'
import { newId } from '../domain/defaults'
import { monthLabel, previewSplit, type MonthResult } from '../domain/finance'
import { iconSlugFor } from '../domain/icons'
import type { Action } from '../state/reducer'
import { useToast } from '../state/useToast'
import type { AppState, Expense } from '../domain/types'
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_LABELS, KIND_LABELS, SPLIT_LABELS } from '../domain/types'

interface Props {
  state: AppState
  dispatch: Dispatch<Action>
  monthId: string
  result: MonthResult
}

function blankExpense(): Expense {
  return {
    id: newId('e'),
    name: '',
    category: 'otros',
    kind: 'recurring',
    amount: 0,
    splitMode: 'proportional',
    subscription: false,
  }
}

export function GastosPage({ state, dispatch, monthId, result }: Props) {
  const { settings } = state
  const toast = useToast()
  const [draft, setDraft] = useState<Expense | null>(null)
  const draftPreview = draft ? previewSplit(state, draft, monthId) : undefined
  const [showArchived, setShowArchived] = useState(false)
  const money = (value: number) => formatMoney(value, settings)

  const active = state.expenses.filter((expense) => !expense.archived)
  const archived = state.expenses.filter((expense) => expense.archived)
  const recurring = active.filter((expense) => expense.kind === 'recurring')
  const oneOff = active.filter((expense) => expense.kind === 'oneoff')
  const subscriptions = recurring.filter((expense) => expense.subscription)
  const subscriptionsTotal = subscriptions.reduce((acc, expense) => acc + expense.amount, 0)
  const recurringTotal = recurring.reduce((acc, expense) => acc + expense.amount, 0)
  const shareOfIncome = result.totalIncome > 0 ? recurringTotal / result.totalIncome : 0

  const groups = CATEGORIES.map((category) => ({
    category,
    items: active.filter((expense) => expense.category === category),
  })).filter((group) => group.items.length > 0)

  const isNew = !state.expenses.some((expense) => expense.id === draft?.id)

  const saveDraft = () => {
    if (!draft || draft.name.trim() === '') return
    const expense =
      draft.kind === 'oneoff'
        ? { ...draft, month: draft.month ?? monthId }
        : { ...draft, month: undefined }
    const snapshot = state
    dispatch({ type: 'expense/upsert', expense })
    toast.push({
      message: isNew ? `«${expense.name}» agregado al catálogo` : `«${expense.name}» actualizado`,
      tone: 'good',
      action: { label: 'Deshacer', run: () => dispatch({ type: 'state/import', state: snapshot }) },
    })
    setDraft(null)
  }

  const expenseRow = (expense: Expense) => {
    const share = result.totalIncome > 0 ? expense.amount / result.totalIncome : 0
    return (
      <li
        key={expense.id}
        className="expense__item"
        style={{ '--row-color': CATEGORY_COLORS[expense.category] } as CSSProperties}
      >
        <IconChip
          slug={iconSlugFor(expense)}
          color={CATEGORY_COLORS[expense.category]}
          size={20}
        />

        <div className="expense__main">
          <span className="expense__name">
            <span className="expense__text">{expense.name}</span>
            {expense.subscription && <Badge tone="accent">Suscripción</Badge>}
            {expense.kind === 'oneoff' && (
              <Badge>{expense.month ? monthLabel(expense.month, settings) : KIND_LABELS.oneoff}</Badge>
            )}
          </span>
          <span className="expense__meta">
            {CATEGORY_LABELS[expense.category]} · {SPLIT_LABELS[expense.splitMode]}
            {expense.dueDay ? ` · vence el día ${expense.dueDay}` : ''}
            {expense.notes ? ` · ${expense.notes}` : ''}
          </span>
        </div>

        <div className="expense__amount">
          <strong>{money(expense.amount)}</strong>
          {expense.kind === 'recurring' && (
            <span className="u-muted u-small">{formatPct(share, settings)} del ingreso</span>
          )}
        </div>

        <div className="expense__actions">
          <Button size="sm" variant="ghost" onClick={() => setDraft(expense)}>
            Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDraft({ ...expense, id: newId('e'), name: `${expense.name} (copia)` })}
          >
            Duplicar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const snapshot = state
              dispatch({ type: 'expense/archive', id: expense.id, archived: !expense.archived })
              toast.push({
                message: expense.archived
                  ? `«${expense.name}» reactivado`
                  : `«${expense.name}» archivado`,
                tone: 'info',
                action: {
                  label: 'Deshacer',
                  run: () => dispatch({ type: 'state/import', state: snapshot }),
                },
              })
            }}
          >
            {expense.archived ? 'Reactivar' : 'Archivar'}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              const snapshot = state
              dispatch({ type: 'expense/remove', id: expense.id })
              toast.push({
                message: `«${expense.name}» eliminado`,
                tone: 'warn',
                action: {
                  label: 'Deshacer',
                  run: () => dispatch({ type: 'state/import', state: snapshot }),
                },
              })
            }}
          >
            Eliminar
          </Button>
        </div>
      </li>
    )
  }

  return (
    <div className="stack stack--reveal">
      <div className="grid grid--4">
        <Stat
          label="Recurrentes / mes"
          value={money(recurringTotal)}
          tone="accent"
          hint={`${recurring.length} gastos`}
        />
        <Stat label="Peso sobre el ingreso" value={formatPct(shareOfIncome, settings)} hint="Del mes en curso" />
        <Stat
          label="Suscripciones / mes"
          value={money(subscriptionsTotal)}
          hint={`${money(subscriptionsTotal * 12)} al año`}
          tone={subscriptionsTotal > 0 ? 'warn' : 'neutral'}
        />
        <Stat label="Gastos puntuales" value={`${oneOff.length}`} hint="Registrados por mes" />
      </div>

      <Card
        title="Catálogo de gastos compartidos"
        subtitle="Todo lo recurrente aparece cada mes con su monto; puedes ajustarlo mes a mes sin tocar el catálogo."
        actions={
          <Button variant="primary" size="sm" onClick={() => setDraft(blankExpense())}>
            + Nuevo gasto
          </Button>
        }
        padded={false}
      >
        {active.length === 0 ? (
          <div className="u-pad">
            <EmptyState
              icon="🧾"
              title="Sin gastos en el catálogo"
              detail="Agrega arriendo, servicios, alimentación, suscripciones de entretenimiento…"
              action={
                <Button variant="primary" onClick={() => setDraft(blankExpense())}>
                  Agregar el primero
                </Button>
              }
            />
          </div>
        ) : (
          <div className="u-pad">
            {groups.map((group) => (
              <div key={group.category} className="category__group">
                <h3 className="category__title">
                  <span className="legend__dot" style={{ background: CATEGORY_COLORS[group.category] }} />
                  {CATEGORY_LABELS[group.category]}
                  <span className="category__total">
                    {money(group.items.reduce((acc, item) => acc + item.amount, 0))}
                  </span>
                </h3>
                <ul className="expense__list">{group.items.map(expenseRow)}</ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {archived.length > 0 && (
        <Card
          title="Archivados"
          subtitle="No cuentan en los cálculos."
          actions={
            <Button size="sm" variant="ghost" onClick={() => setShowArchived((value) => !value)}>
              {showArchived ? 'Ocultar' : `Mostrar (${archived.length})`}
            </Button>
          }
          padded={false}
        >
          {showArchived && (
            <div className="u-pad">
              <ul className="expense__list">{archived.map(expenseRow)}</ul>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={draft !== null}
        title={isNew ? 'Nuevo gasto' : 'Editar gasto'}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={saveDraft} disabled={!draft?.name.trim()}>
              Guardar
            </Button>
          </>
        }
      >
        {draft && (
          <ExpenseForm
            value={draft}
            onChange={setDraft}
            people={state.people}
            settings={settings}
            showKind
            preview={draftPreview}
          />
        )}
      </Modal>
    </div>
  )
}
