import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { formatarMoeda, formatarValorCampo } from './utils';
import CampoValorMonetario from './CampoValorMonetario';

function converterParaNumero(texto) {
  const normalizado = texto.trim().replace(/\./g, '').replace(',', '.');
  return Number(normalizado);
}

export default function CadastroTemporadas() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState('');

  const [empreendimentos, setEmpreendimentos] = useState([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicaoId, setModoEdicaoId] = useState(null);
  const [empreendimentoIdForm, setEmpreendimentoIdForm] = useState('');
  const [nomeForm, setNomeForm] = useState('');
  const [valorMinimoForm, setValorMinimoForm] = useState('');
  const [valorMaximoForm, setValorMaximoForm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const [itemParaExcluir, setItemParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState('');

  async function carregarLista() {
    setCarregando(true);
    setErroLista('');
    const { data, error } = await supabase
      .from('temporadas')
      .select('id, nome, valor_minimo_padrao, valor_maximo_padrao, empreendimento_id, empreendimentos ( nome )');
    setCarregando(false);
    if (error) {
      setErroLista('Não foi possível carregar as temporadas. Tente novamente.');
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
    setNomeForm('');
    setValorMinimoForm('');
    setValorMaximoForm('');
    setErroForm('');
    setModalAberto(true);
  }

  function abrirEditar(item) {
    setModoEdicaoId(item.id);
    setEmpreendimentoIdForm(item.empreendimento_id);
    setNomeForm(item.nome);
    setValorMinimoForm(formatarValorCampo(item.valor_minimo_padrao));
    setValorMaximoForm(formatarValorCampo(item.valor_maximo_padrao));
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
    if (!nomeForm.trim()) {
      setErroForm('Informe o nome da temporada.');
      return;
    }

    const valorMinimo = converterParaNumero(valorMinimoForm);
    const valorMaximo = converterParaNumero(valorMaximoForm);

    if (!valorMinimoForm.trim() || Number.isNaN(valorMinimo) || valorMinimo <= 0) {
      setErroForm('Informe um valor mínimo padrão válido, maior que zero.');
      return;
    }
    if (!valorMaximoForm.trim() || Number.isNaN(valorMaximo) || valorMaximo <= 0) {
      setErroForm('Informe um valor máximo padrão válido, maior que zero.');
      return;
    }
    if (valorMinimo > valorMaximo) {
      setErroForm('O valor mínimo não pode ser maior que o valor máximo.');
      return;
    }

    setSalvando(true);
    setErroForm('');

    const dados = {
      empreendimento_id: empreendimentoIdForm,
      nome: nomeForm.trim(),
      valor_minimo_padrao: valorMinimo,
      valor_maximo_padrao: valorMaximo,
    };
    const { error } = modoEdicaoId
      ? await supabase.from('temporadas').update(dados).eq('id', modoEdicaoId)
      : await supabase.from('temporadas').insert(dados);

    setSalvando(false);

    if (error) {
      setErroForm('Não foi possível salvar a temporada. Tente novamente.');
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

    const { error } = await supabase.from('temporadas').delete().eq('id', itemParaExcluir.id);

    setExcluindo(false);

    if (error) {
      if (error.code === '23503') {
        setErroExclusao('Esta temporada tem semanas cadastradas. Exclua as semanas primeiro.');
      } else {
        setErroExclusao('Não foi possível excluir a temporada. Tente novamente.');
      }
      return;
    }

    setItemParaExcluir(null);
    carregarLista();
  }

  const semEmpreendimentos = empreendimentos.length === 0;

  return (
    <div>
      <h2>Temporadas</h2>

      <button type="button" className="pa-botao" onClick={abrirAdicionar} disabled={semEmpreendimentos}>
        Adicionar temporada
      </button>

      {semEmpreendimentos && (
        <p className="pa-lista-vazia">Cadastre um empreendimento antes de adicionar uma temporada.</p>
      )}

      {erroLista && <p className="pa-erro">{erroLista}</p>}

      {!carregando && !erroLista && lista.length === 0 && (
        <p className="pa-lista-vazia">
          Nenhuma temporada cadastrada ainda. Clique em Adicionar temporada para começar.
        </p>
      )}

      {!erroLista && lista.length > 0 && (
        <table className="pa-tabela" style={{ marginTop: '1.25rem' }}>
          <thead>
            <tr>
              <th>Empreendimento</th>
              <th>Nome</th>
              <th>Valor mínimo padrão</th>
              <th>Valor máximo padrão</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((item) => (
              <tr key={item.id}>
                <td>{item.empreendimentos?.nome}</td>
                <td>{item.nome}</td>
                <td>{formatarMoeda(item.valor_minimo_padrao)}</td>
                <td>{formatarMoeda(item.valor_maximo_padrao)}</td>
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
            <h3>{modoEdicaoId ? 'Editar temporada' : 'Adicionar temporada'}</h3>
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
                Nome
                <input
                  type="text"
                  value={nomeForm}
                  onChange={(event) => setNomeForm(event.target.value)}
                />
              </label>
              <label>
                Valor mínimo padrão
                <CampoValorMonetario value={valorMinimoForm} onChange={setValorMinimoForm} />
              </label>
              <label>
                Valor máximo padrão
                <CampoValorMonetario value={valorMaximoForm} onChange={setValorMaximoForm} />
              </label>
              {erroForm && <p className="pa-erro">{erroForm}</p>}
              <div className="pa-modal-acoes">
                <button type="button" className="pa-botao pa-botao-secundario" onClick={fecharModal}>
                  Cancelar
                </button>
                <button type="submit" className="pa-botao" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar temporada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {itemParaExcluir && (
        <div className="pa-modal-backdrop" onClick={cancelarExclusao}>
          <div className="pa-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Excluir temporada</h3>
            <p>
              Excluir a temporada {itemParaExcluir.nome} de {itemParaExcluir.empreendimentos?.nome}? Esta ação
              não pode ser desfeita.
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
                {excluindo ? 'Excluindo...' : 'Excluir temporada'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
