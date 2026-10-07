import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Popover } from './Popover'

export interface SelectOption {
  value: string
  label: string
  /** texto secundario a la derecha */
  hint?: string
  icon?: ReactNode
  disabled?: boolean
}

interface Props {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  /** etiqueta accesible cuando no hay un <label> visible */
  ariaLabel?: string
  placeholder?: string
  className?: string
  compact?: boolean
  disabled?: boolean
}

/**
 * Selector propio: nada de `<select>` nativo, así se ve igual en todos los
 * navegadores. Soporta teclado (flechas, inicio/fin, letra inicial, Enter,
 * Escape) y se dibuja en un portal para que no lo recorte ninguna tarjeta.
 */
export function Select({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = 'Selecciona…',
  className = '',
  compact = false,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const typed = useRef('')
  const listId = useId()

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined

  const openList = () => {
    if (disabled) return
    setActive(Math.max(0, selectedIndex))
    setOpen(true)
  }

  useEffect(() => {
    const list = listRef.current
    if (!open || !list) return
    list.focus({ preventScroll: true })

    const node = list.querySelector<HTMLElement>('[data-active="true"]')
    if (!node) return
    // Se desplaza la lista, nunca la página: mover el scroll del documento
    // obligaba al panel a recolocarse (y antes lo cerraba sin motivo).
    const listRect = list.getBoundingClientRect()
    const nodeRect = node.getBoundingClientRect()
    if (nodeRect.top < listRect.top) list.scrollTop += nodeRect.top - listRect.top
    else if (nodeRect.bottom > listRect.bottom) {
      list.scrollTop += nodeRect.bottom - listRect.bottom
    }
  }, [open, active])

  const close = useCallback(() => setOpen(false), [])

  const commit = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus({ preventScroll: true })
  }

  const move = (delta: number) => {
    if (options.length === 0) return
    let next = active
    for (let step = 0; step < options.length; step += 1) {
      next = (next + delta + options.length) % options.length
      if (!options[next]?.disabled) break
    }
    setActive(next)
  }

  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Home':
        event.preventDefault()
        setActive(0)
        break
      case 'End':
        event.preventDefault()
        setActive(options.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        commit(active)
        break
      case 'Tab':
        setOpen(false)
        break
      default: {
        // salto por letra inicial
        if (event.key.length !== 1) return
        typed.current = (typed.current + event.key).toLowerCase()
        const index = options.findIndex((option) =>
          option.label.toLowerCase().startsWith(typed.current),
        )
        if (index >= 0) setActive(index)
        window.setTimeout(() => {
          typed.current = ''
        }, 700)
      }
    }
  }

  return (
    <div className={`select ${compact ? 'select--compact' : ''} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`select__trigger ${open ? 'select__trigger--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            openList()
          }
        }}
      >
        {selected?.icon && <span className="select__icon">{selected.icon}</span>}
        <span className={`select__label ${selected ? '' : 'select__label--empty'}`}>
          {selected?.label ?? placeholder}
        </span>
        {selected?.hint && <span className="select__hint">{selected.hint}</span>}
        <span className="select__caret" aria-hidden="true" />
      </button>

      <Popover
        open={open}
        anchorRef={triggerRef}
        onClose={close}
        minWidth={200}
        className="popover--list"
      >
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={`${listId}-${active}`}
          className="select__list"
          onKeyDown={onListKeyDown}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              data-active={index === active}
              className={`select__option ${option.value === value ? 'select__option--selected' : ''} ${
                index === active ? 'select__option--active' : ''
              } ${option.disabled ? 'select__option--disabled' : ''}`}
              onPointerEnter={() => setActive(index)}
              onClick={() => commit(index)}
            >
              {option.icon && <span className="select__icon">{option.icon}</span>}
              <span className="select__option-label">{option.label}</span>
              {option.hint && <span className="select__hint">{option.hint}</span>}
              {option.value === value && (
                <span className="select__check" aria-hidden="true">
                  ✓
                </span>
              )}
            </div>
          ))}
        </div>
      </Popover>
    </div>
  )
}
