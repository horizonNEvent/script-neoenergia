'use client';

import React, { useState } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Sparkles,
  Building2,
  RotateCcw,
  X,
  Check,
} from 'lucide-react';
import { Transmissora } from '@/types/tust';

interface TransmissorasTabProps {
  transmissoras: Transmissora[];
  onAddTransmissora: (nova: Transmissora) => void;
  onRemoveTransmissora: (codigoOns: number) => void;
  onResetTransmissoras: () => void;
  baseUrl: string;
  cookies: string;
}

export const TransmissorasTab: React.FC<TransmissorasTabProps> = ({
  transmissoras,
  onAddTransmissora,
  onRemoveTransmissora,
  onResetTransmissoras,
  baseUrl,
  cookies,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [codigoOns, setCodigoOns] = useState('');
  const [idTust, setIdTust] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoverMsg, setDiscoverMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  const filtered = transmissoras.filter((t) => {
    const term = searchTerm.toLowerCase();
    return (
      t.Transmissora.toLowerCase().includes(term) ||
      t.CNPJ.toLowerCase().includes(term) ||
      String(t.Codigo_ONS).includes(term)
    );
  });

  const handleDiscoverId = async () => {
    if (!codigoOns) {
      setDiscoverMsg({ type: 'error', text: 'Preencha o Código ONS primeiro' });
      return;
    }
    if (!cookies) {
      setDiscoverMsg({ type: 'info', text: 'Você precisa estar autenticado no TUST para autodescoberta' });
      return;
    }

    setIsDiscovering(true);
    setDiscoverMsg(null);

    try {
      const res = await fetch('/api/tust/discover-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl,
          cookies,
          codigoOns: Number(codigoOns),
          cnpj,
        }),
      });

      const data = await res.json();
      if (data.ok && data.idTust) {
        setIdTust(String(data.idTust));
        setDiscoverMsg({ type: 'success', text: `ID TUST encontrado: ${data.idTust}` });
      } else {
        setDiscoverMsg({
          type: 'info',
          text: 'ID TUST não identificado automaticamente. Pode deixar em branco.',
        });
      }
    } catch {
      setDiscoverMsg({ type: 'error', text: 'Erro ao consultar API do TUST' });
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !cnpj.trim() || !codigoOns.trim()) {
      alert('Preencha Nome, CNPJ e Código ONS.');
      return;
    }

    const onsNum = parseInt(codigoOns, 10);
    if (isNaN(onsNum)) {
      alert('Código ONS deve ser numérico.');
      return;
    }

    const tustNum = idTust.trim() ? parseInt(idTust, 10) : undefined;

    onAddTransmissora({
      Transmissora: nome.trim().toUpperCase(),
      CNPJ: cnpj.trim(),
      Codigo_ONS: onsNum,
      ID_TUST: tustNum,
    });

    // Reset form
    setNome('');
    setCnpj('');
    setCodigoOns('');
    setIdTust('');
    setDiscoverMsg(null);
    setIsModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* HEADER SECTION */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.2rem' }}>Transmissoras Cadastradas</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {transmissoras.length} transmissoras configuradas no sistema
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onResetTransmissoras}
              title="Restaurar lista padrão original"
            >
              <RotateCcw size={15} />
              <span>Restaurar Padrão</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus size={16} />
              <span>Cadastrar Transmissora</span>
            </button>
          </div>
        </div>

        {/* BUSCA */}
        <div style={{ marginTop: '1.25rem', position: 'relative', maxWidth: '400px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Buscar por nome, CNPJ ou código ONS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2rem' }}
          />
          <Search
            size={14}
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

      {/* TABELA DE TRANSMISSORAS */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Cód. ONS</th>
              <th>Nome da Transmissora</th>
              <th>CNPJ</th>
              <th>ID TUST</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.Codigo_ONS}>
                <td>
                  <span className="badge badge-info">{t.Codigo_ONS}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building2 size={16} style={{ color: 'var(--accent-cyan)' }} />
                    <strong style={{ color: 'var(--text-main)' }}>{t.Transmissora}</strong>
                  </div>
                </td>
                <td style={{ fontFamily: 'monospace' }}>{t.CNPJ}</td>
                <td>
                  {t.ID_TUST ? (
                    <span className="badge badge-success">ID: {t.ID_TUST}</span>
                  ) : (
                    <span className="badge badge-secondary">Descoberta Dinâmica</span>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-icon"
                    onClick={() => {
                      if (confirm(`Remover ${t.Transmissora}?`)) {
                        onRemoveTransmissora(t.Codigo_ONS);
                      }
                    }}
                    title="Excluir transmissora"
                    style={{ color: 'var(--accent-rose)' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL DE CADASTRO */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem' }}>Cadastrar Nova Transmissora</h3>
              <button
                type="button"
                className="btn btn-icon"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Nome da Transmissora *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ex: NOVO ENERGY"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">CNPJ *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="XX.XXX.XXX/XXXX-XX"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Código ONS *</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Ex: 1500"
                      value={codigoOns}
                      onChange={(e) => setCodigoOns(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span>ID TUST (Opcional)</span>
                      <button
                        type="button"
                        onClick={handleDiscoverId}
                        disabled={isDiscovering}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-cyan)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <Sparkles size={12} />
                        Descobrir ID
                      </button>
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Deixe em branco para auto-descoberta"
                      value={idTust}
                      onChange={(e) => setIdTust(e.target.value)}
                    />
                  </div>
                </div>

                {discoverMsg && (
                  <div
                    style={{
                      padding: '0.6rem 0.9rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      marginTop: '0.5rem',
                      background:
                        discoverMsg.type === 'success'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : discoverMsg.type === 'error'
                          ? 'rgba(244, 63, 94, 0.15)'
                          : 'rgba(0, 229, 255, 0.1)',
                      color:
                        discoverMsg.type === 'success'
                          ? '#34d399'
                          : discoverMsg.type === 'error'
                          ? '#fb7185'
                          : 'var(--accent-cyan)',
                    }}
                  >
                    {discoverMsg.text}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} />
                  Salvar Transmissora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
