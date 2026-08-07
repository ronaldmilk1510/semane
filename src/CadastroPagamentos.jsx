import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { formatarMoeda } from './utils';

function formatarNomes(nomes) {
  if (nomes.length === 0) return '';
  if (nomes.length === 1) return nomes[0];
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
}

function formatarDataBr(data) {
  if (!data) return '';
  return data.split('-').reverse().join('/');
}

function converterParaNumero(texto) {
  const normalizado = texto.trim().replace(/\./g, '').replace(',', '.');
  return Number(normalizado);
}

function hojeISO() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function calcularSituacao(parcela) {
  if (parcela.data_pagamento) return 'pago';
  if (parcela.data_vencimento < hojeISO()) return 'em atraso';
  return 'pendente';
}

const rotuloSituacao = {
  pago: 'Pago',
  'em atraso': 'Em atraso',
  pendente: 'Pendente',
};

export default function CadastroPagamentos() {
  const [ocupacoes, setOcupacoes] = useState([]);
  const [carregandoOcupacoes, setCarregandoOcupacoes] = useState(true);
  const [erroOcupacoes, setErroOcupacoes] = useState('');

  const [ocupacaoSelecionadaId, setOcupacaoSelecionadaId] = useState('');
  const [parcelas, setParcelas] = useState([]);
  const [carregandoParcelas, setCarregandoParcelas] = useState(false);
  const [erroParcelas, setErroParcelas] = useState('');

  const [valorForm, setValorForm] = useState('');
  const [dataVencimentoForm, setDataVencimentoForm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const [atualizandoParcelaId, setAtualizandoParcelaId] = useState(null);
  const [erroAtualizacaoParcela, setErroAtualizacaoParcela] = useState('');

  const [parcelaParaExcluir, setParcelaParaExcluir] = useState(null);
  const [excluindoParcela, setExcluindoParcela] = useState(false);
  const [erroExclusaoParcela, setErroExclusaoParcela] = useState('');

  async function carregarOcupacoes() {
    setCarregandoOcupacoes(true);
    setErroOcupacoes('');

    const { data: ocupacoesData, error: erroOcupacoesQuery } = await supabase
      .from('ocupacoes')
      .select(
        'id, data_inicial, data_final, valor_liquido, reserva_id, reservas!ocupacoes_reserva_id_fkey ( id, semana_id, semanas ( id, cota_id, created_at, cotas ( id, unidades ( identificacao, blocos ( empreendimentos ( nome ) ) ), titulares_cota ( proprietarios ( nome ) ) ) ) )'
      )
      .eq('finalidade', 'locação');

    if (erroOcupacoesQuery) {
      setCarregandoOcupacoes(false);
      setErroOcupacoes('Não foi possível carregar as ocupações. Tente novamente.');
      return;
    }

    const cotaIds = [...new Set(ocupacoesData.map((item) => item.reservas?.semanas?.cota_id).filter(Boolean))];

    const { data: semanasData, error: erroSemanas } =
      cotaIds.length === 0
        ? { data: [], error: null }
        : await supabase
            .from('semanas')
            .select('id, cota_id, created_at')
            .in('cota_id', cotaIds)
            .order('created_at', { ascending: true });

    setCarregandoOcupacoes(false);

    if (erroSemanas) {
      setErroOcupacoes('Não foi possível carregar as semanas das cotas. Tente novamente.');
      return;
    }

    const rotuloPorSemanaId = {};
    const contadorPorCota = {};
    semanasData.forEach((semana) => {
      const indice = (contadorPorCota[semana.cota_id] ?? 0) + 1;
      contadorPorCota[semana.cota_id] = indice;
      rotuloPorSemanaId[semana.id] = `Semana ${indice}`;
    });

    const lista = ocupacoesData
      .map((item) => {
        const semana = item.reservas?.semanas;
        const cota = semana?.cotas;
        const empreendimentoNome = cota?.unidades?.blocos?.empreendimentos?.nome ?? '';
        const identificacao = cota?.unidades?.identificacao ?? '';
        const titulares = formatarNomes(
          (cota?.titulares_cota || []).map((titular) => titular.proprietarios?.nome).filter(Boolean)
        );
        const rotuloSemana = rotuloPorSemanaId[semana?.id] ?? '';
        return {
          id: item.id,
          dataInicial: item.data_inicial,
          dataFinal: item.data_final,
          valorLiquido: item.valor_liquido,
          empreendimentoNome,
          identificacao,
          titulares,
          rotuloSemana,
          descricao: `${empreendimentoNome} — ${identificacao} · ${titulares} — ${rotuloSemana} — ${formatarDataBr(
            item.data_inicial
          )} a ${formatarDataBr(item.data_final)}`,
        };
      })
      .sort(
        (a, b) =>
          a.empreendimentoNome.localeCompare(b.empreendimentoNome, undefined, { numeric: true }) ||
          a.identificacao.localeCompare(b.identificacao, undefined, { numeric: true }) ||
          a.rotuloSemana.localeCompare(b.rotuloSemana, undefined, { numeric: true })
      );

    setOcupacoes(lista);
  }

  useEffect(() => {
    carregarOcupacoes();
  }, []);

  async function carregarParcelas(ocupacaoId) {
    setCarregandoParcelas(true);
    setErroParcelas('');
    setErroForm('');
    setErroAtualizacaoParcela('');
    setValorForm('');
    setDataVencimentoForm('');

    const { data, error } = await supabase
      .from('pagamentos')
      .select('*')
      .eq('ocupacao_id', ocupacaoId)
      .order('data_vencimento', { ascending: true });

    setCarregandoParcelas(false);

    if (error) {
      setErroParcelas('Não foi possível carregar as parcelas desta ocupação. Tente novamente.');
      return;
    }

    setParcelas(data);
  }

  function selecionarOcupacao(id) {
    setOcupacaoSelecionadaId(id);
    if (id) {
      carregarParcelas(id);
    } else {
      setParcelas([]);
    }
  }

  const ocupacaoSelecionada = ocupacoes.find((item) => item.id === ocupacaoSelecionadaId);

  const totalLancado = parcelas.reduce((soma, parcela) => soma + Number(parcela.valor), 0);
  const valorLiquido = ocupacaoSelecionada?.valorLiquido ?? 0;
  const diferenca = valorLiquido - totalLancado;

  async function salvar(event) {
    event.preventDefault();
    setErroForm('');

    const valorNumero = converterParaNumero(valorForm || '');

    if (!valorForm.trim() || Number.isNaN(valorNumero) || valorNumero <= 0) {
      setErroForm('Informe um valor válido.');
      return;
    }
    if (!dataVencimentoForm) {
      setErroForm('Informe a data de vencimento.');
      return;
    }

    setSalvando(true);

    const { error } = await supabase.from('pagamentos').insert({
      ocupacao_id: ocupacaoSelecionadaId,
      valor: valorNumero,
      data_vencimento: dataVencimentoForm,
      situacao: calcularSituacao({ data_pagamento: null, data_vencimento: dataVencimentoForm }),
    });

    setSalvando(false);

    if (error) {
      setErroForm('Não foi possível salvar a parcela. Tente novamente.');
      return;
    }

    carregarParcelas(ocupacaoSelecionadaId);
  }

  async function atualizarDataPagamento(parcelaId, novaData) {
    setAtualizandoParcelaId(parcelaId);
    setErroAtualizacaoParcela('');

    const parcela = parcelas.find((item) => item.id === parcelaId);
    const dataPagamento = novaData || null;

    const { error } = await supabase
      .from('pagamentos')
      .update({
        data_pagamento: dataPagamento,
        situacao: calcularSituacao({ data_pagamento: dataPagamento, data_vencimento: parcela.data_vencimento }),
      })
      .eq('id', parcelaId);

    setAtualizandoParcelaId(null);

    if (error) {
      setErroAtualizacaoParcela('Não foi possível atualizar a data de pagamento. Tente novamente.');
      return;
    }

    carregarParcelas(ocupacaoSelecionadaId);
  }

  function pedirExclusao(parcela) {
    setParcelaParaExcluir(parcela);
    setErroExclusaoParcela('');
  }

  function cancelarExclusao() {
    setParcelaParaExcluir(null);
    setErroExclusaoParcela('');
  }

  async function confirmarExclusao() {
    setExcluindoParcela(true);
    setErroExclusaoParcela('');

    const { error } = await supabase.from('pagamentos').delete().eq('id', parcelaParaExcluir.id);

    setExcluindoParcela(false);

    if (error) {
      setErroExclusaoParcela('Não foi possível excluir esta parcela. Tente novamente.');
      return;
    }

    setParcelaParaExcluir(null);
    carregarParcelas(ocupacaoSelecionadaId);
  }

  return (
    <div>
      <h2>Pagamentos</h2>

      <label>
        Ocupação
        <select value={ocupacaoSelecionadaId} onChange={(event) => selecionarOcupacao(event.target.value)}>
          <option value="">Selecione...</option>
          {ocupacoes.map((ocupacao) => (
            <option key={ocupacao.id} value={ocupacao.id}>
              {ocupacao.descricao}
            </option>
          ))}
        </select>
      </label>

      {erroOcupacoes && <p className="pa-erro">{erroOcupacoes}</p>}

      {!carregandoOcupacoes && !erroOcupacoes && !ocupacaoSelecionadaId && (
        <p className="pa-lista-vazia">Escolha uma ocupação de locação para ver ou lançar suas parcelas.</p>
      )}

      {ocupacaoSelecionada && (
        <>
          <div style={{ marginTop: '1rem' }}>
            <p>Empreendimento: {ocupacaoSelecionada.empreendimentoNome}</p>
            <p>Unidade: {ocupacaoSelecionada.identificacao}</p>
            <p>Titulares: {ocupacaoSelecionada.titulares}</p>
            <p>Semana: {ocupacaoSelecionada.rotuloSemana}</p>
            <p>
              Período: {formatarDataBr(ocupacaoSelecionada.dataInicial)} a{' '}
              {formatarDataBr(ocupacaoSelecionada.dataFinal)}
            </p>
            <p>Valor líquido combinado: {formatarMoeda(ocupacaoSelecionada.valorLiquido)}</p>
          </div>

          {erroParcelas && <p className="pa-erro">{erroParcelas}</p>}

          {carregandoParcelas ? (
            <p className="pa-lista-vazia">Carregando parcelas...</p>
          ) : (
            <>
              <div>
                <p>Total já lançado: {formatarMoeda(totalLancado)}</p>
                <p>Diferença: {formatarMoeda(diferenca)}</p>
                {totalLancado > valorLiquido && (
                  <p className="pa-erro">O total lançado já passou do valor combinado para esta ocupação.</p>
                )}
              </div>

              {parcelas.length > 0 && (
                <table className="pa-tabela" style={{ marginTop: '1rem' }}>
                  <thead>
                    <tr>
                      <th>Valor</th>
                      <th>Vencimento</th>
                      <th>Pagamento</th>
                      <th>Situação</th>
                      <th></th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcelas.map((parcela) => {
                      const situacao = calcularSituacao(parcela);
                      const atualizandoEstaLinha = atualizandoParcelaId === parcela.id;
                      return (
                        <tr key={parcela.id}>
                          <td>{formatarMoeda(Number(parcela.valor))}</td>
                          <td>{formatarDataBr(parcela.data_vencimento)}</td>
                          <td>
                            <input
                              type="date"
                              className="pa-campo"
                              value={parcela.data_pagamento ?? ''}
                              disabled={atualizandoEstaLinha}
                              onChange={(event) => atualizarDataPagamento(parcela.id, event.target.value)}
                            />
                          </td>
                          <td>{rotuloSituacao[situacao]}</td>
                          <td>
                            {situacao !== 'pago' && (
                              <button
                                type="button"
                                className="pa-botao-texto"
                                disabled={atualizandoEstaLinha}
                                onClick={() => atualizarDataPagamento(parcela.id, hojeISO())}
                              >
                                Marcar como pago
                              </button>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="pa-botao-texto pa-botao-texto-aviso"
                              onClick={() => pedirExclusao(parcela)}
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {parcelas.length === 0 && (
                <p className="pa-lista-vazia">Nenhuma parcela cadastrada ainda para esta ocupação.</p>
              )}

              {erroAtualizacaoParcela && <p className="pa-erro">{erroAtualizacaoParcela}</p>}

              <form onSubmit={salvar} style={{ marginTop: '1.5rem' }}>
                <div className="pa-editor-campos">
                  <label>
                    Valor
                    <input
                      type="text"
                      inputMode="decimal"
                      className="pa-campo"
                      placeholder="0,00"
                      value={valorForm}
                      onChange={(event) => setValorForm(event.target.value)}
                    />
                  </label>

                  <label>
                    Data de vencimento
                    <input
                      type="date"
                      className="pa-campo"
                      value={dataVencimentoForm}
                      onChange={(event) => setDataVencimentoForm(event.target.value)}
                    />
                  </label>
                </div>

                {erroForm && <p className="pa-erro">{erroForm}</p>}

                <div className="pa-modal-acoes" style={{ justifyContent: 'flex-start', marginTop: '1rem' }}>
                  <button type="submit" className="pa-botao" disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar parcela'}
                  </button>
                </div>
              </form>
            </>
          )}
        </>
      )}

      {parcelaParaExcluir && (
        <div className="pa-modal-backdrop" onClick={cancelarExclusao}>
          <div className="pa-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Excluir parcela</h3>
            <p>
              Excluir a parcela de {formatarMoeda(Number(parcelaParaExcluir.valor))} com vencimento em{' '}
              {formatarDataBr(parcelaParaExcluir.data_vencimento)}? Esta ação não pode ser desfeita.
            </p>
            {erroExclusaoParcela && <p className="pa-erro">{erroExclusaoParcela}</p>}
            <div className="pa-modal-acoes">
              <button type="button" className="pa-botao pa-botao-secundario" onClick={cancelarExclusao}>
                Cancelar
              </button>
              <button
                type="button"
                className="pa-botao pa-botao-perigo"
                onClick={confirmarExclusao}
                disabled={excluindoParcela}
              >
                {excluindoParcela ? 'Excluindo...' : 'Excluir parcela'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
