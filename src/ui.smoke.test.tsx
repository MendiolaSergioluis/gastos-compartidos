// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createDemoState } from './domain/defaults'
import { STORAGE_KEY } from './domain/storage'
import { StoreProvider } from './state/StoreContext'
import { ToastProvider } from './state/ToastProvider'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

/** jsdom no trae matchMedia y la app lo usa para el tema. */
function stubMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

/** Escribe el valor saltándose el tracker de React para que onChange se dispare. */
function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Los campos numéricos confirman al salir del campo, no en cada tecla. */
function blur(input: HTMLInputElement) {
  input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
}

/**
 * Las páginas se cargan en diferido. En vez de sondear el DOM (lo que provoca
 * llamadas a act() solapadas), los trozos se cargan una vez antes de montar; así
 * el asentamiento es un simple vaciado de microtareas.
 */
async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function findButton(root: ParentNode, text: string): HTMLButtonElement | undefined {
  return [...root.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
    button.textContent?.includes(text),
  )
}

async function clickTab(container: HTMLElement, label: string) {
  const tab = findButton(container.querySelector('.nav') ?? container, label)
  expect(tab, `no encontré la pestaña ${label}`).toBeTruthy()
  await act(async () => {
    tab?.click()
  })
  await settle()
}

describe('app de gastos compartidos', () => {
  let container: HTMLDivElement
  let root: Root

  // los trozos diferidos, en la caché de módulos antes de montar nada
  beforeAll(async () => {
    await Promise.all([
      import('./pages/ResumenPage'),
      import('./pages/MesPage'),
      import('./pages/GastosPage'),
      import('./pages/MetasPage'),
      import('./pages/HistorialPage'),
      import('./pages/AjustesPage'),
    ])
  })

  beforeEach(async () => {
    stubMatchMedia()
    localStorage.clear()
    const demo = createDemoState()
    demo.settings = { ...demo.settings, locale: 'en-US', currencySymbol: '$', decimals: 2 }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(
        <StoreProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </StoreProvider>,
      )
    })
    await settle()
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('muestra el % de aporte y el reparto por persona', () => {
    const text = container.textContent ?? ''
    expect(text).toContain('Gastos Compartidos')
    expect(text).toContain('Reparto equitativo')
    // 2441 de gastos sobre 5000 de ingreso, todo proporcional
    expect(text).toContain('48.8%')
    // 2441 * 3000/5000 = 1464.60 y 2441 * 2000/5000 = 976.40
    expect(text).toContain('$1,464.60')
    expect(text).toContain('$976.40')
  })

  it('muestra el fondo común en lugar de deudas entre personas', () => {
    const text = container.textContent ?? ''
    expect(text).toContain('Fondo común')
    expect(text).toContain('Transferido al fondo')
    expect(text).toContain('Nadie le debe a nadie')
    expect(text).not.toContain('Quedar en paz')
  })

  it('recalcula el % cuando cambia un sueldo', async () => {
    await clickTab(container, 'Mes')
    expect(container.textContent).toContain('Sueldos del mes')

    const firstSalary = container.querySelector<HTMLInputElement>('.card input.input')
    expect(firstSalary).toBeTruthy()
    await act(async () => {
      typeInto(firstSalary as HTMLInputElement, '4000')
      blur(firstSalary as HTMLInputElement)
    })

    // 2441 / (4000 + 2000) = 40.7 %
    expect(container.textContent).toContain('40.7%')
  })

  it('navega por todas las secciones sin romperse', async () => {
    for (const [label, expected] of [
      ['Gastos', 'Catálogo de gastos compartidos'],
      ['Metas', 'Seguimiento de metas'],
      ['Historial', 'Evolución del % de gastos compartidos'],
      ['Ajustes', 'Formato de moneda'],
      ['Resumen', 'Detalle del mes'],
    ] as const) {
      await clickTab(container, label)
      expect(container.textContent, `sección ${label}`).toContain(expected)
    }
  })

  it('el desplegable propio abre, lista opciones y confirma el valor', async () => {
    await clickTab(container, 'Mes')

    const trigger = container.querySelector<HTMLButtonElement>('.select__trigger')
    expect(trigger).toBeTruthy()
    expect(trigger?.textContent).toContain('Proporcional')

    await act(async () => {
      trigger?.click()
    })
    await settle()

    const options = [...document.querySelectorAll<HTMLElement>('.select__option')]
    expect(options.length).toBeGreaterThanOrEqual(3)
    const target = options.find((option) => option.textContent?.includes('Partes iguales'))
    expect(target).toBeTruthy()

    await act(async () => {
      target?.click()
    })
    await settle()

    expect(container.querySelector('.select__trigger')?.textContent).toContain('Partes iguales')

    // el cambio de reparto se refleja en el cálculo del resumen
    await clickTab(container, 'Resumen')
    expect(container.textContent).toContain('Hay gastos con reparto distinto')
  })

  it('permite agregar un gasto al catálogo y lo refleja en el cálculo', async () => {
    await clickTab(container, 'Gastos')

    await act(async () => {
      findButton(container, 'Nuevo gasto')?.click()
    })
    await settle()
    expect(document.body.textContent).toContain('Nuevo gasto')

    const nameInput = document.querySelector<HTMLInputElement>('.modal .form input.input')
    expect(nameInput).toBeTruthy()
    await act(async () => {
      typeInto(nameInput as HTMLInputElement, 'Gimnasio')
    })

    await act(async () => {
      findButton(document.querySelector('.modal__foot') ?? document.body, 'Guardar')?.click()
    })
    await settle()

    expect(container.textContent).toContain('Gimnasio')
  })

  it('permite crear una meta personalizada y la muestra en Metas', async () => {
    await clickTab(container, 'Ajustes')

    await act(async () => {
      findButton(container, '+ Meta')?.click()
    })
    await settle()

    const nameInputs = [...container.querySelectorAll<HTMLInputElement>('.goalist input.input')]
    expect(nameInputs.length).toBeGreaterThan(0)
    await act(async () => {
      typeInto(nameInputs[0], 'Aporte a los padres')
    })

    await act(async () => {
      clickTab(container, 'Metas')
    })
    expect(container.textContent).toContain('Aporte a los padres')
  })

  it('registra el aporte al fondo común de cada persona', async () => {
    await clickTab(container, 'Mes')

    const contributionCard = [...container.querySelectorAll('.contribution')]
    expect(contributionCard.length).toBe(2)

    const toggle = contributionCard[0].querySelector<HTMLButtonElement>('.toggle')
    expect(toggle?.getAttribute('aria-checked')).toBe('false')
    await act(async () => {
      toggle?.click()
    })
    expect(
      contributionCard[0].querySelector('.toggle')?.getAttribute('aria-checked'),
    ).toBe('true')
  })

  it('el desplegable no se cierra con el scroll ni con el teclado', async () => {
    await clickTab(container, 'Mes')
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.select__trigger')?.click()
    })
    expect(document.querySelectorAll('.select__option').length).toBeGreaterThan(0)

    // scroll de la página: antes cerraba el panel
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(document.querySelectorAll('.select__option').length).toBeGreaterThan(0)

    // scroll dentro de la propia lista
    const list = document.querySelector<HTMLElement>('.select__list')
    expect(list).toBeTruthy()
    await act(async () => {
      list?.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    expect(document.querySelectorAll('.select__option').length).toBeGreaterThan(0)

    // redimensionar la ventana
    await act(async () => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(document.querySelectorAll('.select__option').length).toBeGreaterThan(0)

    // moverse con el teclado (antes el resaltado provocaba un scroll y cerraba)
    await act(async () => {
      list?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    expect(document.querySelectorAll('.select__option').length).toBeGreaterThan(0)

    // y sigue funcionando: elegir una opción la confirma y cierra
    const target = [...document.querySelectorAll<HTMLElement>('.select__option')].find((option) =>
      option.textContent?.includes('Partes iguales'),
    )
    await act(async () => {
      target?.click()
    })
    expect(container.querySelector('.select__trigger')?.textContent).toContain('Partes iguales')
    expect(document.querySelectorAll('.select__option').length).toBe(0)
  })

  it('el desplegable se cierra al pulsar fuera y con Escape', async () => {
    await clickTab(container, 'Mes')

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.select__trigger')?.click()
    })
    expect(document.querySelectorAll('.select__option').length).toBeGreaterThan(0)

    await act(async () => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(document.querySelectorAll('.select__option').length).toBe(0)

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.select__trigger')?.click()
    })
    expect(document.querySelectorAll('.select__option').length).toBeGreaterThan(0)

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.querySelectorAll('.select__option').length).toBe(0)
  })

  it('el selector de mes también aguanta el scroll', async () => {
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.monthpicker__trigger')?.click()
    })
    expect(document.querySelectorAll('.monthpicker__month').length).toBe(12)

    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(document.querySelectorAll('.monthpicker__month').length).toBe(12)

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.querySelectorAll('.monthpicker__month').length).toBe(0)
  })

  it('pinta los iconos con una URL absoluta, no relativa al CSS', async () => {
    await clickTab(container, 'Gastos')

    const icon = container.querySelector<HTMLElement>('.iconchip .icon')
    expect(icon).toBeTruthy()
    const mask = icon?.style.getPropertyValue('--icon-url') ?? ''
    expect(mask).toContain('icons/')
    // el valor debe ser absoluto: un url() relativo dentro de una variable CSS se
    // resolvería contra /assets/ y daría 404 en el build de producción
    expect(mask).toContain(new URL('icons/', document.baseURI).href)
  })
})
