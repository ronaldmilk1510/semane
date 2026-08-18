export function formatarMoeda(valor) {
  return (valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function converterValorMonetario(texto) {
  const normalizado = String(texto ?? '').trim().replace(/\./g, '').replace(',', '.');
  return Number(normalizado);
}

export function formatarValorCampo(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  const numero = typeof valor === 'number' ? valor : converterValorMonetario(valor);
  if (Number.isNaN(numero)) return valor;
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
