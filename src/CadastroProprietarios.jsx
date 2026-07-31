import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function CadastroProprietarios() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicaoId, setModoEdicaoId] = useState(null);
  const [nomeForm, setNomeForm] = useState('');
  const [contatoForm, setContatoForm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const [itemParaExcluir, setItemParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState('');

  async function carregarLista() {
    setCarregando(true);
    setErroLista('');
    const { data, error } = await supabase.from('proprietarios').select('id, nome, contato');
    setCarregando(false);
    if (error) {
      setErroLista('Não foi possível carregar os proprietários. Tente novamente.');
      return;
    }
    setLista(data);
  }

  useEffect(() => {
    carregarLista();
  }, []);

  function abrirAdicionar() {
    setModoEdicaoId(null);
    setNomeForm('');
    setContatoForm('');
    setErroForm('');
    setModalAberto(true);
  }

  function abrirEditar(item) {
    setModoEdicaoId(item.id);
    setNomeForm(item.nome);
    setContatoForm(item.contato);
    setErroForm('');
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
  }

  async function salvar(event) {
    event.preventDefault();
    if (!nomeForm.trim()) {
      setErroForm('Informe o nome do proprietário.');
      return;
    }
    if (!contatoForm.trim()) {
      setErroForm('Informe o contato do proprietário.');
      return;
    }

    setSalvando(true);
    setErroForm('');

    const dados = { nome: nomeForm.trim(), contato: contatoForm.trim() };
    const { error } = modoEdicaoId
      ? await supabase.from('proprietarios').update(dados).eq('id', modoEdicaoId)
      : await supabase.from('proprietarios').insert(dados);

    setSalvando(false);

    if (error) {
      setErroForm('Não foi possível salvar o proprietário. Tente novamente.');
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

    const { error } = await supabase.from('proprietarios').delete().eq('id', itemParaExcluir.id);

    setExcluindo(false);

    if (error) {
      if (error.code === '23503') {
        setErroExclusao('Este proprietário está ligado a uma cota ou a um usuário de acesso. Remova esses vínculos primeiro.');
      } else {
        setErroExclusao('Não foi possível excluir o proprietário. Tente novamente.');
      }
      return;
    }

    setItemParaExcluir(null);
    carregarLista();
  }

  return (
    <div>
      <h2>Proprietários</h2>

      <button type="button" className="pa-botao" onClick={abrirAdicionar}>
        Adicionar proprietário
      </button>

      {erroLista && <p className="pa-erro">{erroLista}</p>}

      {!carregando && !erroLista && lista.length === 0 && (
        <p className="pa-lista-vazia">
          Nenhum proprietário cadastrado ainda. Clique em Adicionar proprietário para começar.
        </p>
      )}

      {!erroLista && lista.length > 0 && (
        <table className="pa-tabela" style={{ marginTop: '1.25rem' }}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Contato</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((item) => (
              <tr key={item.id}>
                <td>{item.nome}</td>
                <td>{item.contato}</td>
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
            <h3>{modoEdicaoId ? 'Editar proprietário' : 'Adicionar proprietário'}</h3>
            <form onSubmit={salvar}>
              <label>
                Nome
                <input
                  type="text"
                  value={nomeForm}
                  onChange={(event) => setNomeForm(event.target.value)}
                  autoFocus
                />
              </label>
              <label>
                Contato
                <input
                  type="text"
                  value={contatoForm}
                  onChange={(event) => setContatoForm(event.target.value)}
                />
              </label>
              {erroForm && <p className="pa-erro">{erroForm}</p>}
              <div className="pa-modal-acoes">
                <button type="button" className="pa-botao pa-botao-secundario" onClick={fecharModal}>
                  Cancelar
                </button>
                <button type="submit" className="pa-botao" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar proprietário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {itemParaExcluir && (
        <div className="pa-modal-backdrop" onClick={cancelarExclusao}>
          <div className="pa-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Excluir proprietário</h3>
            <p>
              Excluir o proprietário {itemParaExcluir.nome}? Esta ação não pode ser desfeita.
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
                {excluindo ? 'Excluindo...' : 'Excluir proprietário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
