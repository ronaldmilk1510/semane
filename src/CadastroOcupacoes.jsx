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

function formatarDataCompacta(data) {
  if (!data) return '';
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

function converterParaNumero(texto) {
  const normalizado = texto.trim().replace(/\./g, '').replace(',', '.');
  return Number(normalizado);
}

function contarDias(dataInicial, dataFinal) {
  const [anoI, mesI, diaI] = dataInicial.split('-').map(Number);
  const [anoF, mesF, diaF] = dataFinal.split('-').map(Number);
  const inicio = Date.UTC(anoI, mesI - 1, diaI);
  const fim = Date.UTC(anoF, mesF - 1, diaF);
  return Math.round((fim - inicio) / 86400000);
}

export default function CadastroOcupacoes() {
  const [corretores, setCorretores] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);

  const [reservas, setReservas] = useState([]);
  const [carregandoReservas, setCarregandoReservas] = useState(true);
  const [erroReservas, setErroReservas] = useState('');

  const [anoUsoForm, setAnoUsoForm] = useState('');
  const [reservaSelecionadaId, setReservaSelecionadaId] = useState('');
  const [trechos, setTrechos] = useState([]);
  const [carregandoTrechos, setCarregandoTrechos] = useState(false);
  const [erroTrechos, setErroTrechos] = useState('');

  const [dataInicialForm, setDataInicialForm] = useState('');
  const [dataFinalForm, setDataFinalForm] = useState('');
  const [finalidadeForm, setFinalidadeForm] = useState('uso próprio');
  const [corretorIdForm, setCorretorIdForm] = useState('');
  const [responsavelIdForm, setResponsavelIdForm] = useState('');
  const [valorBrutoForm, setValorBrutoForm] = useState('');
  const [comissaoForm, setComissaoForm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const [trechoParaExcluir, setTrechoParaExcluir] = useState(null);
  const [excluindoTrecho, setExcluindoTrecho] = useState(false);
  const [erroExclusaoTrecho, setErroExclusaoTrecho] = useState('');

  async function carregarListasApoio() {
    const [corretoresResp, responsaveisResp] = await Promise.all([
      supabase.from('corretores').select('id, nome'),
      supabase.from('responsaveis_do_grupo').select('id, nome'),
    ]);
    if (corretoresResp.data) setCorretores(corretoresResp.data);
    if (responsaveisResp.data) setResponsaveis(responsaveisResp.data);
  }

  async function carregarReservas() {
    setCarregandoReservas(true);
    setErroReservas('');

    const { data: reservasData, error: erroReservasQuery } = await supabase
      .from('reservas')
      .select(
        'id, data_inicial, data_final, semana_id, semanas ( id, created_at, cota_id, temporada_id, temporadas ( nome ), cotas ( id, unidades ( identificacao, blocos ( empreendimentos ( nome ) ) ), titulares_cota ( proprietarios ( nome ) ) ) )'
      );

    if (erroReservasQuery) {
      setCarregandoReservas(false);
      setErroReservas('Não foi possível carregar as reservas. Tente novamente.');
      return;
    }

    const cotaIds = [...new Set(reservasData.map((item) => item.semanas?.cota_id).filter(Boolean))];

    const { data: semanasData, error: erroSemanas } =
      cotaIds.length === 0
        ? { data: [], error: null }
        : await supabase.from('semanas').select('id, cota_id, created_at').in('cota_id', cotaIds).order('created_at', { ascending: true });

    setCarregandoReservas(false);

    if (erroSemanas) {
      setErroReservas('Não foi possível carregar as semanas das cotas. Tente novamente.');
      return;
    }

    const numeroPorSemanaId = {};
    const contadorPorCota = {};
    semanasData.forEach((semana) => {
      const indice = (contadorPorCota[semana.cota_id] ?? 0) + 1;
      contadorPorCota[semana.cota_id] = indice;
      numeroPorSemanaId[semana.id] = indice;
    });

    const listaReservas = reservasData
      .map((item) => {
        const semana = item.semanas;
        const cota = semana?.cotas;
        const empreendimentoNome = cota?.unidades?.blocos?.empreendimentos?.nome ?? '';
        const identificacao = cota?.unidades?.identificacao ?? '';
        const titulares = formatarNomes(
          (cota?.titulares_cota || []).map((titular) => titular.proprietarios?.nome).filter(Boolean)
        );
        const numeroSemana = numeroPorSemanaId[semana?.id] ?? '';
        const temporadaNome = semana?.temporadas?.nome ?? '';
        const periodoCompacto = `${formatarDataCompacta(item.data_inicial)} a ${formatarDataCompacta(item.data_final)}`;
        return {
          id: item.id,
          dataInicial: item.data_inicial,
          dataFinal: item.data_final,
          empreendimentoNome,
          identificacao,
          numeroSemana,
          descricao: `${periodoCompacto}, ${temporadaNome} (${numeroSemana})`,
        };
      })
      .sort(
        (a, b) =>
          a.empreendimentoNome.localeCompare(b.empreendimentoNome, undefined, { numeric: true }) ||
          a.identificacao.localeCompare(b.identificacao, undefined, { numeric: true }) ||
          (Number(a.numeroSemana) || 0) - (Number(b.numeroSemana) || 0)
      );

    setReservas(listaReservas);
  }

  useEffect(() => {
    carregarListasApoio();
    carregarReservas();
  }, []);

  async function carregarTrechos(reservaId) {
    setCarregandoTrechos(true);
    setErroTrechos('');
    setErroForm('');
    setDataInicialForm('');
    setDataFinalForm('');
    setFinalidadeForm('uso próprio');
    setCorretorIdForm('');
    setResponsavelIdForm('');
    setValorBrutoForm('');
    setComissaoForm('');

    const { data, error } = await supabase
      .from('ocupacoes')
      .select('*')
      .eq('reserva_id', reservaId)
      .order('data_inicial', { ascending: true });

    setCarregandoTrechos(false);

    if (error) {
      setErroTrechos('Não foi possível carregar os trechos desta reserva. Tente novamente.');
      return;
    }

    setTrechos(data);
  }

  function alterarAnoUso(valor) {
    setAnoUsoForm(valor);
    setReservaSelecionadaId('');
    setTrechos([]);
  }

  function selecionarReserva(id) {
    setReservaSelecionadaId(id);
    if (id) {
      carregarTrechos(id);
    } else {
      setTrechos([]);
    }
  }

  const anosDisponiveis = Array.from(new Set(reservas.map((reserva) => Number(reserva.dataInicial.slice(0, 4))))).sort(
    (a, b) => a - b
  );
  const reservasDoAno = anoUsoForm
    ? reservas.filter((reserva) => Number(reserva.dataInicial.slice(0, 4)) === Number(anoUsoForm))
    : [];

  const reservaSelecionada = reservas.find((item) => item.id === reservaSelecionadaId);
  const locacaoSelecionada = finalidadeForm === 'locação';

  const valorBrutoNumero = converterParaNumero(valorBrutoForm || '0');
  const comissaoNumero = comissaoForm ? converterParaNumero(comissaoForm) : 0;
  const diasTrecho =
    dataInicialForm && dataFinalForm && dataFinalForm >= dataInicialForm
      ? contarDias(dataInicialForm, dataFinalForm)
      : 0;
  const previaValida =
    locacaoSelecionada && diasTrecho > 0 && valorBrutoForm.trim() && !Number.isNaN(valorBrutoNumero) && valorBrutoNumero > 0;
  const previaDiariaBruta = previaValida ? valorBrutoNumero / diasTrecho : null;
  const previaDiariaLiquida = previaValida ? (valorBrutoNumero - comissaoNumero) / diasTrecho : null;

  async function salvar(event) {
    event.preventDefault();
    setErroForm('');

    if (!dataInicialForm || !dataFinalForm) {
      setErroForm('Informe a data inicial e a data final do trecho.');
      return;
    }
    if (dataFinalForm < dataInicialForm) {
      setErroForm('A data final não pode ser anterior à data inicial.');
      return;
    }
    if (!reservaSelecionada) {
      setErroForm('Selecione uma reserva.');
      return;
    }
    if (dataInicialForm < reservaSelecionada.dataInicial || dataFinalForm > reservaSelecionada.dataFinal) {
      setErroForm(
        `Este trecho precisa estar dentro do período da reserva (${formatarDataBr(reservaSelecionada.dataInicial)} a ${formatarDataBr(reservaSelecionada.dataFinal)}).`
      );
      return;
    }

    const temSobreposicao = trechos.some(
      (trecho) => dataInicialForm < trecho.data_final && trecho.data_inicial < dataFinalForm
    );
    if (temSobreposicao) {
      setErroForm('Este trecho tem datas sobrepostas com outro trecho já cadastrado para esta reserva.');
      return;
    }

    let corretorId = null;
    let responsavelId = null;
    let valorBruto = null;
    let comissao = null;
    let valorLiquido = null;
    let diariaBruta = null;
    let diariaLiquida = null;

    if (locacaoSelecionada) {
      if (!corretorIdForm) {
        setErroForm('Selecione o corretor.');
        return;
      }
      if (!responsavelIdForm) {
        setErroForm('Selecione o responsável do grupo.');
        return;
      }
      if (!valorBrutoForm.trim() || Number.isNaN(valorBrutoNumero) || valorBrutoNumero <= 0) {
        setErroForm('Informe um valor bruto válido.');
        return;
      }
      const dias = contarDias(dataInicialForm, dataFinalForm);
      const comissaoNum = comissaoForm ? converterParaNumero(comissaoForm) : 0;
      corretorId = corretorIdForm;
      responsavelId = responsavelIdForm;
      valorBruto = valorBrutoNumero;
      comissao = comissaoNum;
      valorLiquido = valorBrutoNumero - comissaoNum;
      diariaBruta = valorBrutoNumero / dias;
      diariaLiquida = valorLiquido / dias;
    }

    setSalvando(true);

    const { error } = await supabase.from('ocupacoes').insert({
      reserva_id: reservaSelecionadaId,
      data_inicial: dataInicialForm,
      data_final: dataFinalForm,
      finalidade: finalidadeForm,
      corretor_id: corretorId,
      responsavel_grupo_id: responsavelId,
      valor_bruto: valorBruto,
      comissao,
      valor_liquido: valorLiquido,
      diaria_bruta: diariaBruta,
      diaria_liquida: diariaLiquida,
    });

    setSalvando(false);

    if (error) {
      setErroForm('Não foi possível salvar o trecho. Tente novamente.');
      return;
    }

    carregarTrechos(reservaSelecionadaId);
  }

  function pedirExclusao(trecho) {
    setTrechoParaExcluir(trecho);
    setErroExclusaoTrecho('');
  }

  function cancelarExclusao() {
    setTrechoParaExcluir(null);
    setErroExclusaoTrecho('');
  }

  async function confirmarExclusao() {
    setExcluindoTrecho(true);
    setErroExclusaoTrecho('');

    const { data: pagamentosVinculados, error: erroPagamentos } = await supabase
      .from('pagamentos')
      .select('id')
      .eq('ocupacao_id', trechoParaExcluir.id)
      .limit(1);

    if (erroPagamentos) {
      setExcluindoTrecho(false);
      setErroExclusaoTrecho('Não foi possível excluir este trecho. Tente novamente.');
      return;
    }

    if (pagamentosVinculados.length > 0) {
      setExcluindoTrecho(false);
      setErroExclusaoTrecho('Este trecho já tem pagamento vinculado e não pode ser excluído.');
      return;
    }

    const { error } = await supabase.from('ocupacoes').delete().eq('id', trechoParaExcluir.id);

    setExcluindoTrecho(false);

    if (error) {
      if (error.code === '23503') {
        setErroExclusaoTrecho('Este trecho já tem pagamento vinculado e não pode ser excluído.');
      } else {
        setErroExclusaoTrecho('Não foi possível excluir este trecho. Tente novamente.');
      }
      return;
    }

    setTrechoParaExcluir(null);
    carregarTrechos(reservaSelecionadaId);
  }

  return (
    <div>
      <h2>Ocupações</h2>

      <div className="pa-editor-campos">
        <label>
          Ano de uso
          <select
            className="pa-campo"
            value={anoUsoForm}
            onChange={(event) => alterarAnoUso(event.target.value)}
          >
            <option value="">Selecione...</option>
            {anosDisponiveis.map((ano) => (
              <option key={ano} value={ano}>
                {ano}
              </option>
            ))}
          </select>
        </label>

        {anoUsoForm && (
          <label style={{ flex: '1 1 260px', minWidth: 0 }}>
            Reserva
            <select
              className="pa-campo"
              style={{ width: '100%', maxWidth: '100%' }}
              value={reservaSelecionadaId}
              onChange={(event) => selecionarReserva(event.target.value)}
            >
              <option value="">Selecione...</option>
              {reservasDoAno.map((reserva) => (
                <option key={reserva.id} value={reserva.id}>
                  {reserva.descricao}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {erroReservas && <p className="pa-erro">{erroReservas}</p>}

      {!carregandoReservas && !erroReservas && !anoUsoForm && (
        <p className="pa-lista-vazia">Escolha o ano de uso para selecionar a reserva.</p>
      )}

      {!carregandoReservas && !erroReservas && anoUsoForm && !reservaSelecionadaId && (
        <p className="pa-lista-vazia">Escolha uma reserva para ver ou cadastrar suas ocupações.</p>
      )}

      {reservaSelecionada && (
        <>
          <p>
            Período da reserva: {formatarDataBr(reservaSelecionada.dataInicial)} a{' '}
            {formatarDataBr(reservaSelecionada.dataFinal)}
          </p>

          {erroTrechos && <p className="pa-erro">{erroTrechos}</p>}

          {carregandoTrechos ? (
            <p className="pa-lista-vazia">Carregando trechos...</p>
          ) : (
            <>
              {trechos.length > 0 && (
                <table className="pa-tabela" style={{ marginTop: '1rem' }}>
                  <thead>
                    <tr>
                      <th>Data inicial</th>
                      <th>Data final</th>
                      <th>Finalidade</th>
                      <th>Valor líquido</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {trechos.map((trecho) => (
                      <tr key={trecho.id}>
                        <td>{formatarDataBr(trecho.data_inicial)}</td>
                        <td>{formatarDataBr(trecho.data_final)}</td>
                        <td>{trecho.finalidade === 'locação' ? 'Locação' : 'Uso próprio'}</td>
                        <td>{trecho.finalidade === 'locação' ? formatarMoeda(trecho.valor_liquido) : '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="pa-botao-texto pa-botao-texto-aviso"
                            onClick={() => pedirExclusao(trecho)}
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {trechos.length === 0 && (
                <p className="pa-lista-vazia">Nenhum trecho cadastrado ainda para esta reserva.</p>
              )}

              <form onSubmit={salvar} style={{ marginTop: '1.5rem' }}>
                <div className="pa-editor-campos">
                  <label>
                    Data inicial
                    <input
                      type="date"
                      className="pa-campo"
                      value={dataInicialForm}
                      onChange={(event) => setDataInicialForm(event.target.value)}
                    />
                  </label>

                  <label>
                    Data final
                    <input
                      type="date"
                      className="pa-campo"
                      value={dataFinalForm}
                      onChange={(event) => setDataFinalForm(event.target.value)}
                    />
                  </label>

                  <label>
                    Finalidade
                    <select
                      className="pa-campo"
                      value={finalidadeForm}
                      onChange={(event) => setFinalidadeForm(event.target.value)}
                    >
                      <option value="uso próprio">Uso próprio</option>
                      <option value="locação">Locação</option>
                    </select>
                  </label>
                </div>

                {locacaoSelecionada && (
                  <div className="pa-editor-campos" style={{ marginTop: '0.75rem' }}>
                    <label>
                      Corretor
                      <select
                        className="pa-campo"
                        value={corretorIdForm}
                        onChange={(event) => setCorretorIdForm(event.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {corretores.map((corretor) => (
                          <option key={corretor.id} value={corretor.id}>
                            {corretor.nome}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Responsável do grupo
                      <select
                        className="pa-campo"
                        value={responsavelIdForm}
                        onChange={(event) => setResponsavelIdForm(event.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {responsaveis.map((responsavel) => (
                          <option key={responsavel.id} value={responsavel.id}>
                            {responsavel.nome}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Valor bruto
                      <input
                        type="text"
                        inputMode="decimal"
                        className="pa-campo"
                        placeholder="0,00"
                        value={valorBrutoForm}
                        onChange={(event) => setValorBrutoForm(event.target.value)}
                      />
                    </label>

                    <label>
                      Comissão
                      <input
                        type="text"
                        inputMode="decimal"
                        className="pa-campo"
                        placeholder="0,00"
                        value={comissaoForm}
                        onChange={(event) => setComissaoForm(event.target.value)}
                      />
                    </label>
                  </div>
                )}

                {previaDiariaBruta !== null && (
                  <p style={{ marginTop: '0.5rem' }}>
                    Diária bruta: {formatarMoeda(previaDiariaBruta)} · Diária líquida:{' '}
                    {formatarMoeda(previaDiariaLiquida)}
                  </p>
                )}

                {erroForm && <p className="pa-erro">{erroForm}</p>}

                <div className="pa-modal-acoes" style={{ justifyContent: 'flex-start', marginTop: '1rem' }}>
                  <button type="submit" className="pa-botao" disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar trecho'}
                  </button>
                </div>
              </form>
            </>
          )}
        </>
      )}

      {trechoParaExcluir && (
        <div className="pa-modal-backdrop" onClick={cancelarExclusao}>
          <div className="pa-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Excluir trecho</h3>
            <p>
              Excluir o trecho de {formatarDataBr(trechoParaExcluir.data_inicial)} a{' '}
              {formatarDataBr(trechoParaExcluir.data_final)}? Esta ação não pode ser desfeita.
            </p>
            {erroExclusaoTrecho && <p className="pa-erro">{erroExclusaoTrecho}</p>}
            <div className="pa-modal-acoes">
              <button type="button" className="pa-botao pa-botao-secundario" onClick={cancelarExclusao}>
                Cancelar
              </button>
              <button
                type="button"
                className="pa-botao pa-botao-perigo"
                onClick={confirmarExclusao}
                disabled={excluindoTrecho}
              >
                {excluindoTrecho ? 'Excluindo...' : 'Excluir trecho'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
