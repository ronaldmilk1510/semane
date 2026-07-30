import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function RelatorioCaixa() {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [visao, setVisao] = useState('cota');
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  async function consultar() {
    setCarregando(true);
    setErro('');
    setResultado(null);

    const nomeFuncao =
      visao === 'cota' ? 'relatorio_caixa_por_cota' :
      visao === 'geral' ? 'relatorio_caixa_geral' :
      'relatorio_caixa_por_titular';

    const { data, error } = await supabase.rpc(nomeFuncao, {
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
    setResultado(null);
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px' }}>
      <h2>Resultado de Caixa</h2>

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={() => trocarVisao('cota')} disabled={visao === 'cota'}>
          Por cota
        </button>
        {' '}
        <button onClick={() => trocarVisao('geral')} disabled={visao === 'geral'}>
          Geral
        </button>
        {' '}
        <button onClick={() => trocarVisao('titular')} disabled={visao === 'titular'}>
          Por titular
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <label>
          Período de
          <br />
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </label>

        <label>
          Período até
          <br />
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </label>
      </div>

      <button onClick={consultar} disabled={carregando}>
        {carregando ? 'Consultando...' : 'Consultar'}
      </button>
      {' '}
      <button onClick={() => window.print()} disabled={!resultado}>
        Imprimir
      </button>

      {erro && <p style={{ color: 'red' }}>{erro}</p>}

      {resultado && visao === 'cota' && (
        <table style={{ marginTop: '1.5rem', borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Unidade</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Titulares</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Entradas</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Saídas</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Saldo</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>A receber</th>
            </tr>
          </thead>
          <tbody>
            {resultado.map((linha) => (
              <tr key={linha.cota_id}>
                <td style={{ padding: '4px 8px' }}>{linha.unidade_identificacao}</td>
                <td style={{ padding: '4px 8px' }}>{linha.cota_titulares}</td>
                <td style={{ padding: '4px 8px' }}>R$ {linha.entradas}</td>
                <td style={{ padding: '4px 8px' }}>R$ {linha.saidas}</td>
                <td style={{ padding: '4px 8px' }}>R$ {linha.saldo}</td>
                <td style={{ padding: '4px 8px' }}>R$ {linha.a_receber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {resultado && visao === 'geral' && (
        <table style={{ marginTop: '1.5rem', borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Entradas</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Saídas</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Saldo</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>A receber</th>
            </tr>
          </thead>
          <tbody>
            {resultado.map((linha, indice) => (
              <tr key={indice}>
                <td style={{ padding: '4px 8px' }}>R$ {linha.entradas}</td>
                <td style={{ padding: '4px 8px' }}>R$ {linha.saidas}</td>
                <td style={{ padding: '4px 8px' }}>R$ {linha.saldo}</td>
                <td style={{ padding: '4px 8px' }}>R$ {linha.a_receber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {resultado && visao === 'titular' && (
        <table style={{ marginTop: '1.5rem', borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Proprietário</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Entradas</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Saídas</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Saldo</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>A receber</th>
            </tr>
          </thead>
          <tbody>
            {resultado.map((linha) => (
              <tr key={linha.proprietario_id}>
                <td style={{ padding: '4px 8px' }}>{linha.proprietario_nome}</td>
                <td style={{ padding: '4px 8px' }}>R$ {linha.entradas}</td>
                <td style={{ padding: '4px 8px' }}>R$ {linha.saidas}</td>
                <td style={{ padding: '4px 8px' }}>R$ {linha.saldo}</td>
                <td style={{ padding: '4px 8px' }}>R$ {linha.a_receber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!carregando && !resultado && !erro && (
        <p style={{ marginTop: '1rem', color: '#666' }}>
          Escolha o período (opcional) e clique em Consultar.
        </p>
      )}
    </div>
  );
}
