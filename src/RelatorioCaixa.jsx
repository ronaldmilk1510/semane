import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './Relatorio.css';

export default function RelatorioCaixa() {
  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [empreendimentoId, setEmpreendimentoId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [visao, setVisao] = useState('cota');
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregarEmpreendimentos() {
      const { data } = await supabase.from('empreendimentos').select('id, nome');
      if (data) setEmpreendimentos(data);
    }
    carregarEmpreendimentos();
  }, []);

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
      p_empreendimento_id: empreendimentoId || null,
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
    <div className="relatorio-page">
      <h2 className="relatorio-titulo">Resultado de Caixa</h2>

      <div className="relatorio-abas">
        <button
          className={`relatorio-aba${visao === 'cota' ? ' relatorio-aba-ativa' : ''}`}
          onClick={() => trocarVisao('cota')}
        >
          Por cota
        </button>
        <button
          className={`relatorio-aba${visao === 'geral' ? ' relatorio-aba-ativa' : ''}`}
          onClick={() => trocarVisao('geral')}
        >
          Geral
        </button>
        <button
          className={`relatorio-aba${visao === 'titular' ? ' relatorio-aba-ativa' : ''}`}
          onClick={() => trocarVisao('titular')}
        >
          Por titular
        </button>
      </div>

      <div className="relatorio-filtros">
        <label className="relatorio-campo">
          <span>Empreendimento (opcional)</span>
          <select value={empreendimentoId} onChange={(e) => setEmpreendimentoId(e.target.value)}>
            <option value="">Todos</option>
            {empreendimentos.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.nome}</option>
            ))}
          </select>
        </label>

        <label className="relatorio-campo">
          <span>Período de</span>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </label>

        <label className="relatorio-campo">
          <span>Período até</span>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </label>
      </div>

      <div className="relatorio-acoes">
        <button className="relatorio-botao" onClick={consultar} disabled={carregando}>
          {carregando ? 'Consultando...' : 'Consultar'}
        </button>
        <button
          className="relatorio-botao relatorio-botao-secundario"
          onClick={() => window.print()}
          disabled={!resultado}
        >
          Imprimir
        </button>
      </div>

      {erro && <p className="relatorio-erro">{erro}</p>}

      {resultado && visao === 'cota' && (
        <div className="relatorio-quadro">
          <table className="relatorio-tabela" style={{ minWidth: '900px' }}>
            <thead>
              <tr>
                <th>Empreendimento</th>
                <th>Unidade</th>
                <th>Titulares</th>
                <th>Saldo inicial</th>
                <th>Data de corte</th>
                <th>Entradas</th>
                <th>Saídas</th>
                <th>Saldo</th>
                <th>A receber</th>
              </tr>
            </thead>
            <tbody>
              {resultado.map((linha) => (
                <tr key={linha.cota_id}>
                  <td>{linha.empreendimento_nome}</td>
                  <td>{linha.unidade_identificacao}</td>
                  <td>{linha.cota_titulares}</td>
                  <td>R$ {linha.saldo_inicial}</td>
                  <td>{linha.data_corte ? linha.data_corte.split('-').reverse().join('/') : '—'}</td>
                  <td>R$ {linha.entradas}</td>
                  <td>R$ {linha.saidas}</td>
                  <td>R$ {linha.saldo}</td>
                  <td>R$ {linha.a_receber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resultado && visao === 'geral' && (
        <div className="relatorio-quadro">
          <table className="relatorio-tabela" style={{ minWidth: '600px' }}>
            <thead>
              <tr>
                <th>Saldo inicial</th>
                <th>Entradas</th>
                <th>Saídas</th>
                <th>Saldo</th>
                <th>A receber</th>
              </tr>
            </thead>
            <tbody>
              {resultado.map((linha, indice) => (
                <tr key={indice}>
                  <td>R$ {linha.saldo_inicial}</td>
                  <td>R$ {linha.entradas}</td>
                  <td>R$ {linha.saidas}</td>
                  <td>R$ {linha.saldo}</td>
                  <td>R$ {linha.a_receber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resultado && visao === 'titular' && (
        <div className="relatorio-quadro">
          <table className="relatorio-tabela" style={{ minWidth: '750px' }}>
            <thead>
              <tr>
                <th>Proprietário</th>
                <th>Saldo inicial</th>
                <th>Entradas</th>
                <th>Saídas</th>
                <th>Saldo</th>
                <th>A receber</th>
              </tr>
            </thead>
            <tbody>
              {resultado.map((linha) => (
                <tr key={linha.proprietario_id}>
                  <td>{linha.proprietario_nome}</td>
                  <td>R$ {linha.saldo_inicial}</td>
                  <td>R$ {linha.entradas}</td>
                  <td>R$ {linha.saidas}</td>
                  <td>R$ {linha.saldo}</td>
                  <td>R$ {linha.a_receber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!carregando && !resultado && !erro && (
        <p className="relatorio-vazio">
          Escolha o período (opcional) e clique em Consultar.
        </p>
      )}
    </div>
  );
}
