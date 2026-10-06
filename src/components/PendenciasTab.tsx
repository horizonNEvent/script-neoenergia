'use client';

import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  DollarSign,
  FileCheck2,
  AlertCircle,
  X,
  CheckCircle,
  Ban,
  Filter,
} from 'lucide-react';
import { Pendencia, SaneamentoDetalhe, Transmissora } from '@/types/tust';

interface PendenciasTabProps {
  transmissoras: Transmissora[];
  baseUrl: string;
  cookies: string;
  modoTeste: boolean;
  onRequireAuth: () => void;
}

export const PendenciasTab: React.FC<PendenciasTabProps> = ({
  transmissoras,
  baseUrl,
  cookies,
  modoTeste,
  onRequireAuth,
}) => {
  const [selectedMes, setSelectedMes] = useState<number>(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return prev.getMonth() + 1;
  });
  const [selectedAno, setSelectedAno] = useState<number>(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return prev.getFullYear();
  });
  const [selectedTransmissoras, setSelectedTransmissoras] = useState<string[]>(
    transmissoras.map((t) => t.Transmissora)
  );
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSanearLoading, setIsSanearLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [saneamentoDetalhes, setSaneamentoDetalhes] = useState<SaneamentoDetalhe[] | null>(null);

  const competencia = `${selectedAno}-${String(selectedMes).padStart(2, '0')}-01T03:00:00.000Z`;

  const toggleTransmissora = (nome: string) => {
    setSelectedTransmissoras((prev) =>
      prev.includes(nome) ? prev.filter((n) => n !== nome) : [...prev, nome]
    );
  };

  const handleBuscar = async () => {
    if (!cookies) {
      onRequireAuth();
      return;
    }

    if (selectedTransmissoras.length === 0) {
      alert('Selecione ao menos uma transmissora.');
      return;
    }

    setIsLoading(true);
    const results: Pendencia[] = [];

    try {
      for (const nome of selectedTransmissoras) {
        const config = transmissoras.find((t) => t.Transmissora === nome);
        if (!config) continue;

        const res = await fetch('/api/tust/pendencias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseUrl,
            cookies,
            idTransmissora: config.ID_TUST,
            codigoOns: config.Codigo_ONS,
            competencia,
            transmissoraNome: config.Transmissora,
            transmissoraCnpj: config.CNPJ,
          }),
        });

        const data = await res.json();
        if (data.ok && Array.isArray(data.pendencias)) {
          results.push(...data.pendencias);
        }
      }

      setPendencias(results);
    } catch (err) {
      console.error('Erro ao consultar pendências:', err);
      alert('Erro na consulta. Verifique sua conexão e autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSanear = async () => {
    if (!cookies) {
      onRequireAuth();
      return;
    }

    if (pendencias.length === 0) {
      alert('Nenhuma pendência na lista para sanear.');
      return;
    }

    const confirmMsg = modoTeste
      ? `[MODO TESTE] Deseja simular o saneamento de ${pendencias.length} pendências?`
      : `ATENÇÃO: Deseja sanear ${pendencias.length} faturas? O sistema removerá notas fiscais e boletos divergentes do valor ONS.`;

    if (!confirm(confirmMsg)) return;

    setIsSanearLoading(true);

    try {
      const res = await fetch('/api/tust/sanear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl,
          cookies,
          pendencias,
          modoTeste,
        }),
      });

      const data = await res.json();
      if (data.detalhes) {
        setSaneamentoDetalhes(data.detalhes);
      }
    } catch (err) {
      console.error('Erro durante saneamento:', err);
      alert('Falha ao executar saneamento.');
    } finally {
      setIsSanearLoading(false);
    }
  };

  const filteredPendencias = pendencias.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.empresa.toLowerCase().includes(term) ||
      (p.transmissora_busca || p.transmissora).toLowerCase().includes(term) ||
      (p.notafiscal || '').toLowerCase().includes(term) ||
      (p.agente || '').toLowerCase().includes(term)
    );
  });

  const totalValor = pendencias.reduce((acc, p) => acc + (p.valor || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* PAINEL DE FILTROS & AÇÕES */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem' }}>
          Consulta de Competências & Saneamento
        </h3>

        <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">Mês da Competência</label>
            <select
              className="form-select"
              value={selectedMes}
              onChange={(e) => setSelectedMes(Number(e.target.value))}
            >
              {[
                'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
              ].map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {String(idx + 1).padStart(2, '0')} - {m}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Ano</label>
            <select
              className="form-select"
              value={selectedAno}
              onChange={(e) => setSelectedAno(Number(e.target.value))}
            >
              {[2024, 2025, 2026, 2027, 2028].map((ano) => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleBuscar}
              disabled={isLoading}
              style={{ flex: 1 }}
            >
              {isLoading ? (
                <>
                  <div className="spinner" />
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <Search size={16} />
                  <span>Buscar Pendências</span>
                </>
              )}
            </button>

            {pendencias.length > 0 && (
              <button
                type="button"
                className="btn btn-emerald"
                onClick={handleSanear}
                disabled={isSanearLoading}
                title="Remove NFs e boletos excedentes mantendo apenas o que bate com o valor ONS"
              >
                {isSanearLoading ? (
                  <>
                    <div className="spinner" />
                    <span>Saneando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Sanear</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Transmissoras Chips */}
        <div>
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.6rem',
            }}
          >
            Filtrar Transmissoras ({selectedTransmissoras.length}/{transmissoras.length} selecionadas):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {transmissoras.map((t) => {
              const active = selectedTransmissoras.includes(t.Transmissora);
              return (
                <button
                  key={t.Codigo_ONS}
                  type="button"
                  onClick={() => toggleTransmissora(t.Transmissora)}
                  className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  {t.Transmissora}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* STAT CARDS */}
      {pendencias.length > 0 && (
        <div className="grid-2">
          <div className="stat-card">
            <div className="stat-icon cyan">
              <FileCheck2 size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total de Pendências</div>
              <div className="stat-value">{pendencias.length}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon emerald">
              <DollarSign size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Valor Total das Faturas</div>
              <div className="stat-value">
                {totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABELA DE PENDÊNCIAS */}
      {pendencias.length > 0 && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <h3 style={{ fontSize: '1.15rem' }}>Faturas em Aberto</h3>
            <div style={{ position: 'relative', width: '280px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Filtrar por empresa, NF ou transmissora..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2rem' }}
              />
              <Filter
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

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transmissora</th>
                  <th>Empresa</th>
                  <th>Cód Agente / Filial</th>
                  <th>Valor Fatura (R$)</th>
                  <th>Nota Fiscal</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {filteredPendencias.map((item, idx) => (
                  <tr key={`${item.id}-${idx}`}>
                    <td>
                      <strong style={{ color: 'var(--accent-cyan)' }}>
                        {item.transmissora_busca || item.transmissora}
                      </strong>
                    </td>
                    <td>{item.empresa}</td>
                    <td>{item.agente || '—'}</td>
                    <td className="val-money">
                      {item.valor.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </td>
                    <td>{item.notafiscal || '—'}</td>
                    <td>
                      <span className="badge badge-warning">
                        {item.situacao || 'Pendente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE RESULTADO DO SANEAMENTO */}
      {saneamentoDetalhes && (
        <div className="modal-overlay" onClick={() => setSaneamentoDetalhes(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} style={{ color: 'var(--accent-emerald)' }} />
                Resultado do Saneamento Automático
              </h3>
              <button
                type="button"
                className="btn btn-icon"
                onClick={() => setSaneamentoDetalhes(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {saneamentoDetalhes.length} fatura(s) verificadas e ajustadas conforme valor ONS:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {saneamentoDetalhes.map((detalhe, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        Fatura #{detalhe.id_fatura} — {detalhe.empresa}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Valor ONS: R$ {detalhe.valor_ons.toFixed(2)} • {detalhe.mensagem}
                      </div>
                    </div>
                    {detalhe.status === 'sucesso' && (
                      <span className="badge badge-success">
                        <CheckCircle size={13} /> Sucesso
                      </span>
                    )}
                    {detalhe.status === 'bloqueado' && (
                      <span className="badge badge-secondary">
                        <Ban size={13} /> Bloqueado
                      </span>
                    )}
                    {detalhe.status === 'parcial' && (
                      <span className="badge badge-warning">
                        <AlertCircle size={13} /> Parcial
                      </span>
                    )}
                    {detalhe.status === 'erro' && (
                      <span className="badge badge-danger">
                        <AlertCircle size={13} /> Erro
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSaneamentoDetalhes(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
