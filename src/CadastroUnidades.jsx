import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function CadastroUnidades() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState('');

  const [blocos, setBlocos] = useState([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicaoId, setModoEdicaoId] = useState(null);
  const [blocoIdForm, setBlocoIdForm] = useState('');
  const [identificacaoForm, setIdentificacaoForm] = useState('');
  const [numeroQuartosForm, setNumeroQuartosForm] = useState('');
  const [capacidadeForm, setCapacidadeForm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const [itemParaExcluir, setItemParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState('');

  async function carregarLista() {
    setCarregando(true);
    setErroLista('');
    const { data, error } = await supabase
      .from('unidades')
      .select(
        'id, identificacao, numero_quartos, capacidade_pessoas, bloco_id, blocos ( identificador, empreendimentos ( nome ) )'
      );
    setCarregando(false);
    if (error) {
      setErroLista('Não foi possível carregar as unidades. Tente novamente.');
      return;
    }
    setLista(data);
  }

  async function carregarBlocos() {
    const { data, error } = await supabase
      .from('blocos')
      .select('id, identificador, empreendimentos ( nome )');
    if (!error) {
      setBlocos(data);
    }
  }

  useEffect(() => {
    carregarLista();
    carregarBlocos();
  }, []);

  function abrirAdicionar() {
    setModoEdicaoId(null);
    setBlocoIdForm('');
    setIdentificacaoForm('');
    setNumeroQuartosForm('');
    setCapacidadeForm('');
    setErroForm('');
    setModalAberto(true);
  }

  function abrirEditar(item) {
    setModoEdicaoId(item.id);
    setBlocoIdForm(item.bloco_id);
    setIdentificacaoForm(item.identificacao);
    setNumeroQuartosForm(String(item.numero_quartos));
    setCapacidadeForm(String(item.capacidade_pessoas));
    setErroForm('');
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
  }

  function inteiroValido(valor) {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0;
  }

  async function salvar(event) {
    event.preventDefault();
    if (!blocoIdForm) {
      setErroForm('Selecione o bloco.');
      return;
    }
    if (!identificacaoForm.trim()) {
      setErroForm('Informe a identificação da unidade.');
      return;
    }
    if (!inteiroValido(numeroQuartosForm)) {
      setErroForm('Informe um número de quartos válido, maior que zero.');
      return;
    }
    if (!inteiroValido(capacidadeForm)) {
      setErroForm('Informe uma capacidade de pessoas válida, maior que zero.');
      return;
    }

    setSalvando(true);
    setErroForm('');

    const dados = {
      bloco_id: blocoIdForm,
      identificacao: identificacaoForm.trim(),
      numero_quartos: Number(numeroQuartosForm),
      capacidade_pessoas: Number(capacidadeForm),
    };
    const { error } = modoEdicaoId
      ? await supabase.from('unidades').update(dados).eq('id', modoEdicaoId)
      : await supabase.from('unidades').insert(dados);

    setSalvando(false);

    if (error) {
      setErroForm('Não foi possível salvar a unidade. Tente novamente.');
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

    const { error } = await supabase.from('unidades').delete().eq('id', itemParaExcluir.id);

    setExcluindo(false);

    if (error) {
      if (error.code === '23503') {
        setErroExclusao('Esta unidade tem cotas cadastradas. Exclua as cotas primeiro.');
      } else {
        setErroExclusao('Não foi possível excluir a unidade. Tente novamente.');
      }
      return;
    }

    setItemParaExcluir(null);
    carregarLista();
  }

  const semBlocos = blocos.length === 0;

  return (
    <div>
      <h2>Unidades</h2>

      <button type="button" className="pa-botao" onClick={abrirAdicionar} disabled={semBlocos}>
        Adicionar unidade
      </button>

      {semBlocos && (
        <p className="pa-lista-vazia">Cadastre um bloco antes de adicionar uma unidade.</p>
      )}

      {erroLista && <p className="pa-erro">{erroLista}</p>}

      {!carregando && !erroLista && lista.length === 0 && (
        <p className="pa-lista-vazia">
          Nenhuma unidade cadastrada ainda. Clique em Adicionar unidade para começar.
        </p>
      )}

      {!erroLista && lista.length > 0 && (
        <table className="pa-tabela" style={{ marginTop: '1.25rem' }}>
          <thead>
            <tr>
              <th>Empreendimento</th>
              <th>Bloco</th>
              <th>Identificação</th>
              <th>Nº de quartos</th>
              <th>Capacidade</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((item) => (
              <tr key={item.id}>
                <td>{item.blocos?.empreendimentos?.nome}</td>
                <td>{item.blocos?.identificador}</td>
                <td>{item.identificacao}</td>
                <td>{item.numero_quartos}</td>
                <td>{item.capacidade_pessoas} pessoas</td>
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
            <h3>{modoEdicaoId ? 'Editar unidade' : 'Adicionar unidade'}</h3>
            <form onSubmit={salvar}>
              <label>
                Bloco
                <select
                  value={blocoIdForm}
                  onChange={(event) => setBlocoIdForm(event.target.value)}
                  autoFocus
                >
                  <option value="">Selecione...</option>
                  {blocos.map((bloco) => (
                    <option key={bloco.id} value={bloco.id}>
                      Bloco {bloco.identificador}, {bloco.empreendimentos?.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Identificação
                <input
                  type="text"
                  value={identificacaoForm}
                  onChange={(event) => setIdentificacaoForm(event.target.value)}
                />
              </label>
              <label>
                Número de quartos
                <input
                  type="number"
                  value={numeroQuartosForm}
                  onChange={(event) => setNumeroQuartosForm(event.target.value)}
                />
              </label>
              <label>
                Capacidade de pessoas
                <input
                  type="number"
                  value={capacidadeForm}
                  onChange={(event) => setCapacidadeForm(event.target.value)}
                />
              </label>
              {erroForm && <p className="pa-erro">{erroForm}</p>}
              <div className="pa-modal-acoes">
                <button type="button" className="pa-botao pa-botao-secundario" onClick={fecharModal}>
                  Cancelar
                </button>
                <button type="submit" className="pa-botao" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar unidade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {itemParaExcluir && (
        <div className="pa-modal-backdrop" onClick={cancelarExclusao}>
          <div className="pa-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Excluir unidade</h3>
            <p>
              Excluir a unidade {itemParaExcluir.identificacao}? Esta ação não pode ser desfeita.
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
                {excluindo ? 'Excluindo...' : 'Excluir unidade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
