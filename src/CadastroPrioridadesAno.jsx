import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function novaLinha() {
  return {
    chave: crypto.randomUUID(),
    existingId: null,
    numeroPrioridade: '',
    dataAbertura: '',
    blocoId: '',
  };
}

function avisoAlertaProximo(dataAbertura) {
  if (!dataAbertura) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(`${dataAbertura}T00:00:00`);
  const diffDias = Math.round((data - hoje) / 86400000);
  return diffDias >= 0 && diffDias <= 3;
}

export default function CadastroPrioridadesAno() {
  const [tela, setTela] = useState('lista');

  const [grades, setGrades] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState('');

  const [empreendimentos, setEmpreendimentos] = useState([]);

  const [modoEdicao, setModoEdicao] = useState(false);
  const [empreendimentoIdForm, setEmpreendimentoIdForm] = useState('');
  const [anoForm, setAnoForm] = useState(new Date().getFullYear() + 1);
  const [blocos, setBlocos] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [linhasOriginais, setLinhasOriginais] = useState({});
  const [carregandoEditor, setCarregandoEditor] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [gerandoSugestao, setGerandoSugestao] = useState(false);

  const [linhaParaExcluir, setLinhaParaExcluir] = useState(null);
  const [excluindoLinha, setExcluindoLinha] = useState(false);
  const [erroExclusaoLinha, setErroExclusaoLinha] = useState('');

  async function carregarGrades() {
    setCarregandoLista(true);
    setErroLista('');
    const { data, error } = await supabase
      .from('prioridades_do_ano')
      .select('empreendimento_id, ano, empreendimentos ( nome )');
    setCarregandoLista(false);
    if (error) {
      setErroLista('Não foi possível carregar as grades de prioridade. Tente novamente.');
      return;
    }
    const mapa = new Map();
    for (const linha of data) {
      const chave = `${linha.empreendimento_id}::${linha.ano}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          empreendimentoId: linha.empreendimento_id,
          empreendimentoNome: linha.empreendimentos?.nome ?? '',
          ano: linha.ano,
          quantidade: 0,
        });
      }
      mapa.get(chave).quantidade += 1;
    }
    setGrades(
      Array.from(mapa.values()).sort(
        (a, b) => a.empreendimentoNome.localeCompare(b.empreendimentoNome) || a.ano - b.ano
      )
    );
  }

  async function carregarEmpreendimentos() {
    const { data, error } = await supabase.from('empreendimentos').select('id, nome');
    if (!error) {
      setEmpreendimentos(data);
    }
  }

  useEffect(() => {
    carregarGrades();
    carregarEmpreendimentos();
  }, []);

  // Em modo "nova grade", a lista de blocos acompanha o empreendimento escolhido.
  // Em modo edição, empreendimento é fixo e os blocos são carregados uma única vez em abrirEditarGrade.
  useEffect(() => {
    async function carregarBlocosDoEmpreendimento() {
      if (!empreendimentoIdForm) {
        setBlocos([]);
        return;
      }
      const { data, error } = await supabase
        .from('blocos')
        .select('id, identificador')
        .eq('empreendimento_id', empreendimentoIdForm);
      setBlocos(error ? [] : data);
    }
    if (tela === 'editor' && !modoEdicao) {
      carregarBlocosDoEmpreendimento();
    }
  }, [empreendimentoIdForm, tela, modoEdicao]);

  function abrirNovaGrade() {
    setModoEdicao(false);
    setEmpreendimentoIdForm('');
    setAnoForm(new Date().getFullYear() + 1);
    setBlocos([]);
    setLinhas([]);
    setLinhasOriginais({});
    setErroForm('');
    setTela('editor');
  }

  async function abrirEditarGrade(grade) {
    setModoEdicao(true);
    setEmpreendimentoIdForm(grade.empreendimentoId);
    setAnoForm(grade.ano);
    setErroForm('');
    setLinhas([]);
    setLinhasOriginais({});
    setCarregandoEditor(true);
    setTela('editor');

    const [blocosResp, linhasResp] = await Promise.all([
      supabase.from('blocos').select('id, identificador').eq('empreendimento_id', grade.empreendimentoId),
      supabase
        .from('prioridades_do_ano')
        .select('id, numero_prioridade, data_abertura, bloco_id')
        .eq('empreendimento_id', grade.empreendimentoId)
        .eq('ano', grade.ano),
    ]);

    setCarregandoEditor(false);

    if (blocosResp.error || linhasResp.error) {
      setErroForm('Não foi possível carregar esta grade. Tente novamente.');
      return;
    }

    setBlocos(blocosResp.data);

    const linhasCarregadas = linhasResp.data.map((item) => ({
      chave: crypto.randomUUID(),
      existingId: item.id,
      numeroPrioridade: String(item.numero_prioridade),
      dataAbertura: item.data_abertura ?? '',
      blocoId: item.bloco_id,
    }));
    setLinhas(linhasCarregadas);

    const snapshot = {};
    for (const linha of linhasCarregadas) {
      snapshot[linha.existingId] = {
        numeroPrioridade: linha.numeroPrioridade,
        dataAbertura: linha.dataAbertura,
        blocoId: linha.blocoId,
      };
    }
    setLinhasOriginais(snapshot);
  }

  function voltarParaLista() {
    setTela('lista');
    carregarGrades();
  }

  function adicionarLinha() {
    setLinhas((atual) => [...atual, novaLinha()]);
  }

  function atualizarLinha(chave, campo, valor) {
    setLinhas((atual) => atual.map((linha) => (linha.chave === chave ? { ...linha, [campo]: valor } : linha)));
  }

  function removerLinha(linha) {
    if (linha.existingId) {
      setLinhaParaExcluir(linha);
      setErroExclusaoLinha('');
    } else {
      setLinhas((atual) => atual.filter((item) => item.chave !== linha.chave));
    }
  }

  function cancelarExclusaoLinha() {
    setLinhaParaExcluir(null);
    setErroExclusaoLinha('');
  }

  async function confirmarExclusaoLinha() {
    setExcluindoLinha(true);
    setErroExclusaoLinha('');

    const { error } = await supabase.from('prioridades_do_ano').delete().eq('id', linhaParaExcluir.existingId);

    setExcluindoLinha(false);

    if (error) {
      setErroExclusaoLinha('Não foi possível excluir esta linha. Tente novamente.');
      return;
    }

    setLinhas((atual) => atual.filter((item) => item.chave !== linhaParaExcluir.chave));
    setLinhaParaExcluir(null);
  }

  async function gerarSugestaoAutomatica() {
    if (!empreendimentoIdForm) return;
    setGerandoSugestao(true);
    setErroForm('');

    const { data, error } = await supabase
      .from('modelo_datas_padrao')
      .select('numero_prioridade, data_padrao')
      .eq('empreendimento_id', empreendimentoIdForm);

    setGerandoSugestao(false);

    if (error) {
      setErroForm('Não foi possível buscar o modelo de datas padrão. Tente novamente.');
      return;
    }

    const modelos = new Map(data.map((item) => [String(item.numero_prioridade), item.data_padrao]));

    setLinhas((atual) =>
      atual.map((linha) => {
        const numero = Number(linha.numeroPrioridade);
        if (linha.dataAbertura || !linha.numeroPrioridade || Number.isNaN(numero)) {
          return linha;
        }
        const modelo = modelos.get(String(numero));
        if (!modelo) {
          return linha;
        }
        const [, mes, dia] = modelo.split('-');
        return { ...linha, dataAbertura: `${anoForm}-${mes}-${dia}` };
      })
    );
  }

  function validarLinhas() {
    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      if (!linha.blocoId) {
        return `Selecione o bloco na linha ${i + 1}.`;
      }
      const numero = Number(linha.numeroPrioridade);
      if (!linha.numeroPrioridade.toString().trim() || Number.isNaN(numero) || !Number.isInteger(numero)) {
        return `Informe um número de prioridade válido na linha ${i + 1}.`;
      }
    }

    const blocosVistos = new Map();
    const numerosVistos = new Map();
    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      if (blocosVistos.has(linha.blocoId)) {
        const bloco = blocos.find((item) => item.id === linha.blocoId);
        return `O bloco ${bloco?.identificador ?? ''} está repetido nas linhas ${blocosVistos.get(linha.blocoId) + 1} e ${i + 1}.`;
      }
      blocosVistos.set(linha.blocoId, i);

      const numero = String(Number(linha.numeroPrioridade));
      if (numerosVistos.has(numero)) {
        return `O número de prioridade ${numero} está repetido nas linhas ${numerosVistos.get(numero) + 1} e ${i + 1}.`;
      }
      numerosVistos.set(numero, i);
    }
    return '';
  }

  async function salvar(event) {
    event.preventDefault();

    if (!empreendimentoIdForm) {
      setErroForm('Selecione o empreendimento.');
      return;
    }
    if (!anoForm || Number.isNaN(Number(anoForm))) {
      setErroForm('Informe o ano.');
      return;
    }
    if (linhas.length === 0) {
      setErroForm('Adicione pelo menos uma linha antes de salvar.');
      return;
    }
    const erroValidacao = validarLinhas();
    if (erroValidacao) {
      setErroForm(erroValidacao);
      return;
    }

    setSalvando(true);
    setErroForm('');

    if (!modoEdicao) {
      const { data: existentes, error: erroExistentes } = await supabase
        .from('prioridades_do_ano')
        .select('id')
        .eq('empreendimento_id', empreendimentoIdForm)
        .eq('ano', Number(anoForm))
        .limit(1);
      if (erroExistentes) {
        setSalvando(false);
        setErroForm('Não foi possível salvar a grade. Tente novamente.');
        return;
      }
      if (existentes.length > 0) {
        setSalvando(false);
        setErroForm(
          'Já existe uma grade cadastrada para este empreendimento e ano. Volte à lista e use Editar para alterá-la.'
        );
        return;
      }
    }

    // Linhas alteradas são excluídas antes de reinseridas, para nunca esbarrar
    // numa eventual trava de unicidade do banco ao trocar bloco/número entre linhas.
    const paraExcluir = [];
    const paraInserir = [];

    for (const linha of linhas) {
      const dados = {
        empreendimento_id: empreendimentoIdForm,
        ano: Number(anoForm),
        numero_prioridade: Number(linha.numeroPrioridade),
        bloco_id: linha.blocoId,
        data_abertura: linha.dataAbertura || null,
      };
      if (linha.existingId) {
        const original = linhasOriginais[linha.existingId];
        const mudou =
          !original ||
          original.numeroPrioridade !== linha.numeroPrioridade ||
          original.dataAbertura !== linha.dataAbertura ||
          original.blocoId !== linha.blocoId;
        if (mudou) {
          paraExcluir.push(linha.existingId);
          paraInserir.push(dados);
        }
      } else {
        paraInserir.push(dados);
      }
    }

    if (paraExcluir.length > 0) {
      const { error } = await supabase.from('prioridades_do_ano').delete().in('id', paraExcluir);
      if (error) {
        setSalvando(false);
        setErroForm('Não foi possível salvar a grade. Tente novamente.');
        return;
      }
    }

    if (paraInserir.length > 0) {
      const { error } = await supabase.from('prioridades_do_ano').insert(paraInserir);
      if (error) {
        setSalvando(false);
        setErroForm('Não foi possível salvar a grade. Tente novamente.');
        return;
      }
    }

    setSalvando(false);
    setTela('lista');
    carregarGrades();
  }

  const semEmpreendimentos = empreendimentos.length === 0;

  if (tela === 'lista') {
    return (
      <div>
        <h2>Prioridades do Ano</h2>

        <button type="button" className="pa-botao" onClick={abrirNovaGrade} disabled={semEmpreendimentos}>
          Nova grade
        </button>

        {semEmpreendimentos && (
          <p className="pa-lista-vazia">Cadastre um empreendimento antes de montar uma grade de prioridades.</p>
        )}

        {erroLista && <p className="pa-erro">{erroLista}</p>}

        {!carregandoLista && !erroLista && grades.length === 0 && (
          <p className="pa-lista-vazia">
            Nenhuma grade cadastrada ainda. Clique em Nova grade para começar.
          </p>
        )}

        {!erroLista && grades.length > 0 && (
          <table className="pa-tabela" style={{ marginTop: '1.25rem' }}>
            <thead>
              <tr>
                <th>Empreendimento</th>
                <th>Ano</th>
                <th>Blocos cadastrados</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {grades.map((grade) => (
                <tr key={`${grade.empreendimentoId}::${grade.ano}`}>
                  <td>{grade.empreendimentoNome}</td>
                  <td>{grade.ano}</td>
                  <td>{grade.quantidade}</td>
                  <td>
                    <button type="button" className="pa-botao-texto" onClick={() => abrirEditarGrade(grade)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="pa-editor-cabecalho">
        <h2>{modoEdicao ? 'Editar grade de prioridades' : 'Nova grade de prioridades'}</h2>
        <button type="button" className="pa-botao-secundario pa-botao" onClick={voltarParaLista}>
          Voltar à lista
        </button>
      </div>

      <form onSubmit={salvar}>
        <div className="pa-editor-campos">
          <label>
            Empreendimento
            {modoEdicao ? (
              <span className="pa-editor-valor-fixo">
                {empreendimentos.find((emp) => emp.id === empreendimentoIdForm)?.nome ?? ''}
              </span>
            ) : (
              <select
                className="pa-campo"
                value={empreendimentoIdForm}
                onChange={(event) => setEmpreendimentoIdForm(event.target.value)}
              >
                <option value="">Selecione...</option>
                {empreendimentos.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nome}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label>
            Ano
            {modoEdicao ? (
              <span className="pa-editor-valor-fixo">{anoForm}</span>
            ) : (
              <input
                type="number"
                className="pa-campo"
                style={{ width: '110px' }}
                value={anoForm}
                onChange={(event) => setAnoForm(event.target.value)}
              />
            )}
          </label>
        </div>

        {!modoEdicao && empreendimentoIdForm && blocos.length === 0 && (
          <p className="pa-lista-vazia">Este empreendimento ainda não tem blocos cadastrados.</p>
        )}

        {carregandoEditor ? (
          <p className="pa-lista-vazia">Carregando grade...</p>
        ) : (
          <>
            <div className="pa-linhas-acoes">
              <button
                type="button"
                className="pa-botao pa-botao-secundario"
                onClick={gerarSugestaoAutomatica}
                disabled={!empreendimentoIdForm || linhas.length === 0 || gerandoSugestao}
              >
                {gerandoSugestao ? 'Gerando sugestão...' : 'Gerar sugestão automática'}
              </button>
              <button type="button" className="pa-botao pa-botao-secundario" onClick={adicionarLinha}>
                Adicionar linha
              </button>
            </div>

            {linhas.length === 0 ? (
              <p className="pa-lista-vazia">Nenhuma linha ainda. Clique em Adicionar linha para começar.</p>
            ) : (
              <table className="pa-tabela pa-linhas-tabela">
                <thead>
                  <tr>
                    <th>Nº de prioridade</th>
                    <th>Data de abertura</th>
                    <th>Bloco</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha) => (
                    <tr key={linha.chave}>
                      <td>
                        <input
                          type="number"
                          className="pa-campo"
                          value={linha.numeroPrioridade}
                          onChange={(event) => atualizarLinha(linha.chave, 'numeroPrioridade', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="pa-campo"
                          value={linha.dataAbertura}
                          onChange={(event) => atualizarLinha(linha.chave, 'dataAbertura', event.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="pa-campo"
                          value={linha.blocoId}
                          onChange={(event) => atualizarLinha(linha.chave, 'blocoId', event.target.value)}
                        >
                          <option value="">Selecione...</option>
                          {blocos.map((bloco) => (
                            <option key={bloco.id} value={bloco.id}>
                              {bloco.identificador}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="pa-botao-texto pa-botao-texto-aviso"
                          onClick={() => removerLinha(linha)}
                        >
                          Remover linha
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {erroForm && <p className="pa-erro">{erroForm}</p>}

        <div className="pa-modal-acoes" style={{ justifyContent: 'flex-start', marginTop: '1.5rem' }}>
          <button type="button" className="pa-botao pa-botao-secundario" onClick={voltarParaLista}>
            Cancelar
          </button>
          <button type="submit" className="pa-botao" disabled={salvando || carregandoEditor}>
            {salvando ? 'Salvando...' : 'Salvar grade'}
          </button>
        </div>
      </form>

      {linhaParaExcluir && (
        <div className="pa-modal-backdrop" onClick={cancelarExclusaoLinha}>
          <div className="pa-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Excluir linha</h3>
            <p>
              Excluir a linha de prioridade {linhaParaExcluir.numeroPrioridade} desta grade? Esta ação não pode
              ser desfeita.
            </p>
            {avisoAlertaProximo(linhaParaExcluir.dataAbertura) && (
              <p className="pa-erro">
                Atenção: a data de abertura desta prioridade é hoje ou está nos próximos 3 dias. Alertas futuros
                relacionados a ela deixarão de ser enviados se a linha for excluída.
              </p>
            )}
            {erroExclusaoLinha && <p className="pa-erro">{erroExclusaoLinha}</p>}
            <div className="pa-modal-acoes">
              <button type="button" className="pa-botao pa-botao-secundario" onClick={cancelarExclusaoLinha}>
                Cancelar
              </button>
              <button
                type="button"
                className="pa-botao pa-botao-perigo"
                onClick={confirmarExclusaoLinha}
                disabled={excluindoLinha}
              >
                {excluindoLinha ? 'Excluindo...' : 'Excluir linha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
