import { useState } from 'react';
import CadastroEmpreendimentos from './CadastroEmpreendimentos';
import CadastroBlocos from './CadastroBlocos';
import CadastroUnidades from './CadastroUnidades';
import CadastroTemporadas from './CadastroTemporadas';
import CadastroProprietarios from './CadastroProprietarios';
import RelatorioDisponibilidade from './RelatorioDisponibilidade';
import RelatorioLocacoes from './RelatorioLocacoes';
import RelatorioCaixa from './RelatorioCaixa';
import './PainelAdministrador.css';

const grupos = [
  {
    id: 'cadastros',
    titulo: 'Cadastros',
    itens: [
      { id: 'empreendimentos', titulo: 'Empreendimentos', Componente: CadastroEmpreendimentos },
      { id: 'blocos', titulo: 'Blocos', Componente: CadastroBlocos },
      { id: 'unidades', titulo: 'Unidades', Componente: CadastroUnidades },
      { id: 'temporadas', titulo: 'Temporadas', Componente: CadastroTemporadas },
      { id: 'proprietarios', titulo: 'Proprietários', Componente: CadastroProprietarios },
    ],
  },
  {
    id: 'relatorios',
    titulo: 'Relatórios',
    itens: [
      { id: 'disponibilidade', titulo: 'Disponibilidade de Semanas', Componente: RelatorioDisponibilidade },
      { id: 'locacoes', titulo: 'Locações', Componente: RelatorioLocacoes },
      { id: 'caixa', titulo: 'Resultado de Caixa', Componente: RelatorioCaixa },
    ],
  },
];

export default function PainelAdministrador({ session, onLogout }) {
  const [telaSelecionada, setTelaSelecionada] = useState('cadastros.empreendimentos');
  const [menuAberto, setMenuAberto] = useState(false);

  const grupoAtual = grupos.find((grupo) =>
    grupo.itens.some((item) => `${grupo.id}.${item.id}` === telaSelecionada)
  );
  const itemAtual = grupoAtual?.itens.find(
    (item) => `${grupoAtual.id}.${item.id}` === telaSelecionada
  );

  function selecionarTela(idTela) {
    setTelaSelecionada(idTela);
    setMenuAberto(false);
  }

  return (
    <div className={`painel-administrador${menuAberto ? ' pa-menu-aberto' : ''}`}>
      <div className="pa-topbar">
        <button
          type="button"
          className="pa-botao-menu"
          aria-label="Abrir menu"
          onClick={() => setMenuAberto((aberto) => !aberto)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <span className="pa-topbar-titulo">Multiprop</span>
      </div>

      <div className="pa-layout">
        <aside className="pa-sidebar">
          <div className="pa-sidebar-usuario">
            <p>Logado como {session.user.email}</p>
            <button type="button" className="pa-botao pa-botao-secundario" onClick={onLogout}>
              Sair
            </button>
          </div>

          {grupos.map((grupo) => (
            <div className="pa-grupo" key={grupo.id}>
              <p className="pa-grupo-titulo">{grupo.titulo}</p>
              <ul className="pa-grupo-itens">
                {grupo.itens.map((item) => {
                  const idTela = `${grupo.id}.${item.id}`;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`pa-item-link${idTela === telaSelecionada ? ' pa-item-ativo' : ''}`}
                        onClick={() => selecionarTela(idTela)}
                      >
                        {item.titulo}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </aside>

        <div className="pa-backdrop" onClick={() => setMenuAberto(false)}></div>

        <main className="pa-conteudo">
          {grupoAtual && itemAtual && (
            <>
              <p className="pa-breadcrumb">
                {grupoAtual.titulo} &gt; {itemAtual.titulo}
              </p>
              <itemAtual.Componente />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
