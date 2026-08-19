import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { formatarNomes, descricaoCota, numerarSemanasPorCota } from './utils';

function formatarDataBr(data) {
  if (!data) return '';
  return data.split('-').reverse().join('/');
}

function somarDias(data, dias) {
  const [ano, mes, dia] = data.split('-').map(Number);
  const base = new Date(Date.UTC(ano, mes - 1, dia));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

function InfoNumeroSemana() {
  const [aberto, setAberto] = useState(false);
  return (
    <span className="pa-ajuda">
      <button
        type="button"
        className="pa-ajuda-gatilho"
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
      >
        O que é isso?
      </button>
      {aberto && (
        <span className="pa-ajuda-texto">
          O número entre parênteses ao lado da temporada identifica a semana dentro da cota, usado apenas quando há
          mais de uma semana da mesma temporada.
        </span>
      )}
    </span>
  );
}

function agruparReservasPorAno(lista) {
  const grupos = new Map();
  lista.forEach((reserva) => {
    const ano = Number(reserva.dataInicial.slice(0, 4));
    if (!grupos.has(ano)) grupos.set(ano, []);
    grupos.get(ano).push(reserva);
  });
  return Array.from(grupos.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ano, itens]) => ({
      ano,
      itens: itens.slice().sort((a, b) => (a.dataInicial < b.dataInicial ? -1 : a.dataInicial > b.dataInicial ? 1 : 0)),
    }));
}

export default function CadastroReservas() {
  const [cotas, setCotas] = useState([]);
  const [carregandoCotas, setCarregandoCotas] = useState(true);
  const [erroCotas, setErroCotas] = useState('');

  const [cotaSelecionadaId, setCotaSelecionadaId] = useState('');
  const [semanas, setSemanas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [erroDados, setErroDados] = useState('');

  const [anoFiltro, setAnoFiltro] = useState('');

  const [gradeAnos, setGradeAnos] = useState([]);
  const [anoUsoForm, setAnoUsoForm] = useState('');
  const [semanaIdForm, setSemanaIdForm] = useState('');
  const [dataInicialForm, setDataInicialForm] = useState('');
  const [dataFinalForm, setDataFinalForm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const [reservaParaExcluir, setReservaParaExcluir] = useState(null);
  const [excluindoReserva, setExcluindoReserva] = useState(false);
  const [erroExclusaoReserva, setErroExclusaoReserva] = useState('');

  async function carregarCotas() {
    setCarregandoCotas(true);
    setErroCotas('');
    const { data, error } = await supabase
      .from('cotas')
      .select(
        'id, unidade_id, unidades ( identificacao, bloco_id, blocos ( identificador, empreendimento_id, empreendimentos ( nome ) ) ), titulares_cota ( proprietario_id, proprietarios ( nome ) )'
      );
    setCarregandoCotas(false);
    if (error) {
      setErroCotas('Não foi possível carregar as cotas. Tente novamente.');
      return;
    }
    setCotas(
      data.map((item) => ({
        id: item.id,
        blocoId: item.unidades?.bloco_id ?? '',
        empreendimentoId: item.unidades?.blocos?.empreendimento_id ?? '',
        descricao: descricaoCota(
          item.unidades?.blocos?.empreendimentos?.nome ?? '',
          item.unidades?.identificacao ?? '',
          formatarNomes((item.titulares_cota || []).map((titular) => titular.proprietarios?.nome).filter(Boolean))
        ),
      }))
    );
  }

  useEffect(() => {
    carregarCotas();
  }, []);

  async function carregarSemanasEReservas(cotaId) {
    setCarregandoDados(true);
    setErroDados('');
    setErroForm('');
    setAnoUsoForm('');
    setSemanaIdForm('');
    setDataInicialForm('');
    setDataFinalForm('');
    setSemanas([]);
    setReservas([]);
    setGradeAnos([]);
    setAnoFiltro('');

    const cota = cotas.find((item) => item.id === cotaId);
    if (cota?.empreendimentoId && cota?.blocoId) {
      const { data: prioridadesData, error: erroPrioridadesAnos } = await supabase
        .from('prioridades_do_ano')
        .select('ano')
        .eq('empreendimento_id', cota.empreendimentoId)
        .eq('bloco_id', cota.blocoId);
      if (!erroPrioridadesAnos) {
        setGradeAnos(prioridadesData.map((item) => item.ano));
      }
    }

    const { data: semanasData, error: erroSemanas } = await supabase
      .from('semanas')
      .select('id, created_at, temporada_id, temporadas ( nome )')
      .eq('cota_id', cotaId)
      .order('created_at', { ascending: true });

    if (erroSemanas) {
      setCarregandoDados(false);
      setErroDados('Não foi possível carregar as semanas desta cota. Tente novamente.');
      return;
    }

    const numeroPorSemanaId = numerarSemanasPorCota(
      semanasData.map((item) => ({ id: item.id, cotaId, createdAt: item.created_at }))
    );
    const semanasComRotulo = semanasData.map((item) => ({
      id: item.id,
      rotulo: `Semana ${numeroPorSemanaId[item.id]}`,
      numero: numeroPorSemanaId[item.id],
      temporadaNome: item.temporadas?.nome ?? '',
    }));

    const semanaIds = semanasComRotulo.map((item) => item.id);

    const { data: reservasData, error: erroReservas } =
      semanaIds.length === 0
        ? { data: [], error: null }
        : await supabase.from('reservas').select('id, semana_id, data_inicial, data_final').in('semana_id', semanaIds);

    setCarregandoDados(false);

    if (erroReservas) {
      setErroDados('Não foi possível carregar as reservas desta cota. Tente novamente.');
      return;
    }

    setSemanas(semanasComRotulo);
    setReservas(
      reservasData
        .map((item) => {
          const semana = semanasComRotulo.find((s) => s.id === item.semana_id);
          return {
            id: item.id,
            semanaId: item.semana_id,
            rotulo: semana?.rotulo ?? '',
            numero: semana?.numero ?? '',
            temporadaNome: semana?.temporadaNome ?? '',
            dataInicial: item.data_inicial,
            dataFinal: item.data_final,
          };
        })
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, undefined, { numeric: true }))
    );
  }

  function selecionarCota(id) {
    setCotaSelecionadaId(id);
    if (id) {
      carregarSemanasEReservas(id);
    } else {
      setSemanas([]);
      setReservas([]);
    }
  }

  function alterarDataInicial(valor) {
    setDataInicialForm(valor);
    setDataFinalForm(valor ? somarDias(valor, 7) : '');
  }

  function alterarAnoUso(valor) {
    setAnoUsoForm(valor);
    setSemanaIdForm('');
    setDataInicialForm('');
    setDataFinalForm('');
  }

  async function salvar(event) {
    event.preventDefault();
    setErroForm('');

    if (!semanaIdForm) {
      setErroForm('Selecione a semana.');
      return;
    }
    if (!dataInicialForm || !dataFinalForm) {
      setErroForm('Informe a data inicial e a data final.');
      return;
    }
    if (dataFinalForm <= dataInicialForm) {
      setErroForm('A data final precisa ser posterior à data inicial.');
      return;
    }

    const cota = cotas.find((item) => item.id === cotaSelecionadaId);

    setSalvando(true);

    if (!cota?.blocoId || !cota?.empreendimentoId) {
      setSalvando(false);
      setErroForm('Não foi possível identificar o bloco desta cota. Tente novamente.');
      return;
    }

    const anoReserva = Number(dataInicialForm.slice(0, 4));
    const anoGrade = anoReserva - 1;
    const { data: prioridade, error: erroPrioridade } = await supabase
      .from('prioridades_do_ano')
      .select('data_abertura')
      .eq('empreendimento_id', cota.empreendimentoId)
      .eq('bloco_id', cota.blocoId)
      .eq('ano', anoGrade)
      .maybeSingle();

    if (erroPrioridade) {
      setSalvando(false);
      setErroForm('Não foi possível validar a prioridade desta cota. Tente novamente.');
      return;
    }

    if (!prioridade) {
      setSalvando(false);
      setErroForm(
        `Nenhuma grade de prioridades cadastrada para este bloco em ${anoGrade}. Cadastre a prioridade do bloco antes de criar reservas.`
      );
      return;
    }

    if (dataInicialForm < prioridade.data_abertura) {
      setSalvando(false);
      setErroForm(
        `Esta cota só pode ser reservada a partir de ${formatarDataBr(prioridade.data_abertura)}, data de abertura da prioridade do bloco para ${anoGrade}.`
      );
      return;
    }

    const { error } = await supabase.from('reservas').insert({
      semana_id: semanaIdForm,
      data_inicial: dataInicialForm,
      data_final: dataFinalForm,
    });

    setSalvando(false);

    if (error) {
      if (error.code === 'P0001') {
        setErroForm('Este período tem conflito de datas com outra reserva já existente para esta cota.');
      } else {
        setErroForm('Não foi possível salvar a reserva. Tente novamente.');
      }
      return;
    }

    carregarSemanasEReservas(cotaSelecionadaId);
  }

  function pedirExclusao(reserva) {
    setReservaParaExcluir(reserva);
    setErroExclusaoReserva('');
  }

  function cancelarExclusao() {
    setReservaParaExcluir(null);
    setErroExclusaoReserva('');
  }

  async function confirmarExclusao() {
    setExcluindoReserva(true);
    setErroExclusaoReserva('');

    const { data: ocupacoesVinculadas, error: erroOcupacoes } = await supabase
      .from('ocupacoes')
      .select('id')
      .eq('reserva_id', reservaParaExcluir.id)
      .limit(1);

    if (erroOcupacoes) {
      setExcluindoReserva(false);
      setErroExclusaoReserva('Não foi possível excluir esta reserva. Tente novamente.');
      return;
    }

    if (ocupacoesVinculadas.length > 0) {
      setExcluindoReserva(false);
      setErroExclusaoReserva('Esta reserva já tem ocupação vinculada e não pode ser excluída.');
      return;
    }

    const { error } = await supabase.from('reservas').delete().eq('id', reservaParaExcluir.id);

    setExcluindoReserva(false);

    if (error) {
      if (error.code === '23503') {
        setErroExclusaoReserva('Esta reserva já tem ocupação vinculada e não pode ser excluída.');
      } else {
        setErroExclusaoReserva('Não foi possível excluir esta reserva. Tente novamente.');
      }
      return;
    }

    setReservaParaExcluir(null);
    carregarSemanasEReservas(cotaSelecionadaId);
  }

  const cotaAtual = cotas.find((item) => item.id === cotaSelecionadaId);

  const anosUsoDisponiveisForm = Array.from(new Set(gradeAnos.map((ano) => ano + 1))).sort((a, b) => a - b);
  const semanasComReservaNoAnoForm = new Set(
    anoUsoForm
      ? reservas
          .filter((item) => Number(item.dataInicial.slice(0, 4)) === Number(anoUsoForm))
          .map((item) => item.semanaId)
      : []
  );
  const semanasDisponiveisForm = semanas.filter((item) => !semanasComReservaNoAnoForm.has(item.id));

  const anosDisponiveis = Array.from(new Set(reservas.map((reserva) => Number(reserva.dataInicial.slice(0, 4))))).sort(
    (a, b) => a - b
  );
  const reservasFiltradas = anoFiltro
    ? reservas.filter((reserva) => Number(reserva.dataInicial.slice(0, 4)) === Number(anoFiltro))
    : reservas;
  const gruposPorAno = agruparReservasPorAno(reservasFiltradas);

  return (
    <div>
      <h2>Reservas</h2>

      <label>
        Cota
        <select value={cotaSelecionadaId} onChange={(event) => selecionarCota(event.target.value)}>
          <option value="">Selecione...</option>
          {cotas.map((cota) => (
            <option key={cota.id} value={cota.id}>
              {cota.descricao}
            </option>
          ))}
        </select>
      </label>

      {erroCotas && <p className="pa-erro">{erroCotas}</p>}

      {!carregandoCotas && !erroCotas && !cotaSelecionadaId && (
        <p className="pa-lista-vazia">Escolha uma cota para ver ou cadastrar suas reservas.</p>
      )}

      {cotaSelecionadaId && (
        <>
          {erroDados && <p className="pa-erro">{erroDados}</p>}

          {carregandoDados ? (
            <p className="pa-lista-vazia">Carregando dados da cota...</p>
          ) : (
            <>
              {semanas.length === 0 && (
                <p className="pa-lista-vazia">
                  Esta cota ainda não tem semanas cadastradas. Cadastre semanas antes de criar reservas.
                </p>
              )}

              {semanas.length > 0 && (
                <form onSubmit={salvar} style={{ marginTop: '1.25rem' }}>
                  <div className="pa-editor-campos">
                    <label>
                      {/* Escolher o ano de uso antes filtra a lista de semanas já na primeira exibição, evitando mostrar
                          todas as semanas sem filtro (o ano só era conhecido depois de a semana já ter sido escolhida). */}
                      Ano de uso
                      <select
                        className="pa-campo"
                        value={anoUsoForm}
                        onChange={(event) => alterarAnoUso(event.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {anosUsoDisponiveisForm.map((ano) => (
                          <option key={ano} value={ano}>
                            {ano}
                          </option>
                        ))}
                      </select>
                    </label>

                    {anoUsoForm && semanasDisponiveisForm.length > 0 && (
                      <label>
                        {/* Esconde, como ajuda visual, apenas as semanas que já têm reserva no ano de uso escolhido acima.
                            Semanas com reserva em outro ano continuam aparecendo: é direito flutuante, uma reserva por ano.
                            A sobreposição real de datas continua validada no banco ao salvar. */}
                        Semana
                        <select
                          className="pa-campo"
                          value={semanaIdForm}
                          onChange={(event) => setSemanaIdForm(event.target.value)}
                        >
                          <option value="">Selecione...</option>
                          {semanasDisponiveisForm.map((semana) => (
                            <option key={semana.id} value={semana.id}>
                              {cotaAtual?.descricao}, {semana.temporadaNome} ({semana.numero})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  {anoUsoForm && semanasDisponiveisForm.length > 0 && <InfoNumeroSemana />}

                  {anoUsoForm && semanasDisponiveisForm.length > 0 && (
                    <div className="pa-editor-campos">
                      <label>
                        Data inicial
                        <input
                          type="date"
                          className="pa-campo"
                          value={dataInicialForm}
                          onChange={(event) => alterarDataInicial(event.target.value)}
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
                    </div>
                  )}

                  {semanas.length > 0 && anosUsoDisponiveisForm.length === 0 && (
                    <p className="pa-lista-vazia">
                      Nenhuma grade de prioridades cadastrada para este bloco. Cadastre a prioridade do bloco em
                      "Prioridades do Ano" antes de criar reservas.
                    </p>
                  )}

                  {anoUsoForm && semanasDisponiveisForm.length === 0 && (
                    <p className="pa-lista-vazia">Todas as semanas desta cota já têm reserva cadastrada para {anoUsoForm}.</p>
                  )}

                  {anoUsoForm && semanasDisponiveisForm.length > 0 && (
                    <>
                      {erroForm && <p className="pa-erro">{erroForm}</p>}

                      <div className="pa-modal-acoes" style={{ justifyContent: 'flex-start', marginTop: '1rem' }}>
                        <button type="submit" className="pa-botao" disabled={salvando}>
                          {salvando ? 'Salvando...' : 'Salvar reserva'}
                        </button>
                      </div>
                    </>
                  )}
                </form>
              )}

              {reservas.length > 0 && (
                <>
                  <label className="pa-filtro-ano" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
                    Filtrar por ano
                    <select
                      className="pa-campo"
                      value={anoFiltro}
                      onChange={(event) => setAnoFiltro(event.target.value)}
                    >
                      <option value="">Todos</option>
                      {anosDisponiveis.map((ano) => (
                        <option key={ano} value={ano}>
                          {ano}
                        </option>
                      ))}
                    </select>
                  </label>

                  <InfoNumeroSemana />

                  {gruposPorAno.map((grupo) => (
                    <div key={grupo.ano} style={{ marginTop: '1.25rem' }}>
                      <h3 className="pa-grupo-ano-titulo">{grupo.ano}</h3>
                      <table className="pa-tabela">
                        <thead>
                          <tr>
                            <th>Data inicial</th>
                            <th>Data final</th>
                            <th>Temporada</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {grupo.itens.map((reserva) => (
                            <tr key={reserva.id}>
                              <td>{formatarDataBr(reserva.dataInicial)}</td>
                              <td>{formatarDataBr(reserva.dataFinal)}</td>
                              <td>
                                {reserva.temporadaNome} ({reserva.numero})
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="pa-botao-texto pa-botao-texto-aviso"
                                  onClick={() => pedirExclusao(reserva)}
                                >
                                  Excluir
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </>
      )}

      {reservaParaExcluir && (
        <div className="pa-modal-backdrop" onClick={cancelarExclusao}>
          <div className="pa-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Excluir reserva</h3>
            <p>
              Excluir a reserva da {reservaParaExcluir.rotulo} ({formatarDataBr(reservaParaExcluir.dataInicial)} a{' '}
              {formatarDataBr(reservaParaExcluir.dataFinal)})? Esta ação não pode ser desfeita.
            </p>
            {erroExclusaoReserva && <p className="pa-erro">{erroExclusaoReserva}</p>}
            <div className="pa-modal-acoes">
              <button type="button" className="pa-botao pa-botao-secundario" onClick={cancelarExclusao}>
                Cancelar
              </button>
              <button
                type="button"
                className="pa-botao pa-botao-perigo"
                onClick={confirmarExclusao}
                disabled={excluindoReserva}
              >
                {excluindoReserva ? 'Excluindo...' : 'Excluir reserva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
