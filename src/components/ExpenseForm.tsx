import {
  ExpenseIcon,
  Field,
  IconChip,
  IconPicker,
  MoneyInput,
  NumberInput,
  Segmented,
  TextInput,
  Toggle,
} from './ui'
import { Select, type SelectOption } from './Select'
import { DEFAULT_ICON_BY_CATEGORY, iconSlugFor } from '../domain/icons'
import { formatMoney, formatPct } from '../domain/money'
import type { ExpensePreview } from '../domain/finance'
import type { Expense, ExpenseCategory, Person, Settings, SplitMode } from '../domain/types'
import {
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  KIND_LABELS,
  SPLIT_HELP,
  SPLIT_LABELS,
} from '../domain/types'

interface Props {
  value: Expense
  onChange: (expense: Expense) => void
  people: Person[]
  settings: Settings
  showKind?: boolean
  /** reparto del gasto tal como se está editando, para verlo antes de guardar */
  preview?: ExpensePreview
}

export function ExpenseForm({
  value,
  onChange,
  people,
  settings,
  showKind = false,
  preview,
}: Props) {
  const patch = (changes: Partial<Expense>) => onChange({ ...value, ...changes })

  const setShare = (personId: string, amount: number) => {
    const customShares = { ...(value.customShares ?? {}), [personId]: amount }
    const total = Object.values(customShares).reduce((acc, item) => acc + item, 0)
    // en modo montos fijos el total del gasto es la suma de los montos por persona
    patch({ customShares, amount: total })
  }

  const changeSplitMode = (splitMode: SplitMode) => {
    if (splitMode === 'custom') {
      const half = value.amount / (people.length || 1)
      const customShares: Record<string, number> = {}
      for (const person of people) {
        customShares[person.id] = value.customShares?.[person.id] ?? Math.round(half * 100) / 100
      }
      const total = Object.values(customShares).reduce((acc, item) => acc + item, 0)
      patch({ splitMode, customShares, amount: total })
      return
    }
    patch({ splitMode })
  }

  const categoryOptions: SelectOption[] = CATEGORIES.map((category) => ({
    value: category,
    label: CATEGORY_LABELS[category],
    icon: (
      <ExpenseIcon
        slug={DEFAULT_ICON_BY_CATEGORY[category]}
        size={16}
        color={CATEGORY_COLORS[category]}
      />
    ),
  }))

  const kindOptions: SelectOption[] = [
    { value: 'recurring', label: KIND_LABELS.recurring, hint: 'cada mes' },
    { value: 'oneoff', label: KIND_LABELS.oneoff, hint: 'solo este mes' },
  ]

  return (
    <div className="form">
      <Field label="Nombre" full>
        <TextInput
          value={value.name}
          placeholder="Arriendo, Netflix, supermercado…"
          onChange={(event) => patch({ name: event.target.value })}
        />
      </Field>

      <Field label="Categoría">
        <Select
          value={value.category}
          options={categoryOptions}
          onChange={(category) => patch({ category: category as ExpenseCategory })}
          ariaLabel="Categoría"
        />
      </Field>

      {showKind ? (
        <Field label="Tipo" hint="Los recurrentes se repiten cada mes; los puntuales viven en su mes.">
          <Select
            value={value.kind}
            options={kindOptions}
            onChange={(kind) => patch({ kind: kind as Expense['kind'] })}
            ariaLabel="Tipo de gasto"
          />
        </Field>
      ) : (
        <Field label="Tipo">
          <div className="form__static">
            <IconChip slug={iconSlugFor(value)} color={CATEGORY_COLORS[value.category]} size={16} chipSize="sm" />
            {KIND_LABELS.oneoff}
          </div>
        </Field>
      )}

      <Field label="Icono" full hint="Aparece en las listas, el resumen y los gráficos.">
        <IconPicker
          value={value.icon ?? DEFAULT_ICON_BY_CATEGORY[value.category]}
          category={value.category}
          onChange={(icon) => patch({ icon })}
        />
      </Field>

      <Field label="Reparto" full hint={SPLIT_HELP[value.splitMode]}>
        <Segmented<SplitMode>
          value={value.splitMode}
          onChange={changeSplitMode}
          options={[
            { value: 'proportional', label: SPLIT_LABELS.proportional },
            { value: 'equal', label: SPLIT_LABELS.equal },
            { value: 'custom', label: SPLIT_LABELS.custom },
          ]}
        />
      </Field>

      {value.splitMode === 'custom' ? (
        people.map((person) => (
          <Field key={person.id} label={`Monto de ${person.name}`}>
            <MoneyInput
              value={value.customShares?.[person.id] ?? 0}
              onChange={(amount) => setShare(person.id, amount)}
              decimals={settings.decimals}
              symbol={settings.currencySymbol}
            />
          </Field>
        ))
      ) : (
        <Field label="Monto mensual">
          <MoneyInput
            value={value.amount}
            onChange={(amount) => patch({ amount })}
            decimals={settings.decimals}
            symbol={settings.currencySymbol}
          />
        </Field>
      )}

      {value.kind === 'recurring' && (
        <Field label="Día de vencimiento" hint="Opcional, sirve para las alertas.">
          <NumberInput
            value={value.dueDay ?? 0}
            decimals={0}
            min={0}
            max={31}
            onChange={(day) => patch({ dueDay: day > 0 ? Math.min(31, Math.round(day)) : undefined })}
          />
        </Field>
      )}

      <Field label="¿Es suscripción?" hint="Netflix, Prime, Spotify, gimnasio…">
        <div className="form__toggle">
          <Toggle
            checked={Boolean(value.subscription)}
            onChange={(checked) => patch({ subscription: checked })}
            label="Es suscripción"
          />
          <span className="u-muted u-small">{value.subscription ? 'Sí' : 'No'}</span>
        </div>
      </Field>

      <Field label="Notas" full>
        <TextInput
          value={value.notes ?? ''}
          placeholder="Ej: se paga cada dos meses, incluye agua caliente…"
          onChange={(event) => patch({ notes: event.target.value })}
        />
      </Field>

      {preview && preview.amount > 0 && (
        <div className="form__preview">
          <span className="form__preview-title">Así queda el reparto</span>
          <ul className="form__preview-list">
            {people.map((person) => (
              <li key={person.id} className="form__preview-item">
                <span className="legend__dot" style={{ background: person.color }} />
                <span className="form__preview-name">{person.name}</span>
                <strong className="form__preview-amount">{formatMoney(preview.parts[person.id] ?? 0, settings)}</strong>
                <span className="u-muted u-small">
                  {formatPct(preview.effectivePct[person.id] ?? 0, settings)} de su sueldo
                </span>
              </li>
            ))}
          </ul>
          {preview.exceedsSalary && (
            <p className="form__preview-warning">
              Ojo: alguien tendría que aportar más de lo que gana en un mes. Revisa el monto.
            </p>
          )}
          {!preview.equitable && (
            <p className="u-muted u-small">
              Con este modo el porcentaje no es igual para todos: el esfuerzo relativo cambia.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
