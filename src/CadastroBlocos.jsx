import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function CadastroBlocos() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState('');

  const [empreendimentos, setEmpreendimentos] = useState([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicaoId, setModoEdicaoId] = useState(null);
  const [empreendimentoIdForm, setEmpreendimentoIdForm] = useState('');
  const [identificadorForm, setIdentificadorForm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const [itemParaExcluir, setItemParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState('');

  async function carregarLista() {
    setCarregando(true);
    setErroLista('');
    const { data, error } = await supabase
      .from('blocos')
      .select('id, identificador, empreendimento_id, empreendimentos ( nome )');
    setCarregando(false);
    if (error) {
      setErroLista('Não foi possível carregar os blocos. Tente novamente.');
      return;
    }
    setLista(data);
  }

  async function carregarEmpreendimentos() {
    const { data, error } = await supabase.from('empreendimentos').select('id, nome');
    if (!error) {
      setEmpreendimentos(data);
    }
  }

  useEffect(() => {
    carregarLista();
    carregarEmpreendimentos();
  }, []);

  function abrirAdicionar() {
    setModoEdicaoId(null);
    setEmpreendimentoIdForm('');
    setIdentificadorForm('');
    setErroForm('');
    setModalAberto(true);
  }

  function abrirEditar(item) {
    setModoEdicaoId(item.id);
    setEmpreendimentoIdForm(item.empreendimento_id);
    setIdentificadorForm(item.identificador);
    setErroForm('');
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
  }

  async function salvar(event) {
    event.preventDefault();
    if (!empreendimentoIdForm) {
      setErroForm('Selecione o empreendimento.');
      return;
    }
    if (!identificadorForm.trim()) {
      setErroForm('Informe o identificador do bloco.');
      return;
    }

    const identificadorNormalizado = identificadorForm.trim();
    const jaExiste = lista.some(
      (item) =>
        item.empreendimento_id === empreendimentoIdForm &&
        item.identificador.trim().toLowerCase() === identificadorNormalizado.toLowerCase() &&
        item.id !== modoEdicaoId
    );
    if (jaExiste) {
      setErroForm('Já existe um bloco com esse identificador para este empreendimento.');
      return;
    }

    setSalvando(true);
    setErroForm('');

    const dados = { empreendimento_id: empreendimentoIdForm, identificador: identificadorNormalizado };
    const { error } = modoEdicaoId
      ? await supabase.from('blocos').update(dados).eq('id', modoEdicaoId)
      : await supabase.from('blocos').insert(dados);

    setSalvando(false);

    if (error) {
      setErroForm('Não foi possível salvar o bloco. Tente novamente.');
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

    const { error } = await supabase.from('blocos').delete().eq('id', itemParaExcluir.id);

    setExcluindo(false);

    if (error) {
      if (error.code === '23503') {
        setErroExclusao('Este bloco tem unidades cadastradas. Exclua as unidades primeiro.');
      } else {
        setErroExclusao('Não foi possível excluir o bloco. Tente novamente.');
      }
      return;
    }

    setItemParaExcluir(null);
    carregarLista();
  }

  const semEmpreendimentos = empreendimentos.length === 0;

  return (
    <div>
      <h2>Blocos</h2>

      <button type="button" className="pa-botao" onClick={abrirAdicionar} disabled={semEmpreendimentos}>
        Adicionar bloco
      </button>

      {semEmpreendimentos && (
        <p className="pa-lista-vazia">Cadastre um empreendimento antes de adicionar um bloco.</p>
      )}

      {erroLista && <p className="pa-erro">{erroLista}</p>}

      {!carregando && !erroLista && lista.length === 0 && (
        <p className="pa-lista-vazia">
          Nenhum bloco cadastrado ainda. Clique em Adicionar bloco para começar.
        </p>
      )}

      {!erroLista && lista.length > 0 && (
        <table className="pa-tabela" style={{ marginTop: '1.25rem' }}>
          <thead>
            <tr>
              <th>Empreendimento</th>
              <th>Identificador</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((item) => (
              <tr key={item.id}>
                <td>{item.empreendimentos?.nome}</td>
                <td>{item.identificador}</td>
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

      {modalAberto && (
        <div className="pa-modal-backdrop" onClick={fecharModal}>
          <div className="pa-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{modoEdicaoId ? 'Editar bloco' : 'Adicionar bloco'}</h3>
            <form onSubmit={salvar}>
              <label>
                Empreendimento
                <select
                  value={empreendimentoIdForm}
                  onChange={(event) => setEmpreendimentoIdForm(event.target.value)}
                  autoFocus
                >
                  <option value="">Selecione...</option>
                  {empreendimentos.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Identificador
                <input
                  type="text"
                  value={identificadorForm}
                  onChange={(event) => setIdentificadorForm(event.target.value)}
                />
              </label>
              {erroForm && <p className="pa-erro">{erroForm}</p>}
              <div className="pa-modal-acoes">
                <button type="button" className="pa-botao pa-botao-secundario" onClick={fecharModal}>
                  Cancelar
                </button>
                <button type="submit" className="pa-botao" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar bloco'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {itemParaExcluir && (
        <div className="pa-modal-backdrop" onClick={cancelarExclusao}>
          <div className="pa-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Excluir bloco</h3>
            <p>
              Excluir o bloco {itemParaExcluir.identificador} de {itemParaExcluir.empreendimentos?.nome}? Esta
              ação não pode ser desfeita.
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
                {excluindo ? 'Excluindo...' : 'Excluir bloco'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
