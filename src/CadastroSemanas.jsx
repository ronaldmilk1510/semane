import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function formatarNomes(nomes) {
  if (nomes.length === 0) return '';
  if (nomes.length === 1) return nomes[0];
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
}

function converterParaNumero(texto) {
  const normalizado = texto.trim().replace(/\./g, '').replace(',', '.');
  return Number(normalizado);
}

function formatarValor(valor) {
  return String(valor).replace('.', ',');
}

function novaLinha() {
  return {
    chave: crypto.randomUUID(),
    existingId: null,
    temporadaId: '',
    valorMinimo: '',
    valorMaximo: '',
  };
}

export default function CadastroSemanas() {
  const [cotas, setCotas] = useState([]);
  const [carregandoCotas, setCarregandoCotas] = useState(true);
  const [erroCotas, setErroCotas] = useState('');

  const [cotaSelecionadaId, setCotaSelecionadaId] = useState('');
  const [temporadas, setTemporadas] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [carregandoLinhas, setCarregandoLinhas] = useState(false);
  const [erroLinhas, setErroLinhas] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const [linhaParaExcluir, setLinhaParaExcluir] = useState(null);
  const [excluindoLinha, setExcluindoLinha] = useState(false);
  const [erroExclusaoLinha, setErroExclusaoLinha] = useState('');

  async function carregarCotas() {
    setCarregandoCotas(true);
    setErroCotas('');
    const { data, error } = await supabase
      .from('cotas')
      .select(
        'id, unidade_id, unidades ( identificacao, bloco_id, blocos ( empreendimento_id ) ), titulares_cota ( proprietario_id, proprietarios ( nome ) )'
      );
    setCarregandoCotas(false);
    if (error) {
      setErroCotas('Não foi possível carregar as cotas. Tente novamente.');
      return;
    }
    setCotas(
      data.map((item) => ({
        id: item.id,
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

  async function carregarTemporadasELinhas(cota) {
    setCarregandoLinhas(true);
    setErroLinhas('');
    setErroForm('');
    setLinhas([]);

    const [temporadasResp, semanasResp] = await Promise.all([
      supabase
        .from('temporadas')
        .select('id, nome, valor_minimo_padrao, valor_maximo_padrao')
        .eq('empreendimento_id', cota.empreendimentoId),
      supabase.from('semanas').select('id, temporada_id, valor_minimo, valor_maximo').eq('cota_id', cota.id),
    ]);

    setCarregandoLinhas(false);

    if (temporadasResp.error || semanasResp.error) {
      setErroLinhas('Não foi possível carregar as semanas desta cota. Tente novamente.');
      return;
    }

    setTemporadas(temporadasResp.data);
    setLinhas(
      semanasResp.data.map((item) => ({
        chave: crypto.randomUUID(),
        existingId: item.id,
        temporadaId: item.temporada_id,
        valorMinimo: formatarValor(item.valor_minimo),
        valorMaximo: formatarValor(item.valor_maximo),
      }))
    );
  }

  function selecionarCota(id) {
    setCotaSelecionadaId(id);
    const cota = cotas.find((item) => item.id === id);
    if (cota) {
      carregarTemporadasELinhas(cota);
    } else {
      setTemporadas([]);
      setLinhas([]);
    }
  }

  function adicionarLinha() {
    setLinhas((atual) => [...atual, novaLinha()]);
  }

  function atualizarLinha(chave, campo, valor) {
    setLinhas((atual) =>
      atual.map((linha) => {
        if (linha.chave !== chave) return linha;
        if (campo === 'temporadaId') {
          const temporada = temporadas.find((item) => item.id === valor);
          return {
            ...linha,
            temporadaId: valor,
            valorMinimo: temporada ? formatarValor(temporada.valor_minimo_padrao) : linha.valorMinimo,
            valorMaximo: temporada ? formatarValor(temporada.valor_maximo_padrao) : linha.valorMaximo,
          };
        }
        return { ...linha, [campo]: valor };
      })
    );
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

    const { data: reservasVinculadas, error: erroReservas } = await supabase
      .from('reservas')
      .select('id')
      .eq('semana_id', linhaParaExcluir.existingId)
      .limit(1);

    if (erroReservas) {
      setExcluindoLinha(false);
      setErroExclusaoLinha('Não foi possível excluir esta semana. Tente novamente.');
      return;
    }

    if (reservasVinculadas.length > 0) {
      setExcluindoLinha(false);
      setErroExclusaoLinha('Esta semana já tem reserva vinculada e não pode ser excluída.');
      return;
    }

    const { error } = await supabase.from('semanas').delete().eq('id', linhaParaExcluir.existingId);

    setExcluindoLinha(false);

    if (error) {
      if (error.code === '23503') {
        setErroExclusaoLinha('Esta semana já tem reserva vinculada e não pode ser excluída.');
      } else {
        setErroExclusaoLinha('Não foi possível excluir esta semana. Tente novamente.');
      }
      return;
    }

    setLinhas((atual) => atual.filter((item) => item.chave !== linhaParaExcluir.chave));
    setLinhaParaExcluir(null);
  }

  function validarLinhas() {
    if (linhas.length === 0) {
      return 'Adicione pelo menos uma semana antes de salvar.';
    }
    if (linhas.length > 4) {
      return 'Uma cota pode ter no máximo quatro semanas.';
    }
    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      if (!linha.temporadaId) {
        return `Selecione a temporada na linha ${i + 1}.`;
      }
      const valorMinimo = converterParaNumero(linha.valorMinimo);
      const valorMaximo = converterParaNumero(linha.valorMaximo);
      if (!linha.valorMinimo.toString().trim() || Number.isNaN(valorMinimo) || valorMinimo <= 0) {
        return `Informe um valor mínimo válido na linha ${i + 1}.`;
      }
      if (!linha.valorMaximo.toString().trim() || Number.isNaN(valorMaximo) || valorMaximo <= 0) {
        return `Informe um valor máximo válido na linha ${i + 1}.`;
      }
      if (valorMinimo > valorMaximo) {
        return `Na linha ${i + 1}, o valor mínimo não pode ser maior que o valor máximo.`;
      }
    }
    return '';
  }

  async function salvar(event) {
    event.preventDefault();

    const erroValidacao = validarLinhas();
    if (erroValidacao) {
      setErroForm(erroValidacao);
      return;
    }

    setSalvando(true);
    setErroForm('');

    for (const linha of linhas) {
      const dados = {
        cota_id: cotaSelecionadaId,
        temporada_id: linha.temporadaId,
        valor_minimo: converterParaNumero(linha.valorMinimo),
        valor_maximo: converterParaNumero(linha.valorMaximo),
      };
      const { error } = linha.existingId
        ? await supabase.from('semanas').update(dados).eq('id', linha.existingId)
        : await supabase.from('semanas').insert(dados);
      if (error) {
        setSalvando(false);
        setErroForm('Não foi possível salvar as semanas. Tente novamente.');
        return;
      }
    }

    setSalvando(false);
    const cota = cotas.find((item) => item.id === cotaSelecionadaId);
    if (cota) {
      carregarTemporadasELinhas(cota);
    }
  }

  const semTemporadas = temporadas.length === 0;

  return (
    <div>
      <h2>Semanas</h2>

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
        <p className="pa-lista-vazia">Escolha uma cota para ver ou cadastrar suas semanas.</p>
      )}

      {cotaSelecionadaId && (
        <>
          {erroLinhas && <p className="pa-erro">{erroLinhas}</p>}

          {carregandoLinhas ? (
            <p className="pa-lista-vazia">Carregando semanas...</p>
          ) : (
            <>
              {semTemporadas && (
                <p className="pa-lista-vazia">
                  Cadastre uma temporada para o empreendimento desta unidade antes de adicionar semanas.
                </p>
              )}

              {!semTemporadas && linhas.length === 0 && (
                <p className="pa-lista-vazia">
                  Nenhuma semana cadastrada ainda para esta cota. Clique em Adicionar linha para começar.
                </p>
              )}

              {!semTemporadas && (
                <form onSubmit={salvar}>
                  <div className="pa-linhas-acoes">
                    <button
                      type="button"
                      className="pa-botao pa-botao-secundario"
                      onClick={adicionarLinha}
                      disabled={linhas.length >= 4}
                    >
                      Adicionar linha
                    </button>
                  </div>

                  {linhas.length > 0 && (
                    <table className="pa-tabela pa-linhas-tabela">
                      <thead>
                        <tr>
                          <th>Temporada</th>
                          <th>Valor mínimo</th>
                          <th>Valor máximo</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhas.map((linha) => (
                          <tr key={linha.chave}>
                            <td>
                              <select
                                className="pa-campo"
                                value={linha.temporadaId}
                                onChange={(event) => atualizarLinha(linha.chave, 'temporadaId', event.target.value)}
                              >
                                <option value="">Selecione...</option>
                                {temporadas.map((temporada) => (
                                  <option key={temporada.id} value={temporada.id}>
                                    {temporada.nome}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="pa-campo"
                                placeholder="0,00"
                                value={linha.valorMinimo}
                                onChange={(event) => atualizarLinha(linha.chave, 'valorMinimo', event.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="pa-campo"
                                placeholder="0,00"
                                value={linha.valorMaximo}
                                onChange={(event) => atualizarLinha(linha.chave, 'valorMaximo', event.target.value)}
                              />
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

                  {erroForm && <p className="pa-erro">{erroForm}</p>}

                  <div className="pa-modal-acoes" style={{ justifyContent: 'flex-start', marginTop: '1.5rem' }}>
                    <button type="submit" className="pa-botao" disabled={salvando}>
                      {salvando ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </>
      )}

      {linhaParaExcluir && (
        <div className="pa-modal-backdrop" onClick={cancelarExclusaoLinha}>
          <div className="pa-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Excluir semana</h3>
            <p>Excluir esta semana da cota? Esta ação não pode ser desfeita.</p>
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
                {excluindoLinha ? 'Excluindo...' : 'Excluir semana'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
