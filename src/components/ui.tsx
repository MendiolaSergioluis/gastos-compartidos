import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type FocusEventHandler,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { formatMoney, parseNumber } from '../domain/money'
import type { Warning } from '../domain/finance'
import { GENERATED_ICON_SLUGS } from '../domain/icon-assets'
import { ICONS, iconFallback, iconUrl, iconsForCategory } from '../domain/icons'
import { CATEGORY_LABELS, type ExpenseCategory, type Settings } from '../domain/types'

/* ---------------------------------- card --------------------------------- */

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
  style,
  padded = true,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
  padded?: boolean
}) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || actions) && (
        <header className="card__head">
          <div className="card__heading">
            {title && <h2 className="card__title">{title}</h2>}
            {subtitle && <p className="card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'card__body' : 'card__body card__body--flush'}>{children}</div>
    </section>
  )
}

/* ---------------------------------- stat --------------------------------- */

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent'
}) {
  return (
    <div className={`stat stat--${tone}`}>
      <span className="stat__label">{label}</span>
      <strong className="stat__value">{value}</strong>
      {hint && <span className="stat__hint">{hint}</span>}
    </div>
  )
}

/* -------------------------------- progress ------------------------------- */

export function Progress({
  value,
  max,
  color,
  label,
}: {
  value: number
  max: number
  color?: string
  /** nombre accesible: un progressbar sin nombre no dice nada a un lector de pantalla */
  label: string
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="progress__fill" style={{ width: `${ratio * 100}%`, background: color }} />
    </div>
  )
}

/* --------------------------------- badge --------------------------------- */

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent'
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

/* --------------------------------- botón --------------------------------- */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'subtle' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'subtle', size = 'md', className = '', ...rest }: ButtonProps) {
  return <button className={`btn btn--${variant} btn--${size} ${className}`} {...rest} />
}

export function IconButton({
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`iconbtn ${className}`} {...rest} />
}

/* --------------------------------- campos -------------------------------- */

export function Field({
  label,
  hint,
  children,
  className = '',
  full = false,
}: {
  label?: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
  full?: boolean
}) {
  return (
    <label className={`field ${full ? 'field--full' : ''} ${className}`}>
      {label && <span className="field__label">{label}</span>}
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  )
}

export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...rest} />
}

function plainNumber(value: number, decimals: number): string {
  const safe = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe)
}

/**
 * Entrada numérica tolerante: acepta "1.234,56", "1,234.56" o "1200".
 * Confirma al salir del campo o con Enter (no en cada tecla), así el panel no
 * recalcula con valores intermedios mientras se escribe. Escape cancela.
 */
export function NumberInput({
  value,
  onChange,
  decimals = 2,
  suffix,
  prefix,
  className = '',
  onBlur,
  withApply = false,
  applyLabel = 'Aplicar el cambio',
  blankWhenZero = false,
  selectOnFocus = false,
  placeholder,
  ...rest
}: {
  value: number
  onChange: (value: number) => void
  decimals?: number
  suffix?: string
  prefix?: string
  className?: string
  onBlur?: FocusEventHandler<HTMLInputElement>
  /** muestra un botón para aplicar lo escrito sin salir del campo */
  withApply?: boolean
  applyLabel?: string
  /**
   * Con valor 0 el campo se ve vacío, con un 0 de referencia en gris, en vez de
   * "0.00". En un campo que arranca en cero, escribir sobre un "0.00" pegado al
   * cursor produce cosas como "0.00200"; vacío se escribe de corrido.
   */
  blankWhenZero?: boolean
  /**
   * Al entrar en el campo se selecciona lo que hay, para reemplazarlo escribiendo
   * en vez de meter dígitos en medio del número anterior.
   */
  selectOnFocus?: boolean
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur' | 'prefix'>) {
  const [draft, setDraft] = useState<string | null>(null)
  const dirty = draft !== null && parseNumber(draft, decimals) !== value
  const blank = blankWhenZero && value === 0

  /**
   * Lo escrito no puede perderse al salir del campo por otra vía.
   *
   * Salir con Tab, con Enter o pulsando fuera ya lo guardaba, pero cambiar de
   * sección con atrás/adelante del navegador —o editar el hash— desmontaba el
   * campo y el texto pendiente se descartaba en silencio. Se guarda al
   * desmontar y también cuando la pestaña pasa a segundo plano.
   */
  const latest = useRef<{
    draft: string | null
    value: number
    decimals: number
    onChange: (value: number) => void
  }>({ draft, value, decimals, onChange })

  /**
   * El borrador se copia al ref dentro del manejador del evento y no durante el
   * render: escribir un ref en render incumple las reglas de React y, con
   * renderizado concurrente, un render descartado dejaría el ref con datos que
   * nunca llegaron a pintarse. El resto de campos se sincroniza al confirmar.
   */
  const edit = (next: string | null) => {
    latest.current = { ...latest.current, draft: next }
    setDraft(next)
  }

  useEffect(() => {
    latest.current = { ...latest.current, value, decimals, onChange }
  })

  const commit = () => {
    if (draft === null) return
    const parsed = parseNumber(draft, decimals)
    edit(null)
    if (parsed !== value) onChange(parsed)
  }

  useEffect(() => {
    const flush = () => {
      const current = latest.current
      if (current.draft === null) return
      const parsed = parseNumber(current.draft, current.decimals)
      if (parsed !== current.value) current.onChange(parsed)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [])

  return (
    <span className={`numberfield ${dirty ? 'numberfield--dirty' : ''} ${className}`}>
      {prefix && <span className="numberfield__prefix">{prefix}</span>}
      <input
        className="input numberfield__input"
        type="text"
        inputMode="decimal"
        value={draft ?? (blank ? '' : plainNumber(value, decimals))}
        placeholder={placeholder ?? (blankWhenZero ? plainNumber(0, decimals) : undefined)}
        onFocus={(event) => {
          edit(blank ? '' : plainNumber(value, decimals))
          if (selectOnFocus && !blank) event.currentTarget.select()
        }}
        onChange={(event) => edit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit()
            event.currentTarget.blur()
          }
          if (event.key === 'Escape') {
            edit(null)
            event.currentTarget.blur()
          }
        }}
        onBlur={(event) => {
          commit()
          onBlur?.(event)
        }}
        {...rest}
      />
      {suffix && <span className="numberfield__suffix">{suffix}</span>}
      {withApply && (
        <button
          type="button"
          className={`numberfield__apply ${dirty ? 'numberfield__apply--pending' : ''}`}
          disabled={!dirty}
          aria-label={applyLabel}
          title={dirty ? applyLabel : 'Sin cambios pendientes'}
          onClick={commit}
        >
          ✓
        </button>
      )}
    </span>
  )
}

export function MoneyInput({
  value,
  onChange,
  decimals,
  symbol = '',
  suffix,
  withApply,
  applyLabel,
  blankWhenZero,
  selectOnFocus,
  ...rest
}: {
  value: number
  onChange: (value: number) => void
  decimals: number
  symbol?: string
  suffix?: string
  withApply?: boolean
  applyLabel?: string
  blankWhenZero?: boolean
  selectOnFocus?: boolean
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'prefix'>) {
  return (
    <NumberInput
      value={value}
      onChange={onChange}
      decimals={decimals}
      prefix={symbol || undefined}
      suffix={suffix}
      withApply={withApply}
      applyLabel={applyLabel}
      blankWhenZero={blankWhenZero}
      selectOnFocus={selectOnFocus}
      {...rest}
    />
  )
}

export function Money({
  value,
  settings,
  className = '',
  signed = false,
}: {
  value: number
  settings: Settings
  className?: string
  signed?: boolean
}) {
  return <span className={`money ${className}`}>{formatMoney(value, settings, { signed })}</span>
}

/* -------------------------------- segmentado ------------------------------ */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; hint?: string }[]
}) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.hint}
          aria-pressed={option.value === value}
          className={`segmented__item ${option.value === value ? 'segmented__item--active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/* --------------------------------- modal --------------------------------- */

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('has-modal')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('has-modal')
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal" role="presentation" onClick={onClose}>
      <div
        className="modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <IconButton aria-label="Cerrar" onClick={onClose}>
            ✕
          </IconButton>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  )
}

/* ------------------------------ vacío y avisos ---------------------------- */

export function EmptyState({
  icon = '🗂️',
  title,
  detail,
  action,
}: {
  icon?: string
  title: string
  detail?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden="true">
        {icon}
      </span>
      <strong className="empty__title">{title}</strong>
      {detail && <p className="empty__text">{detail}</p>}
      {action}
    </div>
  )
}

const WARNING_ICONS: Record<Warning['level'], string> = {
  info: 'ℹ️',
  warn: '⚠️',
  danger: '⛔',
}

export function WarningList({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null
  return (
    <ul className="warnings">
      {warnings.map((warning) => (
        <li key={warning.id} className={`warnings__item warnings__item--${warning.level}`}>
          <span className="warnings__icon" aria-hidden="true">
            {WARNING_ICONS[warning.level]}
          </span>
          <div className="warnings__body">
            <strong className="warnings__title">{warning.title}</strong>
            <p className="warnings__text">{warning.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__knob" />
    </button>
  )
}

/* --------------------------------- iconos -------------------------------- */

/**
 * Icono monocromo generado con fal.ai. Se pinta con `mask-image`, así hereda el
 * color que le pasemos (tema o categoría) sin necesidad de más imágenes.
 */
export function ExpenseIcon({
  slug,
  color,
  size = 20,
  className = '',
  title,
}: {
  slug: string
  color?: string
  size?: number
  className?: string
  title?: string
}) {
  const available = GENERATED_ICON_SLUGS.includes(slug)

  if (!available) {
    return (
      <span className={`icon icon--fallback ${className}`} style={{ fontSize: size * 0.92 }} aria-hidden="true">
        {iconFallback(slug)}
      </span>
    )
  }

  return (
    <span
      className={`icon ${className}`}
      title={title}
      aria-hidden="true"
      style={
        {
          '--icon-url': `url("${iconUrl(slug)}")`,
          '--icon-size': `${size}px`,
          ...(color ? { '--icon-color': color } : {}),
        } as CSSProperties
      }
    />
  )
}

export function IconChip({
  slug,
  color,
  size = 20,
  chipSize,
  className = '',
}: {
  slug: string
  color: string
  size?: number
  chipSize?: 'sm' | 'md'
  className?: string
}) {
  return (
    <span
      className={`iconchip ${chipSize === 'sm' ? 'iconchip--sm' : ''} ${className}`}
      style={{ '--chip-color': color } as CSSProperties}
    >
      <ExpenseIcon slug={slug} size={size} />
    </span>
  )
}

export function IconPicker({
  value,
  onChange,
  category,
}: {
  value: string
  onChange: (slug: string) => void
  category: ExpenseCategory
}) {
  const suggested = iconsForCategory(category)
  const others = ICONS.filter((icon) => icon.category !== category)

  const group = (label: string, icons: typeof ICONS) => (
    <div className="iconpicker__group" key={label}>
      <span className="iconpicker__label">{label}</span>
      <div className="iconpicker__grid">
        {icons.map((icon) => (
          <button
            key={icon.slug}
            type="button"
            title={icon.label}
            aria-label={icon.label}
            aria-pressed={icon.slug === value}
            className={`iconpicker__option ${icon.slug === value ? 'iconpicker__option--selected' : ''}`}
            onClick={() => onChange(icon.slug)}
          >
            <ExpenseIcon slug={icon.slug} size={24} />
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="iconpicker">
      {suggested.length > 0 && group(`Sugeridos para ${CATEGORY_LABELS[category]}`, suggested)}
      {group('Todos', others)}
    </div>
  )
}

/* -------------------------------- estructura ------------------------------ */

export function SectionTitle({
  eyebrow,
  title,
  hint,
  actions,
}: {
  eyebrow?: string
  title: string
  hint?: string
  actions?: ReactNode
}) {
  return (
    <div className="sectiontitle">
      <div>
        {eyebrow && <span className="sectiontitle__eyebrow">{eyebrow}</span>}
        <h2 className="sectiontitle__title">{title}</h2>
        {hint && <p className="sectiontitle__hint">{hint}</p>}
      </div>
      {actions && <div className="sectiontitle__actions">{actions}</div>}
    </div>
  )
}
