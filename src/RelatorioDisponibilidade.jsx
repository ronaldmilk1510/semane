import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function RelatorioDisponibilidade() {
  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [empreendimentoId, setEmpreendimentoId] = useState('');
  const [ano, setAno] = useState(new Date().getFullYear() + 1);
  const [unidadeId, setUnidadeId] = useState('');
  const [resultado, setResultado] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregarEmpreendimentos() {
      const { data, error } = await supabase.from('empreendimentos').select('id, nome');
      if (error) {
        setErro('Não foi possível carregar os empreendimentos.');
        return;
      }
      setEmpreendimentos(data);
      if (data.length > 0) setEmpreendimentoId(data[0].id);
    }
    carregarEmpreendimentos();
  }, []);

  useEffect(() => {
    async function carregarUnidades() {
      if (!empreendimentoId) {
        setUnidades([]);
        return;
      }
      const { data: blocosData, error: blocosError } = await supabase
        .from('blocos')
        .select('id')
        .eq('empreendimento_id', empreendimentoId);
      if (blocosError || !blocosData || blocosData.length === 0) {
        setUnidades([]);
        return;
      }
      const blocoIds = blocosData.map((b) => b.id);
      const { data: unidadesData, error: unidadesError } = await supabase
        .from('unidades')
        .select('id, identificacao')
        .in('bloco_id', blocoIds);
      if (unidadesError) {
        setUnidades([]);
        return;
      }
      setUnidades(unidadesData);
      setUnidadeId('');
    }
    carregarUnidades();
  }, [empreendimentoId]);

  async function consultar() {
    setCarregando(true);
    setErro('');
    setResultado([]);
    const { data, error } = await supabase.rpc('relatorio_disponibilidade_semanas', {
      p_empreendimento_id: empreendimentoId,
      p_ano: Number(ano),
      p_unidade_id: unidadeId || null,
    });
    setCarregando(false);
    if (error) {
      setErro('Não foi possível consultar o relatório. Detalhe: ' + error.message);
      return;
    }
    setResultado(data);
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '800px' }}>
      <h2>Disponibilidade de Semanas</h2>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <label>
          Empreendimento
          <br />
          <select value={empreendimentoId} onChange={(e) => setEmpreendimentoId(e.target.value)}>
            {empreendimentos.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.nome}</option>
            ))}
          </select>
        </label>

        <label>
          Ano de uso
          <br />
          <input
            type="number"
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            style={{ width: '90px' }}
          />
        </label>

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
      </div>

      <button onClick={consultar} disabled={!empreendimentoId || carregando}>
        {carregando ? 'Consultando...' : 'Consultar'}
      </button>
      {' '}
      <button onClick={() => window.print()} disabled={resultado.length === 0}>
        Imprimir
      </button>

      {erro && <p style={{ color: 'red' }}>{erro}</p>}

      {resultado.length > 0 && (
        <table style={{ marginTop: '1.5rem', borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Unidade</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Temporada</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Status</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Período</th>
            </tr>
          </thead>
          <tbody>
            {resultado.map((linha) => (
              <tr key={linha.semana_id}>
                <td style={{ padding: '4px 8px' }}>{linha.unidade_identificacao}</td>
                <td style={{ padding: '4px 8px' }}>{linha.temporada_nome}</td>
                <td style={{ padding: '4px 8px' }}>{linha.status}</td>
                <td style={{ padding: '4px 8px' }}>
                  {linha.data_inicial
                    ? linha.data_inicial.split('-').reverse().join('/') + ' a ' + linha.data_final.split('-').reverse().join('/')
                    : 'ainda não reservada'}
                </td>
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
