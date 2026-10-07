import { useCallback, useEffect, useState } from 'react'
import { currentMonthId } from '../domain/finance'

const MONTH_KEY = 'gastos-pareja.month'
const THEME_KEY = 'gastos-pareja.theme'

export type Theme = 'dark' | 'light'

export function useSelectedMonth(): [string, (value: string) => void] {
  const [monthId, setMonthId] = useState<string>(() => {
    if (typeof localStorage === 'undefined') return currentMonthId()
    const stored = localStorage.getItem(MONTH_KEY)
    return stored && /^\d{4}-\d{2}$/.test(stored) ? stored : currentMonthId()
  })

  const update = useCallback((value: string) => {
    setMonthId(value)
    try {
      localStorage.setItem(MONTH_KEY, value)
    } catch {
      /* ignora almacenamiento no disponible */
    }
  }, [])

  return [monthId, update]
}

function preferredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(preferredTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignora almacenamiento no disponible */
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return [theme, toggle]
}

/** true cuando la app corre instalada como PWA (standalone). */
export function useStandalone(): boolean {
  const [standalone, setStandalone] = useState(
    () => window.matchMedia?.('(display-mode: standalone)').matches ?? false,
  )
  useEffect(() => {
    const query = window.matchMedia('(display-mode: standalone)')
    const listener = (event: MediaQueryListEvent) => setStandalone(event.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])
  return standalone
}
