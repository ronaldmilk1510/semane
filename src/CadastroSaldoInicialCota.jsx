import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { formatarValorCampo } from './utils';
import CampoValorMonetario from './CampoValorMonetario';

function formatarNomes(nomes) {
  if (nomes.length === 0) return '';
  if (nomes.length === 1) return nomes[0];
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
}

function converterParaNumero(texto) {
  const normalizado = texto.trim().replace(/\./g, '').replace(',', '.');
  return Number(normalizado);
}

export default function CadastroSaldoInicialCota() {
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState('');

  const [itemParaExcluir, setItemParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState('');

  async function carregarLista() {
    setCarregando(true);
    setErroLista('');

    const [cotasResp, saldosResp] = await Promise.all([
      supabase
        .from('cotas')
        .select(
          'id, unidades ( identificacao, blocos ( identificador, empreendimentos ( nome ) ) ), titulares_cota ( proprietarios ( nome ) )'
        ),
      supabase.from('saldo_inicial_cota').select('id, cota_id, saldo_inicial, data_corte'),
    ]);

    setCarregando(false);

    if (cotasResp.error || saldosResp.error) {
      setErroLista('Não foi possível carregar as cotas. Tente novamente.');
      return;
    }

    const saldosPorCota = new Map(saldosResp.data.map((saldo) => [saldo.cota_id, saldo]));

    setLinhas(
      cotasResp.data.map((cota) => {
        const saldo = saldosPorCota.get(cota.id) || null;
        const nomes = (cota.titulares_cota || []).map((titular) => titular.proprietarios?.nome).filter(Boolean);
        return {
          cotaId: cota.id,
          empreendimentoNome: cota.unidades?.blocos?.empreendimentos?.nome ?? '',
          unidadeIdentificacao: cota.unidades?.identificacao ?? '',
          titulares: formatarNomes(nomes),
          existingId: saldo?.id ?? null,
          saldoInicial: saldo ? formatarValorCampo(saldo.saldo_inicial) : '',
          dataCorte: saldo?.data_corte ?? '',
          salvando: false,
          erro: '',
        };
      })
    );
  }

  useEffect(() => {
    carregarLista();
  }, []);

  function atualizarCampo(cotaId, campo, valor) {
    setLinhas((atual) =>
      atual.map((linha) => (linha.cotaId === cotaId ? { ...linha, [campo]: valor, erro: '' } : linha))
    );
  }

  function definirErroLinha(cotaId, mensagem) {
    setLinhas((atual) => atual.map((linha) => (linha.cotaId === cotaId ? { ...linha, erro: mensagem } : linha)));
  }

  function definirSalvandoLinha(cotaId, valor) {
    setLinhas((atual) => atual.map((linha) => (linha.cotaId === cotaId ? { ...linha, salvando: valor } : linha)));
  }

  async function salvarLinha(cotaId) {
    const linha = linhas.find((item) => item.cotaId === cotaId);
    if (!linha) return;

    const valorNumero = converterParaNumero(linha.saldoInicial || '');
    if (!linha.saldoInicial.trim() || Number.isNaN(valorNumero)) {
      definirErroLinha(cotaId, 'Informe um saldo inicial válido.');
      return;
    }
    if (!linha.dataCorte) {
      definirErroLinha(cotaId, 'Informe a data de corte.');
      return;
    }

    definirSalvandoLinha(cotaId, true);

    const { error } = linha.existingId
      ? await supabase
          .from('saldo_inicial_cota')
          .update({ saldo_inicial: valorNumero, data_corte: linha.dataCorte })
          .eq('id', linha.existingId)
      : await supabase
          .from('saldo_inicial_cota')
          .insert({ cota_id: cotaId, saldo_inicial: valorNumero, data_corte: linha.dataCorte });

    definirSalvandoLinha(cotaId, false);

    if (error) {
      definirErroLinha(cotaId, 'Não foi possível salvar o saldo inicial. Tente novamente.');
      return;
    }

    carregarLista();
  }

  function pedirExclusao(linha) {
    setItemParaExcluir(linha);
    setErroExclusao('');
  }

  function cancelarExclusao() {
    setItemParaExcluir(null);
    setErroExclusao('');
  }

  async function confirmarExclusao() {
    setExcluindo(true);
    setErroExclusao('');

    const { error } = await supabase.from('saldo_inicial_cota').delete().eq('id', itemParaExcluir.existingId);

    setExcluindo(false);

    if (error) {
      setErroExclusao('Não foi possível excluir o saldo inicial. Tente novamente.');
      return;
    }

    setItemParaExcluir(null);
    carregarLista();
  }

  return (
    <div>
      <h2>Saldo inicial por cota</h2>

      {erroLista && <p className="pa-erro">{erroLista}</p>}

      {!carregando && !erroLista && linhas.length === 0 && (
        <p className="pa-lista-vazia">Nenhuma cota cadastrada ainda.</p>
      )}

      {!erroLista && linhas.length > 0 && (
        <table className="pa-tabela pa-linhas-tabela" style={{ marginTop: '1.25rem' }}>
          <thead>
            <tr>
              <th>Empreendimento</th>
              <th>Unidade</th>
              <th>Titulares</th>
              <th>Saldo inicial</th>
              <th>Data de corte</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.cotaId}>
                <td>{linha.empreendimentoNome}</td>
                <td>{linha.unidadeIdentificacao}</td>
                <td>{linha.titulares || '—'}</td>
                <td>
                  <CampoValorMonetario
                    value={linha.saldoInicial}
                    onChange={(valor) => atualizarCampo(linha.cotaId, 'saldoInicial', valor)}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    className="pa-campo"
                    value={linha.dataCorte}
                    onChange={(event) => atualizarCampo(linha.cotaId, 'dataCorte', event.target.value)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="pa-botao-texto"
                    onClick={() => salvarLinha(linha.cotaId)}
                    disabled={linha.salvando}
                  >
                    {linha.salvando ? 'Salvando...' : 'Salvar'}
                  </button>
                  {linha.existingId && (
                    <button
                      type="button"
                      className="pa-botao-texto pa-botao-texto-aviso"
                      onClick={() => pedirExclusao(linha)}
                    >
                      Excluir
                    </button>
                  )}
                  {linha.erro && (
                    <p className="pa-erro" style={{ margin: '0.4rem 0 0' }}>
                      {linha.erro}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {itemParaExcluir && (
        <div className="pa-modal-backdrop" onClick={cancelarExclusao}>
          <div className="pa-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Excluir saldo inicial</h3>
            <p>
              Excluir o saldo inicial da cota {itemParaExcluir.unidadeIdentificacao} ·{' '}
              {itemParaExcluir.titulares || 'sem titular'}? A cota voltará a aparecer sem histórico de saldo. Esta
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
                {excluindo ? 'Excluindo...' : 'Excluir saldo inicial'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
