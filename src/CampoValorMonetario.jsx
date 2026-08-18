import { formatarValorCampo } from './utils';

export default function CampoValorMonetario({
  value,
  onChange,
  className = 'pa-campo',
  placeholder = '0,00',
  ...props
}) {
  function handleBlur() {
    const formatado = formatarValorCampo(value);
    if (formatado !== value) {
      onChange(formatado);
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={handleBlur}
      {...props}
    />
  );
}
