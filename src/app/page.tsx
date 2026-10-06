'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { UploadTab } from '@/components/UploadTab';
import { PendenciasTab } from '@/components/PendenciasTab';
import { TransmissorasTab } from '@/components/TransmissorasTab';
import { ConfigTab } from '@/components/ConfigTab';
import { AmbienteTUST, Transmissora } from '@/types/tust';
import { AMBIENTES_TUST, DEFAULT_TRANSMISSORAS } from '@/lib/constants';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'upload' | 'pendencias' | 'transmissoras' | 'config'>('upload');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Ambiente e Credenciais
  const [ambiente, setAmbiente] = useState<AmbienteTUST>(AMBIENTES_TUST[0]);
  const [username, setUsername] = useState<string>('BRUNOVOLLU');
  const [password, setPassword] = useState<string>('Bvlu@2023');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [cookies, setCookies] = useState<string>('');
  const [isAutenticado, setIsAutenticado] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Competência padrão (Mês M-1: mês anterior ao atual)
  const [competencia, setCompetencia] = useState<string>(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prev.getFullYear();
    const month = String(prev.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01T03:00:00.000Z`;
  });
  const [modoTeste, setModoTeste] = useState<boolean>(false);

  // Transmissoras
  const [transmissoras, setTransmissoras] = useState<Transmissora[]>(DEFAULT_TRANSMISSORAS);
  const [selectedTransmissoras, setSelectedTransmissoras] = useState<string[]>([]);

  // Carrega configurações do localStorage
  useEffect(() => {
    try {
      const savedTrans = localStorage.getItem('tust_transmissoras');
      if (savedTrans) {
        const parsed = JSON.parse(savedTrans);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTransmissoras(parsed);
          setSelectedTransmissoras(parsed.map((t: Transmissora) => t.Transmissora));
          return;
        }
      }
    } catch (e) {
      console.warn('Erro ao ler transmissoras do localStorage:', e);
    }

    setSelectedTransmissoras(DEFAULT_TRANSMISSORAS.map((t) => t.Transmissora));
  }, []);

  // Salva transmissoras no localStorage
  const saveTransmissoras = (list: Transmissora[]) => {
    setTransmissoras(list);
    try {
      localStorage.setItem('tust_transmissoras', JSON.stringify(list));
    } catch (e) {
      console.warn('Erro ao salvar transmissoras no localStorage:', e);
    }
  };

  const handleAddTransmissora = (nova: Transmissora) => {
    const updated = [...transmissoras, nova];
    saveTransmissoras(updated);
    if (!selectedTransmissoras.includes(nova.Transmissora)) {
      setSelectedTransmissoras((prev) => [...prev, nova.Transmissora]);
    }
  };

  const handleRemoveTransmissora = (codigoOns: number) => {
    const updated = transmissoras.filter((t) => t.Codigo_ONS !== codigoOns);
    saveTransmissoras(updated);
  };

  const handleResetTransmissoras = () => {
    if (confirm('Deseja restaurar as transmissoras para a lista padrão?')) {
      saveTransmissoras(DEFAULT_TRANSMISSORAS);
      setSelectedTransmissoras(DEFAULT_TRANSMISSORAS.map((t) => t.Transmissora));
    }
  };

  const effectiveBaseUrl = ambiente.id === 'CUSTOM' ? customUrl : ambiente.url;

  // Função de Login
  const handleLogin = useCallback(async (): Promise<boolean> => {
    if (!effectiveBaseUrl || !username || !password) {
      setStatusMsg({ type: 'error', text: 'Preencha URL, usuário e senha.' });
      return false;
    }

    try {
      const res = await fetch('/api/tust/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: effectiveBaseUrl,
          username,
          password,
        }),
      });

      const data = await res.json();
      if (data.ok && data.cookies) {
        setCookies(data.cookies);
        setIsAutenticado(true);
        setStatusMsg({ type: 'success', text: 'Autenticado com sucesso no portal TUST!' });
        return true;
      } else {
        setIsAutenticado(false);
        setStatusMsg({ type: 'error', text: data.message || 'Falha na autenticação.' });
        return false;
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setIsAutenticado(false);
      setStatusMsg({ type: 'error', text: `Erro de rede: ${errorMsg}` });
      return false;
    }
  }, [effectiveBaseUrl, username, password]);

  // Autenticação inicial automática caso haja credenciais padrão
  useEffect(() => {
    if (username && password && effectiveBaseUrl && !isAutenticado) {
      handleLogin();
    }
  }, [effectiveBaseUrl, username, password, isAutenticado, handleLogin]);

  // Transmissoras toggles
  const handleToggleTransmissora = (nome: string) => {
    setSelectedTransmissoras((prev) =>
      prev.includes(nome) ? prev.filter((n) => n !== nome) : [...prev, nome]
    );
  };

  const handleSelectAllTransmissoras = () => {
    if (selectedTransmissoras.length === transmissoras.length) {
      setSelectedTransmissoras([]);
    } else {
      setSelectedTransmissoras(transmissoras.map((t) => t.Transmissora));
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'upload':
        return 'Processar & Upload de Boletos';
      case 'pendencias':
        return 'Consultar & Sanear Pendências';
      case 'transmissoras':
        return 'Gestão de Transmissoras ONS';
      case 'config':
        return 'Configurações do Ambiente TUST';
      default:
        return 'TUST Smart Uploader';
    }
  };

  return (
    <div className="app-layout-wrapper">
      {/* BARRA LATERAL (SIDEBAR) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        transmissorasCount={transmissoras.length}
        ambiente={ambiente}
        isAutenticado={isAutenticado}
        modoTeste={modoTeste}
        onToggleModoTeste={() => setModoTeste(!modoTeste)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="app-main-content">
        {/* BARRA SUPERIOR (TOPBAR) */}
        <Header
          ambiente={ambiente}
          competencia={competencia}
          isAutenticado={isAutenticado}
          modoTeste={modoTeste}
          activeTabTitle={getTabTitle()}
          onToggleMobileMenu={() => setIsMobileSidebarOpen(true)}
          onOpenSettings={() => setActiveTab('config')}
          onToggleModoTeste={() => setModoTeste(!modoTeste)}
        />

        {/* CONTEÚDO DA ABA ATIVA */}
        <main className="tab-content-area">
          {activeTab === 'upload' && (
            <UploadTab
              transmissoras={transmissoras}
              selectedTransmissoras={selectedTransmissoras}
              onToggleTransmissora={handleToggleTransmissora}
              onSelectAllTransmissoras={handleSelectAllTransmissoras}
              competencia={competencia}
              baseUrl={effectiveBaseUrl}
              cookies={cookies}
              modoTeste={modoTeste}
              onRequireAuth={() => setActiveTab('config')}
            />
          )}

          {activeTab === 'pendencias' && (
            <PendenciasTab
              transmissoras={transmissoras}
              baseUrl={effectiveBaseUrl}
              cookies={cookies}
              modoTeste={modoTeste}
              onRequireAuth={() => setActiveTab('config')}
            />
          )}

          {activeTab === 'transmissoras' && (
            <TransmissorasTab
              transmissoras={transmissoras}
              onAddTransmissora={handleAddTransmissora}
              onRemoveTransmissora={handleRemoveTransmissora}
              onResetTransmissoras={handleResetTransmissoras}
              baseUrl={effectiveBaseUrl}
              cookies={cookies}
            />
          )}

          {activeTab === 'config' && (
            <ConfigTab
              ambiente={ambiente}
              onSelectAmbiente={(amb) => {
                setAmbiente(amb);
                if (amb.usuarioPadrao) setUsername(amb.usuarioPadrao);
                if (amb.senhaPadrao) setPassword(amb.senhaPadrao);
                setIsAutenticado(false);
                setCookies('');
              }}
              username={username}
              onChangeUsername={setUsername}
              password={password}
              onChangePassword={setPassword}
              customUrl={customUrl}
              onChangeCustomUrl={setCustomUrl}
              modoTeste={modoTeste}
              onToggleModoTeste={() => setModoTeste(!modoTeste)}
              isAutenticado={isAutenticado}
              onLogin={handleLogin}
              statusMsg={statusMsg}
            />
          )}
        </main>
      </div>
    </div>
  );
}

