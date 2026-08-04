import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function formatarDataCurta(data) {
  if (!data) return '';
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

export default function CadastroModeloDatasPadrao() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState('');

  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [empreendimentoIdFiltro, setEmpreendimentoIdFiltro] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicaoId, setModoEdicaoId] = useState(null);
  const [numeroPrioridadeForm, setNumeroPrioridadeForm] = useState('');
  const [dataPadraoForm, setDataPadraoForm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const [itemParaExcluir, setItemParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState('');

  async function carregarLista() {
    setCarregando(true);
    setErroLista('');
    const { data, error } = await supabase
      .from('modelo_datas_padrao')
      .select('id, numero_prioridade, data_padrao, empreendimento_id');
    setCarregando(false);
    if (error) {
      setErroLista('Não foi possível carregar os modelos de data. Tente novamente.');
      return;
    }
    setLista(data);
  }

  async function carregarEmpreendimentos() {
    const { data, error } = await supabase.from('empreendimentos').select('id, nome');
    if (!error) {
      setEmpreendimentos(data);
      if (data.length > 0) {
        setEmpreendimentoIdFiltro((atual) => atual || data[0].id);
      }
    }
  }

  useEffect(() => {
    carregarLista();
    carregarEmpreendimentos();
  }, []);

  function abrirAdicionar() {
    setModoEdicaoId(null);
    setNumeroPrioridadeForm('');
    setDataPadraoForm('');
    setErroForm('');
    setModalAberto(true);
  }

  function abrirEditar(item) {
    setModoEdicaoId(item.id);
    setNumeroPrioridadeForm(String(item.numero_prioridade));
    setDataPadraoForm(item.data_padrao);
    setErroForm('');
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
  }

  async function salvar(event) {
    event.preventDefault();

    const numero = Number(numeroPrioridadeForm);
    if (!numeroPrioridadeForm.toString().trim() || Number.isNaN(numero) || !Number.isInteger(numero)) {
      setErroForm('Informe um número de prioridade válido.');
      return;
    }
    if (!dataPadraoForm) {
      setErroForm('Informe a data padrão.');
      return;
    }

    const jaExiste = lista.some(
      (item) =>
        item.empreendimento_id === empreendimentoIdFiltro &&
        item.numero_prioridade === numero &&
        item.id !== modoEdicaoId
    );
    if (jaExiste) {
      setErroForm('Já existe um modelo cadastrado para este número de prioridade neste empreendimento.');
      return;
    }

    setSalvando(true);
    setErroForm('');

    const dados = {
      empreendimento_id: empreendimentoIdFiltro,
      numero_prioridade: numero,
      data_padrao: dataPadraoForm,
    };
    const { error } = modoEdicaoId
      ? await supabase.from('modelo_datas_padrao').update(dados).eq('id', modoEdicaoId)
      : await supabase.from('modelo_datas_padrao').insert(dados);

    setSalvando(false);

    if (error) {
      setErroForm('Não foi possível salvar o modelo de data. Tente novamente.');
      return;
    }

    setModalAberto(false);
    carregarLista();
  }

  function pedirExclusao(item) {
    setItemParaExcluir(item);
    setErroExclusao('');
  }

  function cancelarExclusao() {
    setItemParaExcluir(null);
    setErroExclusao('');
  }

  async function confirmarExclusao() {
    setExcluindo(true);
    setErroExclusao('');

    const { error } = await supabase.from('modelo_datas_padrao').delete().eq('id', itemParaExcluir.id);

    setExcluindo(false);

    if (error) {
      setErroExclusao('Não foi possível excluir o modelo de data. Tente novamente.');
      return;
    }

    setItemParaExcluir(null);
    carregarLista();
  }

  const semEmpreendimentos = empreendimentos.length === 0;
  const listaFiltrada = lista
    .filter((item) => item.empreendimento_id === empreendimentoIdFiltro)
    .sort((a, b) => a.numero_prioridade - b.numero_prioridade);

  return (
    <div>
      <h2>Modelo de Datas Padrão</h2>

      {semEmpreendimentos && (
        <p className="pa-lista-vazia">Cadastre um empreendimento antes de definir modelos de data.</p>
      )}

      {!semEmpreendimentos && (
        <>
          <div className="pa-editor-campos">
            <label>
              Empreendimento
              <select
                className="pa-campo"
                value={empreendimentoIdFiltro}
                onChange={(event) => setEmpreendimentoIdFiltro(event.target.value)}
              >
                {empreendimentos.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button type="button" className="pa-botao" onClick={abrirAdicionar}>
            Adicionar modelo de data
          </button>

          {erroLista && <p className="pa-erro">{erroLista}</p>}

          {!carregando && !erroLista && listaFiltrada.length === 0 && (
            <p className="pa-lista-vazia">
              Nenhum modelo cadastrado ainda para este empreendimento. Clique em Adicionar modelo de data para
              começar.
            </p>
          )}

          {!erroLista && listaFiltrada.length > 0 && (
            <table className="pa-tabela" style={{ marginTop: '1.25rem' }}>
              <thead>
                <tr>
                  <th>Nº de prioridade</th>
                  <th>Data padrão</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((item) => (
                  <tr key={item.id}>
                    <td>{item.numero_prioridade}</td>
                    <td>{formatarDataCurta(item.data_padrao)}</td>
                    <td>
                      <button type="button" className="pa-botao-texto" onClick={() => abrirEditar(item)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="pa-botao-texto pa-botao-texto-aviso"
                        onClick={() => pedirExclusao(item)}
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

      {modalAberto && (
        <div className="pa-modal-backdrop" onClick={fecharModal}>
          <div className="pa-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{modoEdicaoId ? 'Editar modelo de data' : 'Adicionar modelo de data'}</h3>
            <form onSubmit={salvar}>
              <label>
                Número de prioridade
                <input
                  type="number"
                  value={numeroPrioridadeForm}
                  onChange={(event) => setNumeroPrioridadeForm(event.target.value)}
                  autoFocus
                />
              </label>
              <label>
                Data padrão
                <input
                  type="date"
                  value={dataPadraoForm}
                  onChange={(event) => setDataPadraoForm(event.target.value)}
                />
              </label>
              {erroForm && <p className="pa-erro">{erroForm}</p>}
              <div className="pa-modal-acoes">
                <button type="button" className="pa-botao pa-botao-secundario" onClick={fecharModal}>
                  Cancelar
                </button>
                <button type="submit" className="pa-botao" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar modelo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {itemParaExcluir && (
        <div className="pa-modal-backdrop" onClick={cancelarExclusao}>
          <div className="pa-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Excluir modelo de data</h3>
            <p>
              Excluir o modelo do número de prioridade {itemParaExcluir.numero_prioridade}? Esta ação não pode
              ser desfeita.
            </p>
            {erroExclusao && <p className="pa-erro">{erroExclusao}</p>}
            <div className="pa-modal-acoes">
              <button type="button" className="pa-botao pa-botao-secundario" onClick={cancelarExclusao}>
                Cancelar
              </button>
              <button
                type="button"
                className="pa-botao pa-botao-perigo"
                onClick={confirmarExclusao}
                disabled={excluindo}
              >
                {excluindo ? 'Excluindo...' : 'Excluir modelo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
