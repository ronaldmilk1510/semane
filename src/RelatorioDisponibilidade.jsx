import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './Relatorio.css';

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
    <div className="relatorio-page">
      <h2 className="relatorio-titulo">Disponibilidade de Semanas</h2>

      <div className="relatorio-filtros">
        <label className="relatorio-campo">
          <span>Empreendimento</span>
          <select value={empreendimentoId} onChange={(e) => setEmpreendimentoId(e.target.value)}>
            {empreendimentos.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.nome}</option>
            ))}
          </select>
        </label>

        <label className="relatorio-campo">
          <span>Ano de uso</span>
          <input
            type="number"
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            style={{ width: '90px' }}
          />
        </label>

        <label className="relatorio-campo">
          <span>Unidade (opcional)</span>
          <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
            <option value="">Todas</option>
            {unidades.map((un) => (
              <option key={un.id} value={un.id}>{un.identificacao}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="relatorio-acoes">
        <button className="relatorio-botao" onClick={consultar} disabled={!empreendimentoId || carregando}>
          {carregando ? 'Consultando...' : 'Consultar'}
        </button>
        <button
          className="relatorio-botao relatorio-botao-secundario"
          onClick={() => window.print()}
          disabled={resultado.length === 0}
        >
          Imprimir
        </button>
      </div>

      {erro && <p className="relatorio-erro">{erro}</p>}

      {resultado.length > 0 && (
        <div className="relatorio-quadro">
          <table className="relatorio-tabela" style={{ minWidth: '700px' }}>
            <thead>
              <tr>
                <th>Empreendimento</th>
                <th>Unidade</th>
                <th>Temporada</th>
                <th>Status</th>
                <th>Período</th>
              </tr>
            </thead>
            <tbody>
              {resultado.map((linha) => (
                <tr key={linha.semana_id} className={!linha.data_inicial ? 'relatorio-linha-secundaria' : ''}>
                  <td>{linha.empreendimento_nome}</td>
                  <td>{linha.unidade_identificacao}</td>
                  <td>{linha.temporada_nome}</td>
                  <td>{linha.status}</td>
                  <td>
                    {linha.data_inicial
                      ? linha.data_inicial.split('-').reverse().join('/') + ' a ' + linha.data_final.split('-').reverse().join('/')
                      : 'ainda não reservada'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!carregando && resultado.length === 0 && !erro && (
        <p className="relatorio-vazio">
          Escolha os filtros acima e clique em Consultar.
        </p>
      )}
    </div>
  );
}
