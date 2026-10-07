/** Iconos de navegación: SVG en línea, trazo uniforme, heredan el color. */
export function TabIcon({ name, size = 20 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (name) {
    case 'resumen':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5V12h8.5" />
        </svg>
      )
    case 'mes':
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" />
          <path d="M3.5 9.75h17M8.25 3.25v3.5M15.75 3.25v3.5" />
        </svg>
      )
    case 'gastos':
      return (
        <svg {...common}>
          <path d="M9 7h11M9 12h11M9 17h11" />
          <circle cx="4.5" cy="7" r="1.35" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="12" r="1.35" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="17" r="1.35" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'ahorro':
      return (
        <svg {...common}>
          <path d="M3.5 9a3.5 3.5 0 013.5-3.5h9A3.5 3.5 0 0119.5 9v6a3.5 3.5 0 01-3.5 3.5H7A3.5 3.5 0 013.5 15z" />
          <path d="M16.5 11.25h4v3h-4a1.5 1.5 0 010-3z" />
        </svg>
      )
    case 'historial':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.25V12l3.25 2" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <path d="M3.5 7.5h6.5M14 7.5h6.5M3.5 16.5h9M17 16.5h3.5" />
          <circle cx="12" cy="7.5" r="2.1" />
          <circle cx="15" cy="16.5" r="2.1" />
        </svg>
      )
  }
}
