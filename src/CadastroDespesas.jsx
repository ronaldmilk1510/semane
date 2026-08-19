import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { formatarMoeda } from './utils';
import CampoValorMonetario from './CampoValorMonetario';

function formatarNomes(nomes) {
  if (nomes.length === 0) return '';
  if (nomes.length === 1) return nomes[0];
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
}

function formatarDataBr(data) {
  if (!data) return '';
  return data.split('-').reverse().join('/');
}

function converterParaNumero(texto) {
  const normalizado = texto.trim().replace(/\./g, '').replace(',', '.');
  return Number(normalizado);
}

function hojeISO() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

const nomesMeses = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const tiposDespesa = [
  { valor: 'condomínio', rotulo: 'Condomínio' },
  { valor: 'parcela de aquisição', rotulo: 'Parcela de aquisição' },
  { valor: 'encargo de rede', rotulo: 'Encargo de rede' },
  { valor: 'retirada de lucro', rotulo: 'Retirada de lucro' },
  { valor: 'outra', rotulo: 'Outra' },
];

const rotuloTipo = Object.fromEntries(tiposDespesa.map((item) => [item.valor, item.rotulo]));

export default function CadastroDespesas() {
  const [cotas, setCotas] = useState([]);
  const [carregandoCotas, setCarregandoCotas] = useState(true);
  const [erroCotas, setErroCotas] = useState('');

  const [cotaSelecionadaId, setCotaSelecionadaId] = useState('');
  const [despesas, setDespesas] = useState([]);
  const [carregandoDespesas, setCarregandoDespesas] = useState(false);
  const [erroDespesas, setErroDespesas] = useState('');
  const [anoFiltro, setAnoFiltro] = useState(String(new Date().getFullYear()));

  const [tipoForm, setTipoForm] = useState('');
  const [descricaoForm, setDescricaoForm] = useState('');
  const [proprietarioIdForm, setProprietarioIdForm] = useState('');
  const [valorForm, setValorForm] = useState('');
  const [dataForm, setDataForm] = useState(hojeISO());
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const [despesaParaExcluir, setDespesaParaExcluir] = useState(null);
  const [excluindoDespesa, setExcluindoDespesa] = useState(false);
  const [erroExclusaoDespesa, setErroExclusaoDespesa] = useState('');

  async function carregarCotas() {
    setCarregandoCotas(true);
    setErroCotas('');

    const { data, error } = await supabase
      .from('cotas')
      .select(
        'id, unidade_id, unidades ( identificacao, blocos ( empreendimentos ( nome ) ) ), titulares_cota ( proprietario_id, proprietarios ( nome ) )'
      );

    setCarregandoCotas(false);

    if (error) {
      setErroCotas('Não foi possível carregar as cotas. Tente novamente.');
      return;
    }

    setCotas(
      data.map((item) => {
        const empreendimentoNome = item.unidades?.blocos?.empreendimentos?.nome ?? '';
        const identificacao = item.unidades?.identificacao ?? '';
        const titulares = formatarNomes(
          (item.titulares_cota || []).map((titular) => titular.proprietarios?.nome).filter(Boolean)
        );
        return {
          id: item.id,
          descricao: `${empreendimentoNome}, ${identificacao}, ${titulares}`,
          titulares: (item.titulares_cota || [])
            .filter((titular) => titular.proprietario_id)
            .map((titular) => ({ id: titular.proprietario_id, nome: titular.proprietarios?.nome ?? '' })),
        };
      })
    );
  }

  useEffect(() => {
    carregarCotas();
  }, []);

  async function carregarDespesas(cotaId) {
    setCarregandoDespesas(true);
    setErroDespesas('');
    setErroForm('');
    setTipoForm('');
    setDescricaoForm('');
    setProprietarioIdForm('');
    setValorForm('');
    setDataForm(hojeISO());

    const { data, error } = await supabase
      .from('despesas')
      .select('*')
      .eq('cota_id', cotaId)
      .order('created_at', { ascending: false });

    setCarregandoDespesas(false);

    if (error) {
      setErroDespesas('Não foi possível carregar as despesas desta cota. Tente novamente.');
      return;
    }

    setDespesas(data);
  }

  function selecionarCota(id) {
    setCotaSelecionadaId(id);
    setAnoFiltro(String(new Date().getFullYear()));
    if (id) {
      carregarDespesas(id);
    } else {
      setDespesas([]);
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

  const anosComDespesas = new Set(
    despesas.map((despesa) => despesa.data?.slice(0, 4)).filter(Boolean)
  );
  anosComDespesas.add(String(new Date().getFullYear()));
  const anosDisponiveis = Array.from(anosComDespesas).sort((a, b) => Number(b) - Number(a));

  const despesasDoAno = despesas
    .filter((despesa) => despesa.data?.slice(0, 4) === anoFiltro)
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

  const gruposDespesas = [];
  despesasDoAno.forEach((despesa) => {
    const mes = despesa.data.slice(5, 7);
    const grupoAtual = gruposDespesas[gruposDespesas.length - 1];
    if (!grupoAtual || grupoAtual.mes !== mes) {
      gruposDespesas.push({ mes, itens: [despesa] });
    } else {
      grupoAtual.itens.push(despesa);
    }
  });

  async function salvar(event) {
    event.preventDefault();
    setErroForm('');

    if (!tipoForm) {
      setErroForm('Selecione o tipo da despesa.');
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
    if (!dataForm) {
      setErroForm('Informe a data do lançamento.');
      return;
    }

    setSalvando(true);

    const { error } = await supabase.from('despesas').insert({
      cota_id: cotaSelecionadaId,
      tipo: tipoForm,
      origem: 'avulsa',
      despesa_recorrente_id: null,
      valor: valorNumero,
      data: dataForm,
      descricao: descricaoForm.trim(),
      proprietario_id: exigeProprietario ? proprietarioIdForm : null,
    });

    setSalvando(false);

    if (error) {
      setErroForm('Não foi possível salvar a despesa. Tente novamente.');
      return;
    }

    carregarDespesas(cotaSelecionadaId);
  }

  function pedirExclusao(despesa) {
    setDespesaParaExcluir(despesa);
    setErroExclusaoDespesa('');
  }

  function cancelarExclusao() {
    setDespesaParaExcluir(null);
    setErroExclusaoDespesa('');
  }

  async function confirmarExclusao() {
    setExcluindoDespesa(true);
    setErroExclusaoDespesa('');

    const { error } = await supabase.from('despesas').delete().eq('id', despesaParaExcluir.id);

    setExcluindoDespesa(false);

    if (error) {
      setErroExclusaoDespesa('Não foi possível excluir esta despesa. Tente novamente.');
      return;
    }

    setDespesaParaExcluir(null);
    carregarDespesas(cotaSelecionadaId);
  }

  return (
    <div>
      <h2>Despesas em geral</h2>

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
        <p className="pa-lista-vazia">Escolha uma cota para ver ou lançar suas despesas.</p>
      )}

      {cotaSelecionadaId && (
        <>
          {erroDespesas && <p className="pa-erro">{erroDespesas}</p>}

          {carregandoDespesas ? (
            <p className="pa-lista-vazia">Carregando despesas...</p>
          ) : (
            <>
              <label>
                Filtrar por ano
                <select
                  className="pa-campo"
                  value={anoFiltro}
                  onChange={(event) => setAnoFiltro(event.target.value)}
                >
                  {anosDisponiveis.map((ano) => (
                    <option key={ano} value={ano}>
                      {ano}
                    </option>
                  ))}
                </select>
              </label>

              {gruposDespesas.map((grupo) => (
                <div key={grupo.mes} style={{ marginTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>
                    {`${nomesMeses[Number(grupo.mes) - 1]} ${anoFiltro}`}
                  </h4>
                  <table className="pa-tabela">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Valor</th>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.itens.map((despesa) => (
                        <tr key={despesa.id}>
                          <td>{rotuloTipo[despesa.tipo] ?? despesa.tipo}</td>
                          <td>{formatarMoeda(Number(despesa.valor))}</td>
                          <td>{formatarDataBr(despesa.data)}</td>
                          <td>{despesa.descricao || '—'}</td>
                          <td>
                            <button
                              type="button"
                              className="pa-botao-texto pa-botao-texto-aviso"
                              onClick={() => pedirExclusao(despesa)}
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {despesasDoAno.length === 0 && (
                <p className="pa-lista-vazia">Nenhuma despesa cadastrada para esta cota em {anoFiltro}.</p>
              )}

              <form onSubmit={salvar} style={{ marginTop: '1.5rem' }}>
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
                    <CampoValorMonetario value={valorForm} onChange={setValorForm} />
                  </label>

                  <label>
                    Data do lançamento
                    <input
                      type="date"
                      className="pa-campo"
                      value={dataForm}
                      onChange={(event) => setDataForm(event.target.value)}
                    />
                  </label>
                </div>

                {erroForm && <p className="pa-erro">{erroForm}</p>}

                <div className="pa-modal-acoes" style={{ justifyContent: 'flex-start', marginTop: '1rem' }}>
                  <button type="submit" className="pa-botao" disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar despesa'}
                  </button>
                </div>
              </form>
            </>
          )}
        </>
      )}

      {despesaParaExcluir && (
        <div className="pa-modal-backdrop" onClick={cancelarExclusao}>
          <div className="pa-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Excluir despesa</h3>
            <p>
              Excluir a despesa de {rotuloTipo[despesaParaExcluir.tipo] ?? despesaParaExcluir.tipo} no valor de{' '}
              {formatarMoeda(Number(despesaParaExcluir.valor))} em {formatarDataBr(despesaParaExcluir.data)}? Esta
              ação não pode ser desfeita.
            </p>
            {erroExclusaoDespesa && <p className="pa-erro">{erroExclusaoDespesa}</p>}
            <div className="pa-modal-acoes">
              <button type="button" className="pa-botao pa-botao-secundario" onClick={cancelarExclusao}>
                Cancelar
              </button>
              <button
                type="button"
                className="pa-botao pa-botao-perigo"
                onClick={confirmarExclusao}
                disabled={excluindoDespesa}
              >
                {excluindoDespesa ? 'Excluindo...' : 'Excluir despesa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
