import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { formatarMoeda } from './utils';
import './Relatorio.css';

function formatarData(data) {
  if (!data) return null;
  return data.split('-').reverse().join('/');
}

export default function RelatorioLocacoes() {
  const [todasUnidades, setTodasUnidades] = useState([]);
  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [corretores, setCorretores] = useState([]);
  const [empreendimentoId, setEmpreendimentoId] = useState('');
  const [unidadeId, setUnidadeId] = useState('');
  const [corretorId, setCorretorId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [situacao, setSituacao] = useState('');
  const [visao, setVisao] = useState('sintetica');
  const [resultado, setResultado] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregarFiltros() {
      const { data: unidadesData } = await supabase
        .from('unidades')
        .select('id, identificacao, blocos ( empreendimento_id, empreendimentos ( nome ) )');
      if (unidadesData) setTodasUnidades(unidadesData);

      const { data: empreendimentosData } = await supabase.from('empreendimentos').select('id, nome');
      if (empreendimentosData) setEmpreendimentos(empreendimentosData);

      const { data: corretoresData } = await supabase.from('corretores').select('id, nome');
      if (corretoresData) setCorretores(corretoresData);
    }
    carregarFiltros();
  }, []);

  function alterarEmpreendimento(valor) {
    setEmpreendimentoId(valor);
    setUnidadeId('');
  }

  const unidadesFiltradas = todasUnidades
    .filter((un) => !empreendimentoId || un.blocos?.empreendimento_id === empreendimentoId)
    .map((un) => ({
      id: un.id,
      rotulo: empreendimentoId ? un.identificacao : `${un.blocos?.empreendimentos?.nome ?? ''} · ${un.identificacao}`,
    }));

  async function consultar() {
    setCarregando(true);
    setErro('');
    setResultado([]);

    const nomeFuncao = visao === 'sintetica' ? 'relatorio_locacoes_sintetico' : 'relatorio_locacoes_analitico';

    const parametros = {
      p_unidade_id: unidadeId || null,
      p_corretor_id: corretorId || null,
      p_data_inicio: dataInicio || null,
      p_data_fim: dataFim || null,
      p_empreendimento_id: empreendimentoId || null,
    };
    if (visao === 'analitica') {
      parametros.p_situacao = situacao || null;
    }

    const { data, error } = await supabase.rpc(nomeFuncao, parametros);

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
    setSituacao('');
  }

  return (
    <div className="relatorio-page">
      <h2 className="relatorio-titulo">Locações</h2>

      <div className="relatorio-abas">
        <button
          className={`relatorio-aba${visao === 'sintetica' ? ' relatorio-aba-ativa' : ''}`}
          onClick={() => trocarVisao('sintetica')}
        >
          Visão sintética
        </button>
        <button
          className={`relatorio-aba${visao === 'analitica' ? ' relatorio-aba-ativa' : ''}`}
          onClick={() => trocarVisao('analitica')}
        >
          Visão analítica
        </button>
      </div>

      <div className="relatorio-filtros">
        <label className="relatorio-campo">
          <span>Empreendimento (opcional)</span>
          <select value={empreendimentoId} onChange={(e) => alterarEmpreendimento(e.target.value)}>
            <option value="">Todos</option>
            {empreendimentos.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.nome}</option>
            ))}
          </select>
        </label>

        <label className="relatorio-campo">
          <span>Unidade (opcional)</span>
          <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
            <option value="">Todas</option>
            {unidadesFiltradas.map((un) => (
              <option key={un.id} value={un.id}>{un.rotulo}</option>
            ))}
          </select>
        </label>

        <label className="relatorio-campo">
          <span>Corretor (opcional)</span>
          <select value={corretorId} onChange={(e) => setCorretorId(e.target.value)}>
            <option value="">Todos</option>
            {corretores.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>

        <label className="relatorio-campo">
          <span>Vencimento de</span>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </label>

        <label className="relatorio-campo">
          <span>Vencimento até</span>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </label>

        {visao === 'analitica' && (
          <label className="relatorio-campo">
            <span>Situação</span>
            <select value={situacao} onChange={(e) => setSituacao(e.target.value)}>
              <option value="">Todos</option>
              <option value="Pago">Pago</option>
              <option value="Pendente">Pendente</option>
              <option value="Em atraso">Em atraso</option>
            </select>
          </label>
        )}
      </div>

      <div className="relatorio-acoes">
        <button className="relatorio-botao" onClick={consultar} disabled={carregando}>
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

      {resultado.length > 0 && visao === 'sintetica' && (
        <div className="relatorio-quadro">
          <table className="relatorio-tabela" style={{ minWidth: '900px' }}>
            <thead>
              <tr>
                <th>Empreendimento</th>
                <th>Unidade</th>
                <th>Titulares</th>
                <th>Corretor</th>
                <th>Período</th>
                <th>Pago</th>
                <th>Pendente</th>
                <th>Em atraso</th>
              </tr>
            </thead>
            <tbody>
              {resultado.map((linha) => (
                <tr key={linha.ocupacao_id}>
                  <td>{linha.empreendimento_nome}</td>
                  <td>{linha.unidade_identificacao}</td>
                  <td>{linha.cota_titulares}</td>
                  <td>{linha.corretor_nome}</td>
                  <td>
                    {formatarData(linha.ocupacao_data_inicial)} a {formatarData(linha.ocupacao_data_final)}
                  </td>
                  <td>{formatarMoeda(linha.total_pago)}</td>
                  <td>{formatarMoeda(linha.total_pendente)}</td>
                  <td>{formatarMoeda(linha.total_em_atraso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resultado.length > 0 && visao === 'analitica' && (
        <div className="relatorio-quadro">
          <table className="relatorio-tabela" style={{ minWidth: '950px' }}>
            <thead>
              <tr>
                <th>Empreendimento</th>
                <th>Unidade</th>
                <th>Titulares</th>
                <th>Corretor</th>
                <th>Período</th>
                <th>Valor</th>
                <th>Vencimento</th>
                <th>Pagamento</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {resultado.map((linha) => (
                <tr key={linha.pagamento_id}>
                  <td>{linha.empreendimento_nome}</td>
                  <td>{linha.unidade_identificacao}</td>
                  <td>{linha.cota_titulares}</td>
                  <td>{linha.corretor_nome}</td>
                  <td>
                    {formatarData(linha.ocupacao_data_inicial)} a {formatarData(linha.ocupacao_data_final)}
                  </td>
                  <td>{formatarMoeda(linha.valor)}</td>
                  <td>{formatarData(linha.data_vencimento)}</td>
                  <td>{formatarData(linha.data_pagamento) || 'não pago'}</td>
                  <td>{linha.situacao}</td>
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
