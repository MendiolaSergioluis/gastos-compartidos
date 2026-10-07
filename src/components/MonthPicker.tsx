import { useCallback, useEffect, useRef, useState } from 'react'
import { parseMonthId } from '../domain/finance'
import { Popover } from './Popover'

interface Props {
  value: string
  onChange: (monthId: string) => void
  locale: string
  label?: (monthId: string) => string
}

/**
 * Selector de mes propio: nada de `<input type="month">`, que cambia de aspecto
 * (y de idioma) según el navegador. Rejilla de 12 meses con navegación de año.
 */
export function MonthPicker({ value, onChange, locale, label }: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const current = parseMonthId(value)
  const [viewYear, setViewYear] = useState(current.year)
  const [cursor, setCursor] = useState(current.month - 1)

  useEffect(() => {
    if (open) gridRef.current?.focus({ preventScroll: true })
  }, [open])

  const close = useCallback(() => setOpen(false), [])

  const openPanel = () => {
    // el mes visible se fija en el evento que abre, no en un efecto
    setViewYear(current.year)
    setCursor(current.month - 1)
    setOpen(true)
  }

  const format = (year: number, month: number, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale.trim() === '' ? undefined : locale, options).format(
      new Date(year, month, 1),
    )

  const monthNames = Array.from({ length: 12 }, (_, index) =>
    format(viewYear, index, { month: 'short' }).replace('.', ''),
  )

  const pick = (monthIndex: number) => {
    onChange(`${viewYear}-${String(monthIndex + 1).padStart(2, '0')}`)
    setOpen(false)
    triggerRef.current?.focus({ preventScroll: true })
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const columns = 3
    let next = cursor
    if (event.key === 'ArrowRight') next = (cursor + 1) % 12
    else if (event.key === 'ArrowLeft') next = (cursor + 11) % 12
    else if (event.key === 'ArrowDown') next = (cursor + columns) % 12
    else if (event.key === 'ArrowUp') next = (cursor + 12 - columns) % 12
    else if (event.key === 'PageUp') {
      event.preventDefault()
      setViewYear((year) => year - 1)
      return
    } else if (event.key === 'PageDown') {
      event.preventDefault()
      setViewYear((year) => year + 1)
      return
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      pick(cursor)
      return
    } else {
      return
    }
    event.preventDefault()
    setCursor(next)
  }

  const visible = label
    ? label(value)
    : format(current.year, current.month - 1, { month: 'long', year: 'numeric' })

  return (
    <div className="monthpicker">
      <button
        ref={triggerRef}
        type="button"
        className={`monthpicker__trigger ${open ? 'monthpicker__trigger--open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Elegir mes: ${visible}`}
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        <span className="monthpicker__value">{visible}</span>
        <span className="monthpicker__caret" aria-hidden="true" />
      </button>

      <Popover open={open} anchorRef={triggerRef} onClose={close} minWidth={252}>
        <div className="monthpicker__panel" role="dialog" aria-label="Elegir mes">
          <div className="monthpicker__head">
            <button
              type="button"
              className="monthpicker__nav"
              aria-label="Año anterior"
              onClick={() => setViewYear((year) => year - 1)}
            >
              ‹
            </button>
            <strong>{viewYear}</strong>
            <button
              type="button"
              className="monthpicker__nav"
              aria-label="Año siguiente"
              onClick={() => setViewYear((year) => year + 1)}
            >
              ›
            </button>
          </div>

          <div
            ref={gridRef}
            className="monthpicker__grid"
            role="grid"
            tabIndex={-1}
            onKeyDown={onKeyDown}
          >
            {monthNames.map((name, index) => {
              const isSelected =
                viewYear === current.year && index === current.month - 1
              return (
                <button
                  key={name}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  className={`monthpicker__month ${isSelected ? 'monthpicker__month--selected' : ''} ${
                    index === cursor ? 'monthpicker__month--cursor' : ''
                  }`}
                  onPointerEnter={() => setCursor(index)}
                  onClick={() => pick(index)}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>
      </Popover>
    </div>
  )
}
