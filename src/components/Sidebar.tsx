'use client';

import React from 'react';
import {
  Zap,
  UploadCloud,
  Search,
  Building2,
  Settings,
  Wifi,
  WifiOff,
  FlaskConical,
  X,
} from 'lucide-react';
import { AmbienteTUST } from '@/types/tust';

interface SidebarProps {
  activeTab: 'upload' | 'pendencias' | 'transmissoras' | 'config';
  onSelectTab: (tab: 'upload' | 'pendencias' | 'transmissoras' | 'config') => void;
  transmissorasCount: number;
  ambiente: AmbienteTUST;
  isAutenticado: boolean;
  modoTeste: boolean;
  onToggleModoTeste: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  transmissorasCount,
  ambiente,
  isAutenticado,
  modoTeste,
  onToggleModoTeste,
  isOpenMobile,
  onCloseMobile,
}) => {
  return (
    <>
      {/* Overlay Mobile */}
      {isOpenMobile && (
        <div className="sidebar-overlay" onClick={onCloseMobile} />
      )}

      <aside className={`app-sidebar ${isOpenMobile ? 'open' : ''}`}>
        {/* Top Header / Branding */}
        <div className="sidebar-header">
          <div className="brand-logo-badge">
            <Zap size={20} />
          </div>
          <div className="brand-info">
            <div className="brand-title">
              <span>TUST Uploader</span>
              <span className="brand-badge">Vercel</span>
            </div>
            <div className="brand-subtitle">
              Conciliação Inteligente
            </div>
          </div>
          {isOpenMobile && (
            <button
              type="button"
              className="btn-icon mobile-close-btn"
              onClick={onCloseMobile}
              aria-label="Fechar menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Section Title */}
        <div className="sidebar-section-title">MENU PRINCIPAL</div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => {
              onSelectTab('upload');
              onCloseMobile();
            }}
          >
            <UploadCloud size={18} />
            <span>Processar & Upload</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'pendencias' ? 'active' : ''}`}
            onClick={() => {
              onSelectTab('pendencias');
              onCloseMobile();
            }}
          >
            <Search size={18} />
            <span>Consultar & Sanear</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'transmissoras' ? 'active' : ''}`}
            onClick={() => {
              onSelectTab('transmissoras');
              onCloseMobile();
            }}
          >
            <Building2 size={18} />
            <span>Transmissoras</span>
            <span className="nav-badge">{transmissorasCount}</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => {
              onSelectTab('config');
              onCloseMobile();
            }}
          >
            <Settings size={18} />
            <span>Configurações & Acesso</span>
          </button>
        </nav>

        {/* Sidebar Status Card */}
        <div className="sidebar-footer-widget">
          <div className="widget-header">
            <span className="widget-title">Status da Sessão</span>
            <span className={`status-dot ${isAutenticado ? 'online' : 'warning'}`} />
          </div>

          <div className="widget-row">
            <div className="widget-label">
              {isAutenticado ? <Wifi size={13} /> : <WifiOff size={13} />}
              <span>{ambiente.nome}</span>
            </div>
            <span className={`badge ${isAutenticado ? 'badge-success' : 'badge-warning'}`}>
              {isAutenticado ? 'Conectado' : 'Offline'}
            </span>
          </div>

          <div className="widget-row">
            <div className="widget-label">
              <FlaskConical size={13} />
              <span>{modoTeste ? 'Modo Teste' : 'Modo Produção'}</span>
            </div>
            <button
              type="button"
              className={`widget-toggle-btn ${modoTeste ? 'active' : ''}`}
              onClick={onToggleModoTeste}
              title={modoTeste ? 'Clique para mudar para Produção' : 'Clique para mudar para Modo Teste'}
            >
              {modoTeste ? 'Teste' : 'Prod'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
