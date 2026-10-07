import { useRef, type Dispatch } from 'react'
import { ColorPicker } from '../components/ColorPicker'
import { Select } from '../components/Select'
import {
  Badge,
  Button,
  Card,
  ExpenseIcon,
  Field,
  IconButton,
  MoneyInput,
  NumberInput,
  TextInput,
} from '../components/ui'
import { GOAL_COLORS, PERSON_COLORS, goalTemplate, newId } from '../domain/defaults'
import { ICONS } from '../domain/icons'
import { formatMoney, formatPct } from '../domain/money'
import { buildCsv, downloadCsv } from '../domain/csv'
import { downloadState, normalizeState } from '../domain/storage'
import type { Action } from '../state/reducer'
import { useToast } from '../state/useToast'
import { SCOPE_LABELS, type AppState, type Goal, type GoalScope, type Person } from '../domain/types'

interface Props {
  state: AppState
  dispatch: Dispatch<Action>
}

const LOCALES = [
  { value: '', label: 'Automático (el del navegador)' },
  { value: 'es-CL', label: 'Español (Chile)' },
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'es-MX', label: 'Español (México)' },
  { value: 'es-AR', label: 'Español (Argentina)' },
  { value: 'es-CO', label: 'Español (Colombia)' },
  { value: 'es-PE', label: 'Español (Perú)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
]

export function AjustesPage({ state, dispatch }: Props) {
  const { settings, people, expenses } = state
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const money = (value: number) => formatMoney(value, settings)

  const updatePerson = (person: Person, patch: Partial<Person>) =>
    dispatch({ type: 'person/upsert', person: { ...person, ...patch } })

  const updateGoal = (goal: Goal, patch: Partial<Goal>) =>
    dispatch({ type: 'goal/upsert', goal: { ...goal, ...patch } })

  const removeGoal = (goal: Goal) => {
    const snapshot = state
    dispatch({ type: 'goal/remove', id: goal.id })
    toast.push({
      message: `«${goal.name}» eliminada`,
      tone: 'warn',
      action: { label: 'Deshacer', run: () => dispatch({ type: 'state/import', state: snapshot }) },
    })
  }

  const onImport = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = normalizeState(JSON.parse(text))
      dispatch({ type: 'state/import', state: parsed })
      toast.push({ message: 'Datos importados correctamente', tone: 'good' })
    } catch {
      toast.push({
        message: 'No pude leer ese archivo: debe ser un JSON exportado desde esta app',
        tone: 'warn',
        duration: 6000,
      })
    }
  }

  const goalsPct = settings.goals.reduce((acc, goal) => acc + goal.pct, 0)

  return (
    <div className="stack stack--reveal">
      <Card
        title="Grupo"
        subtitle="Vale para parejas, familias o compañeros de piso: cada persona aporta el mismo % de su sueldo. El sueldo base se usa como valor por defecto de cada mes."
        actions={
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              const index = people.length
              dispatch({
                type: 'person/upsert',
                person: {
                  id: newId('p'),
                  name: `Persona ${index + 1}`,
                  color: PERSON_COLORS[index % PERSON_COLORS.length] ?? '#2dd4bf',
                  salary: 0,
                },
              })
            }}
          >
            + Persona
          </Button>
        }
      >
        <div className="stack">
          {people.map((person) => (
            <div key={person.id} className="personrow">
              <div className="personrow__color">
                <Field label="Color">
                  <ColorPicker
                    value={person.color}
                    colors={PERSON_COLORS}
                    ariaLabel={`Color de ${person.name}`}
                    onChange={(color) => updatePerson(person, { color })}
                  />
                </Field>
              </div>
              <Field label="Nombre">
                <TextInput
                  value={person.name}
                  onChange={(event) => updatePerson(person, { name: event.target.value })}
                />
              </Field>
              <Field label="Sueldo base mensual" hint={`Aporte con este sueldo: ${money(person.salary)}`}>
                <MoneyInput
                  value={person.salary}
                  decimals={settings.decimals}
                  symbol={settings.currencySymbol}
                  onChange={(value) => updatePerson(person, { salary: value })}
                />
              </Field>
              <IconButton
                aria-label={`Quitar a ${person.name}`}
                disabled={people.length <= 1}
                onClick={() => {
                  const snapshot = state
                  dispatch({ type: 'person/remove', id: person.id })
                  toast.push({
                    message: `${person.name} salió del grupo`,
                    tone: 'warn',
                    action: {
                      label: 'Deshacer',
                      run: () => dispatch({ type: 'state/import', state: snapshot }),
                    },
                  })
                }}
              >
                ✕
              </IconButton>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Metas"
        subtitle="Cada meta aparta un porcentaje del sueldo de cada persona: ahorro propio, vacaciones, aporte a los padres, caridad, lo que necesites."
        actions={
          <Button
            size="sm"
            variant="primary"
            onClick={() => dispatch({ type: 'goal/upsert', goal: goalTemplate(settings.goals.length) })}
          >
            + Meta
          </Button>
        }
      >
        <ul className="goalist goalist--editable">
          {settings.goals.map((goal) => (
            <li className="goalist__item goalist__item--editable" key={goal.id}>
              <span className="goalist__icon">
                {goal.icon ? (
                  <ExpenseIcon slug={goal.icon} size={22} color={goal.color} />
                ) : (
                  <span className="legend__dot" style={{ background: goal.color }} />
                )}
              </span>

              <Field label="Nombre">
                <TextInput
                  value={goal.name}
                  placeholder="Aporte a los padres, iglesia, caridad…"
                  onChange={(event) => updateGoal(goal, { name: event.target.value })}
                />
              </Field>

              <Field label="% del sueldo">
                <MoneyInput
                  value={goal.pct}
                  decimals={0}
                  suffix="%"
                  onChange={(pct) => updateGoal(goal, { pct: Math.max(0, pct) })}
                />
              </Field>

              <Field label="Ámbito" hint="Personal: se sigue por persona. Conjunta: un solo fondo.">
                <Select
                  value={goal.scope}
                  ariaLabel={`Ámbito de ${goal.name}`}
                  options={(['personal', 'joint'] as GoalScope[]).map((scope) => ({
                    value: scope,
                    label: SCOPE_LABELS[scope],
                  }))}
                  onChange={(scope) => updateGoal(goal, { scope: scope as GoalScope })}
                />
              </Field>

              <Field label="Icono">
                <Select
                  value={goal.icon ?? ''}
                  ariaLabel="Icono de la meta"
                  placeholder="Sin icono"
                  options={[
                    { value: '', label: 'Sin icono' },
                    ...ICONS.map((icon) => ({
                      value: icon.slug,
                      label: icon.label,
                      icon: <ExpenseIcon slug={icon.slug} size={16} />,
                    })),
                  ]}
                  onChange={(icon) => updateGoal(goal, { icon: icon || undefined })}
                />
              </Field>

              <Field label="Color">
                <ColorPicker
                  value={goal.color}
                  colors={GOAL_COLORS}
                  ariaLabel={`Color de ${goal.name}`}
                  onChange={(color) => updateGoal(goal, { color })}
                />
              </Field>

              <IconButton aria-label={`Eliminar la meta ${goal.name}`} onClick={() => removeGoal(goal)}>
                ✕
              </IconButton>
            </li>
          ))}
        </ul>

        <p className="u-muted u-small">
          Las metas suman <strong>{goalsPct} %</strong> del sueldo de cada persona. Si junto con los
          gastos compartidos pasan del 100 %, la app te avisa en Resumen.
        </p>
      </Card>

      <Card title="Formato de moneda" subtitle="La app es agnóstica a la moneda: símbolo libre, código ISO o nada.">
        <div className="grid grid--4">
          <Field label="Símbolo" hint="Ej: $, €, S/, R$">
            <TextInput
              value={settings.currencySymbol}
              placeholder="$"
              onChange={(event) =>
                dispatch({ type: 'settings/patch', patch: { currencySymbol: event.target.value } })
              }
            />
          </Field>
          <Field label="Código ISO" hint="Opcional. Ej: CLP, EUR, MXN">
            <TextInput
              value={settings.currencyCode}
              placeholder="CLP"
              onChange={(event) =>
                dispatch({ type: 'settings/patch', patch: { currencyCode: event.target.value } })
              }
            />
          </Field>
          <Field label="Decimales" hint="También define el redondeo del reparto.">
            <NumberInput
              value={settings.decimals}
              decimals={0}
              min={0}
              max={4}
              onChange={(value) =>
                dispatch({
                  type: 'settings/patch',
                  patch: { decimals: Math.min(4, Math.max(0, Math.round(value))) },
                })
              }
            />
          </Field>
          <Field label="Idioma / locale">
            <Select
              value={settings.locale}
              ariaLabel="Idioma"
              options={LOCALES}
              onChange={(locale) => dispatch({ type: 'settings/patch', patch: { locale } })}
            />
          </Field>
        </div>
        <p className="u-muted">
          Vista previa: <strong>{money(1234.56)}</strong> · porcentaje{' '}
          <strong>{formatPct(0.428, settings)}</strong>
        </p>
      </Card>

      <Card title="Alertas" subtitle="Cuándo quieres que la app te avise.">
        <div className="grid grid--3">
          <Field label="Avisar si los gastos superan (%)" hint="Del ingreso combinado">
            <MoneyInput
              value={settings.expenseWarnPct}
              decimals={0}
              suffix="%"
              onChange={(value) =>
                dispatch({ type: 'settings/patch', patch: { expenseWarnPct: value } })
              }
            />
          </Field>
          <Field label="Avisar si las suscripciones superan (%)">
            <MoneyInput
              value={settings.subscriptionWarnPct}
              decimals={0}
              suffix="%"
              onChange={(value) =>
                dispatch({ type: 'settings/patch', patch: { subscriptionWarnPct: value } })
              }
            />
          </Field>
          <Field label="Días de antelación para vencimientos">
            <NumberInput
              value={settings.dueSoonDays}
              decimals={0}
              min={0}
              max={30}
              onChange={(value) =>
                dispatch({ type: 'settings/patch', patch: { dueSoonDays: Math.max(0, Math.round(value)) } })
              }
            />
          </Field>
        </div>
      </Card>

      <Card title="Tus datos" subtitle="Todo se guarda solo en este navegador. Nada sale de tu dispositivo.">
        <div className="u-row u-row--wrap u-row--gap">
          <Button variant="subtle" onClick={() => downloadState(state)}>
            ⬇️ Exportar JSON
          </Button>
          <Button variant="subtle" onClick={() => downloadCsv(buildCsv(state))}>
            📊 Exportar CSV
          </Button>
          <Button variant="subtle" onClick={() => fileRef.current?.click()}>
            ⬆️ Importar JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void onImport(file)
              event.target.value = ''
            }}
          />
          <Button
            variant="subtle"
            onClick={() => {
              const snapshot = state
              dispatch({ type: 'state/demo' })
              toast.push({
                message: 'Datos de ejemplo cargados',
                tone: 'info',
                action: {
                  label: 'Deshacer',
                  run: () => dispatch({ type: 'state/import', state: snapshot }),
                },
              })
            }}
          >
            🧪 Cargar datos de ejemplo
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const snapshot = state
              dispatch({ type: 'state/empty' })
              toast.push({
                message: 'Todos los datos borrados',
                tone: 'warn',
                action: {
                  label: 'Deshacer',
                  run: () => dispatch({ type: 'state/import', state: snapshot }),
                },
              })
            }}
          >
            🗑️ Empezar de cero
          </Button>
        </div>
        <div className="u-row u-row--wrap u-row--gap u-mt">
          <Badge>{people.length} personas</Badge>
          <Badge>{expenses.length} gastos en el catálogo</Badge>
          <Badge>{settings.goals.length} metas</Badge>
          <Badge>{Object.keys(state.months).length} meses guardados</Badge>
          {state.demo && <Badge tone="warn">Datos de ejemplo</Badge>}
        </div>
        <p className="u-muted u-small u-mt">
          Exporta un JSON antes de borrar: el deshacer solo alcanza mientras la pestaña siga abierta.
        </p>
      </Card>

      <Card
        title="Iconografía"
        subtitle="24 iconos monocromos generados con gpt-image-2.5 en fal.ai y recortados por scripts/slice-icons.mjs."
      >
        <div className="iconpicker__grid">
          {ICONS.map((icon) => (
            <span
              key={icon.slug}
              className="iconpicker__option"
              title={icon.label}
              aria-hidden="true"
            >
              <ExpenseIcon slug={icon.slug} size={24} />
            </span>
          ))}
        </div>
      </Card>

      <Card title="Cómo se calcula" subtitle="La fórmula del reparto equitativo.">
        <div className="formula">
          <code className="formula__code">
            % = Gastos compartidos ÷ (sueldo₁ + sueldo₂ + …)
            <br />
            aporteᵢ = sueldoᵢ × %
          </code>
        </div>
        <ul className="legend legend--plain">
          <li>
            Como el porcentaje es el mismo, <strong>el esfuerzo relativo es idéntico</strong> aunque
            los sueldos sean distintos: quien gana más aporta más dinero, no en proporción.
          </li>
          <li>
            El redondeo usa el método del resto mayor, así que la suma de los aportes coincide
            siempre, al céntimo, con el total de los gastos.
          </li>
          <li>
            Cada uno transfiere su porción al <strong>fondo común</strong> y desde ahí se pagan las
            facturas: nadie le debe a nadie y no hay que recalcular devoluciones.
          </li>
          <li>
            Las <strong>metas</strong> son un porcentaje del sueldo de cada persona y se acumulan por
            separado; mientras no registres el monto real, se muestra la meta.
          </li>
        </ul>
      </Card>
    </div>
  )
}
