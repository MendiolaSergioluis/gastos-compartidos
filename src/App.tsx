import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { currentMonthId, computeMonth, monthLabel, shiftMonth } from './domain/finance'
import { suggestAdvice } from './domain/advice'
import { AjustesPage } from './pages/AjustesPage'
import { GastosPage } from './pages/GastosPage'
import { HistorialPage } from './pages/HistorialPage'
import { MesPage } from './pages/MesPage'
import { MetasPage } from './pages/MetasPage'
import { ResumenPage } from './pages/ResumenPage'
import { MonthPicker } from './components/MonthPicker'

/**
 * Las páginas van en el mismo paquete a propósito: se midió el troceado por
 * ruta y el service worker precachea todo igual, así que la ganancia en el
 * primer pintado (~100 ms) no compensaba la complejidad. Ver docs/perf.md.
 */
import { TabIcon } from './components/TabIcon'
import { Button, IconButton } from './components/ui'
import { useStore } from './state/useStore'
import { useSelectedMonth, useStandalone, useTheme } from './state/ui'
import { useToast } from './state/useToast'
import { onUpdateReady } from './sw'

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'mes', label: 'Mes' },
  { id: 'gastos', label: 'Gastos' },
  { id: 'metas', label: 'Metas' },
  { id: 'historial', label: 'Historial' },
  { id: 'ajustes', label: 'Ajustes' },
] as const

export type Tab = (typeof TABS)[number]['id']

const TAB_IDS = TABS.map((item) => item.id) as readonly string[]

/** La pestaña vive también en el hash: permite enlazar y compartir una sección. */
function tabFromHash(): Tab {
  const hash = window.location.hash.replace('#', '')
  return (TAB_IDS.includes(hash) ? hash : 'resumen') as Tab
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

export default function App() {
  const { state, dispatch } = useStore()
  const [monthId, setMonthId] = useSelectedMonth()
  const [theme, toggleTheme] = useTheme()
  const [tab, setTab] = useState<Tab>(() => (typeof window === 'undefined' ? 'resumen' : tabFromHash()))
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const standalone = useStandalone()
  const toast = useToast()
  const firstRender = useRef(true)

  const result = useMemo(() => computeMonth(state, monthId), [state, monthId])
  const advice = useMemo(() => suggestAdvice(state, result), [state, result])

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    return onUpdateReady((update) => {
      toast.push({
        message: 'Hay una versión nueva de la app',
        tone: 'info',
        duration: 0,
        action: { label: 'Actualizar', run: update },
      })
    })
  }, [toast])

  // acuse de recibo visual: cada cambio de estado enciende el punto "guardado"
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setJustSaved(true)
    const timer = setTimeout(() => setJustSaved(false), 1400)
    return () => clearTimeout(timer)
  }, [state])

  /**
   * El cambio de sección se aplica SIEMPRE y de forma síncrona.
   *
   * Antes vivía dentro del callback de `document.startViewTransition`, y eso
   * perdía pulsaciones: si se lanzaba una transición mientras otra estaba en
   * curso, Chrome descartaba la nueva y su callback no llegaba a ejecutarse, así
   * que la pestaña pulsada no cambiaba. La animación de entrada la hace el CSS
   * (`.stack--reveal` / `.layout--reveal`), que no puede tragarse nada.
   */
  const changeTab = useCallback((next: Tab) => {
    setTab(next)
    try {
      window.history.replaceState(null, '', `#${next}`)
    } catch {
      /* en file:// el historial puede no estar disponible */
    }
  }, [])

  // atrás/adelante del navegador y ediciones del hash también cambian de sección
  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const isCurrentMonth = monthId === currentMonthId()

  const navItems = (block: string) =>
    TABS.map((item) => (
      <button
        key={item.id}
        type="button"
        className={`${block}__item ${tab === item.id ? `${block}__item--active` : ''}`}
        aria-current={tab === item.id ? 'page' : undefined}
        onClick={() => changeTab(item.id)}
      >
        <span className={`${block}__icon`} aria-hidden="true">
          <TabIcon name={item.id} size={18} />
        </span>
        <span className={`${block}__label`}>{item.label}</span>
      </button>
    ))

  return (
    <div className="app">
      <a className="app__skip" href="#contenido">
        Saltar al contenido
      </a>

      <header className="topbar">
        <div className="topbar__inner">
          <div className="brand">
            <img className="brand__mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
            <div className="brand__text">
              <h1 className="brand__name">Gastos Compartidos</h1>
              <span className="brand__meta">
                {monthLabel(monthId, state.settings)}
                <span
                  className={`brand__saved ${justSaved ? 'brand__saved--on' : ''}`}
                  aria-hidden="true"
                />
                <span className="u-sr-only" role="status">
                  {justSaved ? 'Cambios guardados' : ''}
                </span>
              </span>
            </div>
          </div>

          <div className="monthnav">
            <IconButton aria-label="Mes anterior" onClick={() => setMonthId(shiftMonth(monthId, -1))}>
              ‹
            </IconButton>
            <MonthPicker
              value={monthId}
              onChange={setMonthId}
              locale={state.settings.locale}
              label={(value) => monthLabel(value, state.settings)}
            />
            <IconButton aria-label="Mes siguiente" onClick={() => setMonthId(shiftMonth(monthId, 1))}>
              ›
            </IconButton>
            {!isCurrentMonth && (
              <Button size="sm" variant="ghost" onClick={() => setMonthId(currentMonthId())}>
                Hoy
              </Button>
            )}
          </div>

          <div className="topbar__actions">
            {installEvent && !standalone && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void installEvent.prompt()
                  setInstallEvent(null)
                }}
              >
                Instalar
              </Button>
            )}
            <IconButton
              aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </IconButton>
          </div>
        </div>

        <nav className="nav nav--tabs" aria-label="Secciones">
          {navItems('nav')}
        </nav>
      </header>

      <main className="app__content" id="contenido" key={tab}>
        {tab === 'resumen' && (
          <ResumenPage
            state={state}
            dispatch={dispatch}
            monthId={monthId}
            result={result}
            advice={advice}
            onNavigate={changeTab}
          />
        )}
        {tab === 'mes' && <MesPage state={state} dispatch={dispatch} monthId={monthId} result={result} />}
        {tab === 'gastos' && (
          <GastosPage state={state} dispatch={dispatch} monthId={monthId} result={result} />
        )}
        {tab === 'metas' && <MetasPage state={state} dispatch={dispatch} monthId={monthId} result={result} />}
        {tab === 'historial' && (
          <HistorialPage
            state={state}
            monthId={monthId}
            onSelectMonth={(value) => {
              setMonthId(value)
              changeTab('resumen')
            }}
          />
        )}
        {tab === 'ajustes' && <AjustesPage state={state} dispatch={dispatch} />}
      </main>

      <footer className="app__footer">
        <span>
          {state.people.length} personas · {state.expenses.length} gastos · {state.settings.goals.length}{' '}
          metas · datos solo en este dispositivo
        </span>
      </footer>

      <nav className="nav nav--bottom" aria-label="Secciones">
        {navItems('nav')}
      </nav>
    </div>
  )
}
