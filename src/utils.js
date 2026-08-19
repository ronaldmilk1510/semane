export function formatarMoeda(valor) {
  return (valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarNomes(nomes) {
  if (nomes.length === 0) return '';
  if (nomes.length === 1) return nomes[0];
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
}

export function descricaoCota(empreendimentoNome, identificacao, titularesFormatados) {
  return `${empreendimentoNome ?? ''}, ${identificacao ?? ''}, ${titularesFormatados ?? ''}`;
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
