interface Props {
  value: string
  onChange: (color: string) => void
  colors: string[]
  ariaLabel?: string
}

/** Paleta propia: sin `<input type="color">`, cuyo diálogo depende del sistema. */
export function ColorPicker({ value, onChange, colors, ariaLabel }: Props) {
  const options = colors.includes(value) ? colors : [value, ...colors]

  return (
    <div className="colorpicker" role="radiogroup" aria-label={ariaLabel}>
      {options.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === value}
          aria-label={color}
          className={`colorpicker__swatch ${color === value ? 'colorpicker__swatch--selected' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  )
}
