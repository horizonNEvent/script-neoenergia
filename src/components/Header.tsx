'use client';

import React from 'react';
import { Menu, ShieldCheck, Calendar, FlaskConical, Wifi, WifiOff } from 'lucide-react';
import { AmbienteTUST } from '@/types/tust';

interface HeaderProps {
  ambiente: AmbienteTUST;
  competencia: string;
  isAutenticado: boolean;
  modoTeste: boolean;
  activeTabTitle: string;
  onToggleMobileMenu: () => void;
  onOpenSettings: () => void;
  onToggleModoTeste: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  ambiente,
  competencia,
  isAutenticado,
  modoTeste,
  activeTabTitle,
  onToggleMobileMenu,
  onOpenSettings,
  onToggleModoTeste,
}) => {
  // Converte "2026-02-01T03:00:00.000Z" em "02/2026"
  const compLabel = React.useMemo(() => {
    try {
      const parts = competencia.split('-');
      if (parts.length >= 2) {
        return `${parts[1]}/${parts[0]}`;
      }
      return competencia;
    } catch {
      return competencia;
    }
  }, [competencia]);

  return (
    <header className="main-topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="btn-icon mobile-menu-btn"
          onClick={onToggleMobileMenu}
          title="Abrir menu"
          aria-label="Abrir menu lateral"
        >
          <Menu size={20} />
        </button>
        <h1 className="page-title">{activeTabTitle}</h1>
      </div>

      <div className="header-status-group">
        {/* Ambiente Status */}
        <div
          className={`status-pill ${isAutenticado ? 'active' : ''}`}
          onClick={onOpenSettings}
          style={{ cursor: 'pointer' }}
          title="Clique para alterar ambiente e credenciais"
        >
          {isAutenticado ? (
            <Wifi size={13} />
          ) : (
            <WifiOff size={13} />
          )}
          <span>{ambiente.nome}</span>
          <span className={`status-dot ${isAutenticado ? 'online' : 'warning'}`} />
        </div>

        {/* Competência Atual */}
        <div className="status-pill" title="Competência selecionada">
          <Calendar size={13} />
          <span>Comp: <strong>{compLabel}</strong></span>
        </div>

        {/* Modo Teste Switch */}
        <button
          type="button"
          onClick={onToggleModoTeste}
          className={`status-pill ${modoTeste ? 'test-mode' : ''}`}
          style={{ cursor: 'pointer' }}
          title={modoTeste ? 'Modo Teste ATIVO: Nenhuma alteração real no TUST' : 'Modo Real: Uploads serão efetivados'}
        >
          <FlaskConical size={13} />
          <span>{modoTeste ? 'Modo Teste' : 'Modo Produção'}</span>
        </button>

        {/* Autenticação Status */}
        <div className={`status-pill ${isAutenticado ? 'active' : ''}`}>
          <ShieldCheck size={13} />
          <span>{isAutenticado ? 'Sessão Ativa' : 'Não Autenticado'}</span>
        </div>
      </div>
    </header>
  );
};

