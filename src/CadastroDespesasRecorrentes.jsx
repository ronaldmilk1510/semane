import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { formatarMoeda } from './utils';

function formatarNomes(nomes) {
  if (nomes.length === 0) return '';
  if (nomes.length === 1) return nomes[0];
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
}

function converterParaNumero(texto) {
  const normalizado = texto.trim().replace(/\./g, '').replace(',', '.');
  return Number(normalizado);
}

function formatarValorForm(valor) {
  return String(valor).replace('.', ',');
}

const tiposDespesa = [
  { valor: 'condomínio', rotulo: 'Condomínio' },
  { valor: 'parcela de aquisição', rotulo: 'Parcela de aquisição' },
  { valor: 'encargo de rede', rotulo: 'Encargo de rede' },
  { valor: 'retirada de lucro', rotulo: 'Retirada de lucro' },
  { valor: 'outra', rotulo: 'Outra' },
];

const rotuloTipo = Object.fromEntries(tiposDespesa.map((item) => [item.valor, item.rotulo]));

export default function CadastroDespesasRecorrentes() {
  const [cotas, setCotas] = useState([]);
  const [carregandoCotas, setCarregandoCotas] = useState(true);
  const [erroCotas, setErroCotas] = useState('');

  const [cotaSelecionadaId, setCotaSelecionadaId] = useState('');
  const [modelos, setModelos] = useState([]);
  const [carregandoModelos, setCarregandoModelos] = useState(false);
  const [erroModelos, setErroModelos] = useState('');

  const [modoEdicaoId, setModoEdicaoId] = useState(null);
  const [tipoForm, setTipoForm] = useState('');
  const [descricaoForm, setDescricaoForm] = useState('');
  const [proprietarioIdForm, setProprietarioIdForm] = useState('');
  const [valorForm, setValorForm] = useState('');
  const [diaDoMesForm, setDiaDoMesForm] = useState('');
  const [ativoForm, setAtivoForm] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const [itemParaExcluir, setItemParaExcluir] = useState(null);
  const [verificandoExclusao, setVerificandoExclusao] = useState(false);
  const [exclusaoBloqueada, setExclusaoBloqueada] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState('');

  async function carregarCotas() {
    setCarregandoCotas(true);
    setErroCotas('');

    const { data, error } = await supabase
      .from('cotas')
      .select(
        'id, unidade_id, unidades ( identificacao ), titulares_cota ( proprietario_id, proprietarios ( nome ) )'
      );

    setCarregandoCotas(false);

    if (error) {
      setErroCotas('Não foi possível carregar as cotas. Tente novamente.');
      return;
    }

    setCotas(
      data.map((item) => ({
        id: item.id,
        descricao: `${item.unidades?.identificacao ?? ''} · ${formatarNomes(
          (item.titulares_cota || []).map((titular) => titular.proprietarios?.nome).filter(Boolean)
        )}`,
        titulares: (item.titulares_cota || [])
          .filter((titular) => titular.proprietario_id)
          .map((titular) => ({ id: titular.proprietario_id, nome: titular.proprietarios?.nome ?? '' })),
      }))
    );
  }

  useEffect(() => {
    carregarCotas();
  }, []);

  function limparFormulario() {
    setModoEdicaoId(null);
    setTipoForm('');
    setDescricaoForm('');
    setProprietarioIdForm('');
    setValorForm('');
    setDiaDoMesForm('');
    setAtivoForm(true);
    setErroForm('');
  }

  async function carregarModelos(cotaId) {
    setCarregandoModelos(true);
    setErroModelos('');
    limparFormulario();

    const { data, error } = await supabase
      .from('despesas_recorrentes')
      .select('*')
      .eq('cota_id', cotaId)
      .order('created_at', { ascending: false });

    setCarregandoModelos(false);

    if (error) {
      setErroModelos('Não foi possível carregar os modelos recorrentes desta cota. Tente novamente.');
      return;
    }

    setModelos(data);
  }

  function selecionarCota(id) {
    setCotaSelecionadaId(id);
    if (id) {
      carregarModelos(id);
    } else {
      setModelos([]);
    }
  }

  function alterarTipo(valor) {
    setTipoForm(valor);
    if (valor !== 'retirada de lucro') {
      setProprietarioIdForm('');
    }
  }

  const cotaSelecionada = cotas.find((item) => item.id === cotaSelecionadaId);
  const exigeDescricao = tipoForm === 'outra';
  const exigeProprietario = tipoForm === 'retirada de lucro';

  function abrirEditar(item) {
    setModoEdicaoId(item.id);
    setTipoForm(item.tipo);
    setDescricaoForm(item.descricao || '');
    setProprietarioIdForm(item.proprietario_id || '');
    setValorForm(formatarValorForm(item.valor));
    setDiaDoMesForm(String(item.dia_do_mes));
    setAtivoForm(item.ativo);
    setErroForm('');
  }

  async function salvar(event) {
    event.preventDefault();
    setErroForm('');

    if (!tipoForm) {
      setErroForm('Selecione o tipo do modelo.');
      return;
    }
    if (exigeDescricao && !descricaoForm.trim()) {
      setErroForm('Informe a descrição para o tipo "Outra".');
      return;
    }
    if (exigeProprietario && !proprietarioIdForm) {
      setErroForm('Selecione o proprietário para a retirada de lucro.');
      return;
    }

    const valorNumero = converterParaNumero(valorForm || '');
    if (!valorForm.trim() || Number.isNaN(valorNumero) || valorNumero <= 0) {
      setErroForm('Informe um valor válido.');
      return;
    }

    const diaNumero = Number.parseInt(diaDoMesForm, 10);
    if (!diaDoMesForm.trim() || Number.isNaN(diaNumero) || diaNumero < 1 || diaNumero > 28) {
      setErroForm('Informe um dia do mês entre 1 e 28.');
      return;
    }

    setSalvando(true);

    const dados = {
      cota_id: cotaSelecionadaId,
      tipo: tipoForm,
      valor: valorNumero,
      dia_do_mes: diaNumero,
      descricao: descricaoForm.trim(),
      proprietario_id: exigeProprietario ? proprietarioIdForm : null,
      ativo: ativoForm,
    };

    const { error } = modoEdicaoId
      ? await supabase.from('despesas_recorrentes').update(dados).eq('id', modoEdicaoId)
      : await supabase.from('despesas_recorrentes').insert(dados);

    setSalvando(false);

    if (error) {
      setErroForm('Não foi possível salvar o modelo recorrente. Tente novamente.');
      return;
    }

    limparFormulario();
    carregarModelos(cotaSelecionadaId);
  }

  async function alternarAtivo(item) {
    setErroModelos('');
    const { error } = await supabase
      .from('despesas_recorrentes')
      .update({ ativo: !item.ativo })
      .eq('id', item.id);

    if (error) {
      setErroModelos('Não foi possível atualizar o status deste modelo. Tente novamente.');
      return;
    }

    carregarModelos(cotaSelecionadaId);
  }

  async function pedirExclusao(item) {
    setItemParaExcluir(item);
    setErroExclusao('');
    setExclusaoBloqueada(false);
    setVerificandoExclusao(true);

    const { data, error } = await supabase
      .from('despesas')
      .select('id')
      .eq('despesa_recorrente_id', item.id)
      .limit(1);

    setVerificandoExclusao(false);

    if (error) {
      setExclusaoBloqueada(false);
      return;
    }

    setExclusaoBloqueada((data || []).length > 0);
  }

  function cancelarExclusao() {
    setItemParaExcluir(null);
    setErroExclusao('');
  }

  async function confirmarExclusao() {
    setExcluindo(true);
    setErroExclusao('');

    const { error } = await supabase.from('despesas_recorrentes').delete().eq('id', itemParaExcluir.id);

    setExcluindo(false);

    if (error) {
      if (error.code === '23503') {
        setErroExclusao(
          'Este modelo já gerou despesas e não pode ser excluído. Use a opção Desligar para encerrá-lo mantendo o histórico.'
        );
      } else {
        setErroExclusao('Não foi possível excluir este modelo. Tente novamente.');
      }
      return;
    }

    setItemParaExcluir(null);
    carregarModelos(cotaSelecionadaId);
  }

  return (
    <div>
      <h2>Despesas recorrentes</h2>

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
        <p className="pa-lista-vazia">Escolha uma cota para ver ou cadastrar seus modelos recorrentes.</p>
      )}

      {cotaSelecionadaId && (
        <>
          {erroModelos && <p className="pa-erro">{erroModelos}</p>}

          {carregandoModelos ? (
            <p className="pa-lista-vazia">Carregando modelos recorrentes...</p>
          ) : (
            <>
              {modelos.length > 0 && (
                <table className="pa-tabela" style={{ marginTop: '1rem' }}>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Dia do mês</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelos.map((modelo) => (
                      <tr key={modelo.id}>
                        <td>{rotuloTipo[modelo.tipo] ?? modelo.tipo}</td>
                        <td>{formatarMoeda(Number(modelo.valor))}</td>
                        <td>{modelo.dia_do_mes}</td>
                        <td>{modelo.ativo ? 'Ativo' : 'Inativo'}</td>
                        <td>
                          <button type="button" className="pa-botao-texto" onClick={() => abrirEditar(modelo)}>
                            Editar
                          </button>
                          <button
                            type="button"
                            className="pa-botao-texto"
                            onClick={() => alternarAtivo(modelo)}
                          >
                            {modelo.ativo ? 'Desligar' : 'Ativar'}
                          </button>
                          <button
                            type="button"
                            className="pa-botao-texto pa-botao-texto-aviso"
                            onClick={() => pedirExclusao(modelo)}
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {modelos.length === 0 && (
                <p className="pa-lista-vazia">Nenhum modelo recorrente cadastrado para esta cota ainda.</p>
              )}

              <form onSubmit={salvar} style={{ marginTop: '1.5rem' }}>
                <h3>{modoEdicaoId ? 'Editar modelo recorrente' : 'Novo modelo recorrente'}</h3>
                <div className="pa-editor-campos">
                  <label>
                    Tipo
                    <select
                      className="pa-campo"
                      value={tipoForm}
                      onChange={(event) => alterarTipo(event.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {tiposDespesa.map((tipo) => (
                        <option key={tipo.valor} value={tipo.valor}>
                          {tipo.rotulo}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Descrição{exigeDescricao ? '' : ' (opcional)'}
                    <input
                      type="text"
                      className="pa-campo"
                      value={descricaoForm}
                      onChange={(event) => setDescricaoForm(event.target.value)}
                    />
                  </label>

                  {exigeProprietario && (
                    <label>
                      Proprietário
                      <select
                        className="pa-campo"
                        value={proprietarioIdForm}
                        onChange={(event) => setProprietarioIdForm(event.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {(cotaSelecionada?.titulares || []).map((titular) => (
                          <option key={titular.id} value={titular.id}>
                            {titular.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label>
                    Valor
                    <input
                      type="text"
                      inputMode="decimal"
                      className="pa-campo"
                      placeholder="0,00"
                      value={valorForm}
                      onChange={(event) => setValorForm(event.target.value)}
                    />
                  </label>

                  <label>
                    Dia do mês
                    <input
                      type="number"
                      min="1"
                      max="28"
                      className="pa-campo"
                      value={diaDoMesForm}
                      onChange={(event) => setDiaDoMesForm(event.target.value)}
                    />
                  </label>

                  <label className="pa-titular-checkbox">
                    <input
                      type="checkbox"
                      checked={ativoForm}
                      onChange={(event) => setAtivoForm(event.target.checked)}
                    />
                    Ativo
                  </label>
                </div>

                {erroForm && <p className="pa-erro">{erroForm}</p>}

                <div className="pa-modal-acoes" style={{ justifyContent: 'flex-start', marginTop: '1rem' }}>
                  <button type="submit" className="pa-botao" disabled={salvando}>
                    {salvando ? 'Salvando...' : modoEdicaoId ? 'Salvar alterações' : 'Salvar modelo'}
                  </button>
                  {modoEdicaoId && (
                    <button type="button" className="pa-botao pa-botao-secundario" onClick={limparFormulario}>
                      Cancelar edição
                    </button>
                  )}
                </div>
              </form>
            </>
          )}
        </>
      )}

      {itemParaExcluir && (
        <div className="pa-modal-backdrop" onClick={cancelarExclusao}>
          <div className="pa-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Excluir modelo recorrente</h3>

            {verificandoExclusao && <p>Verificando despesas já geradas por este modelo...</p>}

            {!verificandoExclusao && exclusaoBloqueada && (
              <>
                <p>
                  Este modelo já gerou despesas e não pode ser excluído, para preservar o histórico. Use a opção
                  Desligar na lista para encerrá-lo sem perder os registros já lançados.
                </p>
                <div className="pa-modal-acoes">
                  <button type="button" className="pa-botao pa-botao-secundario" onClick={cancelarExclusao}>
                    Entendi
                  </button>
                </div>
              </>
            )}

            {!verificandoExclusao && !exclusaoBloqueada && (
              <>
                <p>
                  Excluir o modelo de {rotuloTipo[itemParaExcluir.tipo] ?? itemParaExcluir.tipo} no valor de{' '}
                  {formatarMoeda(Number(itemParaExcluir.valor))}, no dia {itemParaExcluir.dia_do_mes} do mês? Esta
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
                    {excluindo ? 'Excluindo...' : 'Excluir modelo'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
