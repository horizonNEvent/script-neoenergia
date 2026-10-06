'use client';

import React, { useState } from 'react';
import {
  Globe,
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
  ShieldCheck,
  Server,
} from 'lucide-react';
import { AmbienteTUST } from '@/types/tust';
import { AMBIENTES_TUST } from '@/lib/constants';

interface ConfigTabProps {
  ambiente: AmbienteTUST;
  onSelectAmbiente: (amb: AmbienteTUST) => void;
  username: string;
  onChangeUsername: (u: string) => void;
  password: string;
  onChangePassword: (p: string) => void;
  customUrl: string;
  onChangeCustomUrl: (url: string) => void;
  modoTeste: boolean;
  onToggleModoTeste: () => void;
  isAutenticado: boolean;
  onLogin: () => Promise<boolean>;
  statusMsg: { type: 'success' | 'error'; text: string } | null;
}

export const ConfigTab: React.FC<ConfigTabProps> = ({
  ambiente,
  onSelectAmbiente,
  username,
  onChangeUsername,
  password,
  onChangePassword,
  customUrl,
  onChangeCustomUrl,
  modoTeste,
  onToggleModoTeste,
  isAutenticado,
  onLogin,
  statusMsg,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleTestLogin = async () => {
    setIsLoading(true);
    await onLogin();
    setIsLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Server size={22} style={{ color: 'var(--accent-cyan)' }} />
          Configurações do Ambiente TUST
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.75rem' }}>
          Selecione a instância do portal TUST e forneça suas credenciais corporativas.
        </p>

        {/* 1. SELEÇÃO DO AMBIENTE */}
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label className="form-label">
            <span>Ambiente TUST</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              URL base da API
            </span>
          </label>
          <select
            className="form-select"
            value={ambiente.id}
            onChange={(e) => {
              const selected = AMBIENTES_TUST.find((a) => a.id === e.target.value);
              if (selected) onSelectAmbiente(selected);
            }}
          >
            {AMBIENTES_TUST.map((amb) => (
              <option key={amb.id} value={amb.id}>
                {amb.nome} {amb.url ? `(${amb.url})` : ''}
              </option>
            ))}
          </select>
        </div>

        {ambiente.id === 'CUSTOM' && (
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">URL Customizada</label>
            <input
              type="url"
              className="form-input"
              placeholder="https://tust-suaempresa.rsmbrasil.com.br"
              value={customUrl}
              onChange={(e) => onChangeCustomUrl(e.target.value)}
            />
          </div>
        )}

        {/* 2. CREDENCIAIS */}
        <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">Usuário TUST</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: BRUNOVOLLU"
                value={username}
                onChange={(e) => onChangeUsername(e.target.value)}
                style={{ paddingLeft: '2.2rem' }}
              />
              <User
                size={16}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-dim)',
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Senha TUST</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => onChangePassword(e.target.value)}
                style={{ paddingLeft: '2.2rem', paddingRight: '2.5rem' }}
              />
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-dim)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* 3. MODO TESTE TOGGLE */}
        <div
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FlaskConical size={22} style={{ color: 'var(--accent-amber)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Modo Teste (Simulação Segura)
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Ao ativar, nenhuma alteração ou upload real é feito no TUST.
              </div>
            </div>
          </div>

          <button
            type="button"
            className={`btn ${modoTeste ? 'btn-primary' : 'btn-secondary'}`}
            onClick={onToggleModoTeste}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {modoTeste ? 'Ativado' : 'Desativado'}
          </button>
        </div>

        {/* 4. FEEDBACK DE STATUS */}
        {statusMsg && (
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background:
                statusMsg.type === 'success'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(244, 63, 94, 0.15)',
              border: `1px solid ${
                statusMsg.type === 'success'
                  ? 'rgba(16, 185, 129, 0.3)'
                  : 'rgba(244, 63, 94, 0.3)'
              }`,
              color: statusMsg.type === 'success' ? '#34d399' : '#fb7185',
              fontSize: '0.9rem',
            }}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* 5. AÇÃO DE LOGIN / TESTE DE CONEXÃO */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleTestLogin}
            disabled={isLoading || !username || !password}
            style={{ padding: '0.75rem 1.75rem' }}
          >
            {isLoading ? (
              <>
                <div className="spinner" />
                <span>Autenticando...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={18} />
                <span>{isAutenticado ? 'Reconectar Sessão' : 'Autenticar no TUST'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
