import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function formatarData(data) {
  if (!data) return null;
  return data.split('-').reverse().join('/');
}

export default function RelatorioLocacoes() {
  const [unidades, setUnidades] = useState([]);
  const [corretores, setCorretores] = useState([]);
  const [unidadeId, setUnidadeId] = useState('');
  const [corretorId, setCorretorId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [visao, setVisao] = useState('sintetica');
  const [resultado, setResultado] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregarFiltros() {
      const { data: unidadesData } = await supabase.from('unidades').select('id, identificacao');
      if (unidadesData) setUnidades(unidadesData);

      const { data: corretoresData } = await supabase.from('corretores').select('id, nome');
      if (corretoresData) setCorretores(corretoresData);
    }
    carregarFiltros();
  }, []);

  async function consultar() {
    setCarregando(true);
    setErro('');
    setResultado([]);

    const nomeFuncao = visao === 'sintetica' ? 'relatorio_locacoes_sintetico' : 'relatorio_locacoes_analitico';

    const { data, error } = await supabase.rpc(nomeFuncao, {
      p_unidade_id: unidadeId || null,
      p_corretor_id: corretorId || null,
      p_data_inicio: dataInicio || null,
      p_data_fim: dataFim || null,
    });

    setCarregando(false);
    if (error) {
      setErro('Não foi possível consultar o relatório. Detalhe: ' + error.message);
      return;
    }
    setResultado(data);
  }

  function trocarVisao(novaVisao) {
    setVisao(novaVisao);
    setResultado([]);
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1000px' }}>
      <h2>Locações</h2>

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={() => trocarVisao('sintetica')} disabled={visao === 'sintetica'}>
          Visão sintética
        </button>
        {' '}
        <button onClick={() => trocarVisao('analitica')} disabled={visao === 'analitica'}>
          Visão analítica
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <label>
          Unidade (opcional)
          <br />
          <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
            <option value="">Todas</option>
            {unidades.map((un) => (
              <option key={un.id} value={un.id}>{un.identificacao}</option>
            ))}
          </select>
        </label>

        <label>
          Corretor (opcional)
          <br />
          <select value={corretorId} onChange={(e) => setCorretorId(e.target.value)}>
            <option value="">Todos</option>
            {corretores.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>

        <label>
          Vencimento de
          <br />
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </label>

        <label>
          Vencimento até
          <br />
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </label>
      </div>

      <button onClick={consultar} disabled={carregando}>
        {carregando ? 'Consultando...' : 'Consultar'}
      </button>
      {' '}
      <button onClick={() => window.print()} disabled={resultado.length === 0}>
        Imprimir
      </button>

      {erro && <p style={{ color: 'red' }}>{erro}</p>}

      {resultado.length > 0 && visao === 'sintetica' && (
        <table style={{ marginTop: '1.5rem', borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Unidade</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Titulares</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Corretor</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Período</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Pago</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Pendente</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Em atraso</th>
            </tr>
          </thead>
          <tbody>
            {resultado.map((linha) => (
              <tr key={linha.ocupacao_id}>
                <td style={{ padding: '4px 8px' }}>{linha.unidade_identificacao}</td>
                <td style={{ padding: '4px 8px' }}>{linha.cota_titulares}</td>
                <td style={{ padding: '4px 8px' }}>{linha.corretor_nome}</td>
                <td style={{ padding: '4px 8px' }}>
                  {formatarData(linha.ocupacao_data_inicial)} a {formatarData(linha.ocupacao_data_final)}
                </td>
                <td style={{ padding: '4px 8px' }}>R$ {linha.total_pago}</td>
                <td style={{ padding: '4px 8px' }}>R$ {linha.total_pendente}</td>
                <td style={{ padding: '4px 8px' }}>R$ {linha.total_em_atraso}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {resultado.length > 0 && visao === 'analitica' && (
        <table style={{ marginTop: '1.5rem', borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Unidade</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Titulares</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Corretor</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Período</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Valor</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Vencimento</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Pagamento</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Situação</th>
            </tr>
          </thead>
          <tbody>
            {resultado.map((linha) => (
              <tr key={linha.pagamento_id}>
                <td style={{ padding: '4px 8px' }}>{linha.unidade_identificacao}</td>
                <td style={{ padding: '4px 8px' }}>{linha.cota_titulares}</td>
                <td style={{ padding: '4px 8px' }}>{linha.corretor_nome}</td>
                <td style={{ padding: '4px 8px' }}>
                  {formatarData(linha.ocupacao_data_inicial)} a {formatarData(linha.ocupacao_data_final)}
                </td>
                <td style={{ padding: '4px 8px' }}>R$ {linha.valor}</td>
                <td style={{ padding: '4px 8px' }}>{formatarData(linha.data_vencimento)}</td>
                <td style={{ padding: '4px 8px' }}>{formatarData(linha.data_pagamento) || 'não pago'}</td>
                <td style={{ padding: '4px 8px' }}>{linha.situacao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!carregando && resultado.length === 0 && !erro && (
        <p style={{ marginTop: '1rem', color: '#666' }}>
          Escolha os filtros acima e clique em Consultar.
        </p>
      )}
    </div>
  );
}
