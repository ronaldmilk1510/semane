import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function formatarNomes(nomes) {
  if (nomes.length === 0) return '';
  if (nomes.length === 1) return nomes[0];
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
}

function novoTitular() {
  return {
    chave: crypto.randomUUID(),
    existingId: null,
    proprietarioId: '',
    principal: false,
  };
}

export default function CadastroCotas() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState('');

  const [unidades, setUnidades] = useState([]);
  const [proprietarios, setProprietarios] = useState([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicaoId, setModoEdicaoId] = useState(null);
  const [unidadeIdForm, setUnidadeIdForm] = useState('');
  const [titularesForm, setTitularesForm] = useState([]);
  const [titularesOriginaisIds, setTitularesOriginaisIds] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const [itemParaExcluir, setItemParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState('');

  async function carregarLista() {
    setCarregando(true);
    setErroLista('');
    const { data, error } = await supabase
      .from('cotas')
      .select(
        'id, unidade_id, unidades ( identificacao ), titulares_cota ( id, proprietario_id, e_titular_principal, proprietarios ( nome ) )'
      );
    setCarregando(false);
    if (error) {
      setErroLista('Não foi possível carregar as cotas. Tente novamente.');
      return;
    }
    setLista(data);
  }

  async function carregarUnidades() {
    const { data, error } = await supabase
      .from('unidades')
      .select('id, identificacao, blocos ( identificador )');
    if (!error) {
      setUnidades(data);
    }
  }

  async function carregarProprietarios() {
    const { data, error } = await supabase.from('proprietarios').select('id, nome');
    if (!error) {
      setProprietarios(data);
    }
  }

  useEffect(() => {
    carregarLista();
    carregarUnidades();
    carregarProprietarios();
  }, []);

  function abrirAdicionar() {
    setModoEdicaoId(null);
    setUnidadeIdForm('');
    setTitularesForm([{ ...novoTitular(), principal: true }]);
    setTitularesOriginaisIds([]);
    setErroForm('');
    setModalAberto(true);
  }

  function abrirEditar(item) {
    setModoEdicaoId(item.id);
    setUnidadeIdForm(item.unidade_id);
    let titulares = item.titulares_cota.map((titular) => ({
      chave: crypto.randomUUID(),
      existingId: titular.id,
      proprietarioId: titular.proprietario_id,
      principal: !!titular.e_titular_principal,
    }));
    if (titulares.length === 1) {
      titulares = [{ ...titulares[0], principal: true }];
    }
    setTitularesForm(titulares);
    setTitularesOriginaisIds(item.titulares_cota.map((titular) => titular.id));
    setErroForm('');
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
  }

  function adicionarTitular() {
    setTitularesForm((atual) => {
      const novaLista = [...atual, novoTitular()];
      if (novaLista.length === 1) {
        return [{ ...novaLista[0], principal: true }];
      }
      return novaLista;
    });
  }

  function removerTitular(chave) {
    setTitularesForm((atual) => {
      const restante = atual.filter((titular) => titular.chave !== chave);
      if (restante.length === 1) {
        return [{ ...restante[0], principal: true }];
      }
      return restante;
    });
  }

  function atualizarTitular(chave, campo, valor) {
    setTitularesForm((atual) => {
      if (campo === 'principal' && valor === true) {
        return atual.map((titular) => ({ ...titular, principal: titular.chave === chave }));
      }
      return atual.map((titular) => (titular.chave === chave ? { ...titular, [campo]: valor } : titular));
    });
  }

  async function salvar(event) {
    event.preventDefault();
    if (!unidadeIdForm) {
      setErroForm('Selecione a unidade.');
      return;
    }
    if (titularesForm.length === 0) {
      setErroForm('Adicione pelo menos um titular.');
      return;
    }
    if (titularesForm.some((titular) => !titular.proprietarioId)) {
      setErroForm('Selecione o proprietário em todos os titulares.');
      return;
    }
    if (titularesForm.length >= 2) {
      const totalPrincipais = titularesForm.filter((titular) => titular.principal).length;
      if (totalPrincipais === 0) {
        setErroForm('Marque um titular como responsável principal antes de salvar.');
        return;
      }
      if (totalPrincipais > 1) {
        setErroForm('Marque apenas um titular como responsável principal.');
        return;
      }
    }

    setSalvando(true);
    setErroForm('');

    let cotaId = modoEdicaoId;

    if (modoEdicaoId) {
      const { error } = await supabase.from('cotas').update({ unidade_id: unidadeIdForm }).eq('id', modoEdicaoId);
      if (error) {
        setSalvando(false);
        setErroForm('Não foi possível salvar a cota. Tente novamente.');
        return;
      }
    } else {
      const { data, error } = await supabase.from('cotas').insert({ unidade_id: unidadeIdForm }).select().single();
      if (error) {
        setSalvando(false);
        setErroForm('Não foi possível salvar a cota. Tente novamente.');
        return;
      }
      cotaId = data.id;
    }

    const idsAtuais = titularesForm.filter((titular) => titular.existingId).map((titular) => titular.existingId);
    const idsRemovidos = titularesOriginaisIds.filter((id) => !idsAtuais.includes(id));

    if (idsRemovidos.length > 0) {
      const { error } = await supabase.from('titulares_cota').delete().in('id', idsRemovidos);
      if (error) {
        setSalvando(false);
        setErroForm('Não foi possível salvar os titulares. Tente novamente.');
        return;
      }
    }

    for (const titular of titularesForm) {
      if (titular.existingId) {
        const { error } = await supabase
          .from('titulares_cota')
          .update({ proprietario_id: titular.proprietarioId, e_titular_principal: titular.principal })
          .eq('id', titular.existingId);
        if (error) {
          setSalvando(false);
          setErroForm('Não foi possível salvar os titulares. Tente novamente.');
          return;
        }
      } else {
        const { error } = await supabase.from('titulares_cota').insert({
          cota_id: cotaId,
          proprietario_id: titular.proprietarioId,
          e_titular_principal: titular.principal,
        });
        if (error) {
          setSalvando(false);
          setErroForm('Não foi possível salvar os titulares. Tente novamente.');
          return;
        }
      }
    }

    setSalvando(false);
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

    const cotaId = itemParaExcluir.id;
    const [semanas, despesas, despesasRecorrentes] = await Promise.all([
      supabase.from('semanas').select('id').eq('cota_id', cotaId).limit(1),
      supabase.from('despesas').select('id').eq('cota_id', cotaId).limit(1),
      supabase.from('despesas_recorrentes').select('id').eq('cota_id', cotaId).limit(1),
    ]);

    if (semanas.error || despesas.error || despesasRecorrentes.error) {
      setExcluindo(false);
      setErroExclusao('Não foi possível excluir a cota. Tente novamente.');
      return;
    }

    const temVinculo =
      semanas.data.length > 0 || despesas.data.length > 0 || despesasRecorrentes.data.length > 0;

    if (temVinculo) {
      setExcluindo(false);
      setErroExclusao(
        'Esta cota tem despesas ou semanas cadastradas e não pode ser excluída diretamente. Remova esses registros primeiro.'
      );
      return;
    }

    const { error } = await supabase.from('cotas').delete().eq('id', cotaId);

    setExcluindo(false);

    if (error) {
      setErroExclusao('Não foi possível excluir a cota. Tente novamente.');
      return;
    }

    setItemParaExcluir(null);
    carregarLista();
  }

  function descricaoCota(item) {
    const identificacao = item.unidades?.identificacao ?? '';
    const nomes = (item.titulares_cota || []).map((titular) => titular.proprietarios?.nome).filter(Boolean);
    return `${identificacao} · ${formatarNomes(nomes)}`;
  }

  const semUnidades = unidades.length === 0;

  return (
    <div>
      <h2>Cotas</h2>

      <button type="button" className="pa-botao" onClick={abrirAdicionar} disabled={semUnidades}>
        Adicionar cota
      </button>

      {semUnidades && (
        <p className="pa-lista-vazia">Cadastre uma unidade antes de adicionar uma cota.</p>
      )}

      {erroLista && <p className="pa-erro">{erroLista}</p>}

      {!carregando && !erroLista && lista.length === 0 && (
        <p className="pa-lista-vazia">Nenhuma cota cadastrada ainda. Clique em Adicionar cota para começar.</p>
      )}

      {!erroLista && lista.length > 0 && (
        <table className="pa-tabela" style={{ marginTop: '1.25rem' }}>
          <thead>
            <tr>
              <th>Cota</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((item) => (
              <tr key={item.id}>
                <td>{descricaoCota(item)}</td>
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
            <h3>{modoEdicaoId ? 'Editar cota' : 'Adicionar cota'}</h3>
            <form onSubmit={salvar}>
              <label>
                Unidade
                <select
                  value={unidadeIdForm}
                  onChange={(event) => setUnidadeIdForm(event.target.value)}
                  autoFocus
                >
                  <option value="">Selecione...</option>
                  {unidades.map((unidade) => (
                    <option key={unidade.id} value={unidade.id}>
                      {unidade.identificacao} · Bloco {unidade.blocos?.identificador}
                    </option>
                  ))}
                </select>
              </label>

              <div className="pa-titulares-lista">
                <p className="pa-titulares-titulo">Titulares</p>
                {titularesForm.map((titular) => (
                  <div className="pa-titular-linha" key={titular.chave}>
                    <label>
                      Proprietário
                      <select
                        value={titular.proprietarioId}
                        onChange={(event) => atualizarTitular(titular.chave, 'proprietarioId', event.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {proprietarios.map((proprietario) => (
                          <option key={proprietario.id} value={proprietario.id}>
                            {proprietario.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="pa-titular-checkbox">
                      <input
                        type="checkbox"
                        checked={titular.principal}
                        disabled={titularesForm.length === 1}
                        onChange={(event) => atualizarTitular(titular.chave, 'principal', event.target.checked)}
                      />
                      Definir como responsável principal
                    </label>
                    <p className="pa-titular-apoio">
                      {titularesForm.length === 1
                        ? 'Responsável principal automático: a cota tem apenas um titular.'
                        : 'Marque exatamente um titular como responsável principal.'}
                    </p>
                    <button
                      type="button"
                      className="pa-botao-texto pa-botao-texto-aviso"
                      onClick={() => removerTitular(titular.chave)}
                    >
                      Remover titular
                    </button>
                  </div>
                ))}
                <button type="button" className="pa-botao pa-botao-secundario" onClick={adicionarTitular}>
                  Adicionar titular
                </button>
              </div>

              {erroForm && <p className="pa-erro">{erroForm}</p>}
              <div className="pa-modal-acoes">
                <button type="button" className="pa-botao pa-botao-secundario" onClick={fecharModal}>
                  Cancelar
                </button>
                <button type="submit" className="pa-botao" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar cota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {itemParaExcluir && (
        <div className="pa-modal-backdrop" onClick={cancelarExclusao}>
          <div className="pa-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Excluir cota</h3>
            <p>
              Excluir a cota {descricaoCota(itemParaExcluir)}? Esta ação não pode ser desfeita.
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
                {excluindo ? 'Excluindo...' : 'Excluir cota'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
