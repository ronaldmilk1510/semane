import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function formatarNomes(nomes) {
  if (nomes.length === 0) return '';
  if (nomes.length === 1) return nomes[0];
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
}

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

export default function CadastroReservas() {
  const [cotas, setCotas] = useState([]);
  const [carregandoCotas, setCarregandoCotas] = useState(true);
  const [erroCotas, setErroCotas] = useState('');

  const [cotaSelecionadaId, setCotaSelecionadaId] = useState('');
  const [semanas, setSemanas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [erroDados, setErroDados] = useState('');

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
        'id, unidade_id, unidades ( identificacao, bloco_id, blocos ( identificador, empreendimento_id ) ), titulares_cota ( proprietario_id, proprietarios ( nome ) )'
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
        descricao: `${item.unidades?.identificacao ?? ''} · ${formatarNomes(
          (item.titulares_cota || []).map((titular) => titular.proprietarios?.nome).filter(Boolean)
        )}`,
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
    setSemanaIdForm('');
    setDataInicialForm('');
    setDataFinalForm('');
    setSemanas([]);
    setReservas([]);

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

    const semanasComRotulo = semanasData.map((item, indice) => ({
      id: item.id,
      rotulo: `Semana ${indice + 1}`,
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

  const semanasComReserva = new Set(reservas.map((item) => item.semanaId));
  const semanasDisponiveis = semanas.filter((item) => !semanasComReserva.has(item.id));

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

              {semanas.length > 0 && semanasDisponiveis.length === 0 && (
                <p className="pa-lista-vazia">Todas as semanas desta cota já têm reserva cadastrada.</p>
              )}

              {semanasDisponiveis.length > 0 && (
                <form onSubmit={salvar} style={{ marginTop: '1.25rem' }}>
                  <div className="pa-editor-campos">
                    <label>
                      Semana
                      <select
                        className="pa-campo"
                        value={semanaIdForm}
                        onChange={(event) => setSemanaIdForm(event.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {semanasDisponiveis.map((semana) => (
                          <option key={semana.id} value={semana.id}>
                            {semana.rotulo} — {semana.temporadaNome}
                          </option>
                        ))}
                      </select>
                    </label>

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

                  {erroForm && <p className="pa-erro">{erroForm}</p>}

                  <div className="pa-modal-acoes" style={{ justifyContent: 'flex-start', marginTop: '1rem' }}>
                    <button type="submit" className="pa-botao" disabled={salvando}>
                      {salvando ? 'Salvando...' : 'Salvar reserva'}
                    </button>
                  </div>
                </form>
              )}

              {reservas.length > 0 && (
                <table className="pa-tabela" style={{ marginTop: '1.5rem' }}>
                  <thead>
                    <tr>
                      <th>Semana</th>
                      <th>Temporada</th>
                      <th>Data inicial</th>
                      <th>Data final</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservas.map((reserva) => (
                      <tr key={reserva.id}>
                        <td>{reserva.rotulo}</td>
                        <td>{reserva.temporadaNome}</td>
                        <td>{formatarDataBr(reserva.dataInicial)}</td>
                        <td>{formatarDataBr(reserva.dataFinal)}</td>
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
