import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
  /** iguala el ancho del panel al del disparador */
  matchWidth?: boolean
  minWidth?: number
  className?: string
}

/** espacio mínimo que debe quedar debajo para no voltear el panel hacia arriba */
const MIN_SPACE_BELOW = 220
const MAX_HEIGHT = 320

/**
 * Panel flotante propio: se dibuja en un portal con posición fija, así no lo
 * recorta el `overflow` de las tarjetas ni lo atrapa un `transform` del padre.
 *
 * Se coloca en **una sola pasada**, midiendo solo el ancla y limitando el alto
 * con `max-height`. Antes se medía el panel en dos pasadas ocultándolo con una
 * mutación directa del DOM (`panel.style.visibility = 'hidden'`) y pidiendo
 * después lo mismo a React: en la segunda apertura React no veía cambios, no
 * escribía nada y el panel quedaba invisible aunque estuviera en el DOM. El
 * síntoma era justo «el desplegable funciona una vez y luego no».
 *
 * Al hacer scroll **se recoloca**, no se cierra: cerrar con cualquier scroll
 * hacía que desapareciera al pasar el ratón por una opción o al pulsar una
 * flecha (ambos provocan un desplazamiento para dejar visible la opción activa).
 */
export function Popover({
  open,
  anchorRef,
  onClose,
  children,
  matchWidth = true,
  minWidth = 180,
  className = '',
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({
    position: 'fixed',
    visibility: 'hidden',
  })

  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef.current
    if (!anchor) return

    let frame = 0

    const place = () => {
      frame = 0
      const rect = anchor.getBoundingClientRect()
      // el disparador ya no está en pantalla: sí conviene cerrar
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        onClose()
        return
      }

      const width = Math.max(minWidth, matchWidth ? rect.width : minWidth)
      const spaceBelow = window.innerHeight - rect.bottom - 12
      const spaceAbove = rect.top - 12
      const openUp = spaceBelow < MIN_SPACE_BELOW && spaceAbove > spaceBelow
      const available = Math.max(120, openUp ? spaceAbove : spaceBelow)

      setStyle({
        position: 'fixed',
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
        maxHeight: Math.min(MAX_HEIGHT, available),
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 6, top: 'auto' }
          : { top: rect.bottom + 6, bottom: 'auto' }),
        visibility: 'visible',
      })
    }

    /** una sola recolocación por frame, aunque lleguen muchos eventos */
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place)
    }

    place()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onClose()
    }

    const onScroll = (event: Event) => {
      const target = event.target
      // el scroll de la propia lista de opciones no mueve el ancla: se ignora
      if (target instanceof Node && panelRef.current?.contains(target)) return
      schedule()
    }

    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', schedule)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', schedule)
    }
  }, [open, anchorRef, matchWidth, minWidth, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div ref={panelRef} className={`popover ${className}`} style={style} role="presentation">
      {children}
    </div>,
    document.body,
  )
}
