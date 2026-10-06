'use client';

import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Terminal,
  ChevronDown,
  ChevronUp,
  FileCode,
} from 'lucide-react';

export interface UploadLogEntry {
  id: string;
  timestamp: string;
  faturaId: number | string;
  empresa: string;
  transmissora: string;
  notaFiscal: string;
  valor: number;
  arquivo: string;
  modoTeste: boolean;
  status: 'sucesso' | 'erro';
  statusCode?: number;
  mensagem: string;
  requestDetails?: {
    url: string;
    payloadJson: any;
  };
  rawResponseText?: string;
}

interface UploadLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: UploadLogEntry[];
  onClearLogs: () => void;
}

export const UploadLogsModal: React.FC<UploadLogsModalProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs,
}) => {
  const [filter, setFilter] = useState<'all' | 'sucesso' | 'erro'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (filter === 'sucesso') return log.status === 'sucesso';
    if (filter === 'erro') return log.status === 'erro';
    return true;
  });

  const totalSucesso = logs.filter((l) => l.status === 'sucesso').length;
  const totalErros = logs.filter((l) => l.status === 'erro').length;

  const toggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  const handleCopyLogs = () => {
    const jsonStr = JSON.stringify(logs, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const jsonStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tust_upload_logs_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{ maxWidth: '850px', width: '95%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Terminal size={20} style={{ color: 'var(--accent-pink)' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              Logs de Auditoria de Upload (TUST API)
            </h3>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar modal">
            <X size={18} />
          </button>
        </div>

        {/* Resumo & Filtros */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span className="badge badge-secondary">Total: {logs.length}</span>
              <span className="badge badge-success">Sucessos: {totalSucesso}</span>
              <span className="badge badge-danger">Erros: {totalErros}</span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                onClick={() => setFilter('all')}
              >
                Todos ({logs.length})
              </button>
              <button
                type="button"
                className={`btn ${filter === 'sucesso' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                onClick={() => setFilter('sucesso')}
              >
                Sucessos ({totalSucesso})
              </button>
              <button
                type="button"
                className={`btn ${filter === 'erro' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                onClick={() => setFilter('erro')}
              >
                Erros ({totalErros})
              </button>
            </div>
          </div>

          {/* Lista de Logs Expansíveis */}
          {filteredLogs.length === 0 ? (
            <div
              style={{
                padding: '3rem 1.5rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
              }}
            >
              Nenhum log encontrado para o filtro selecionado.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                maxHeight: '450px',
                overflowY: 'auto',
                paddingRight: '0.25rem',
              }}
            >
              {filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <div
                    key={log.id}
                    style={{
                      background: 'rgba(18, 21, 30, 0.9)',
                      border: `1px solid ${
                        log.status === 'sucesso'
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(239, 68, 68, 0.3)'
                      }`,
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Linha Resumida do Log */}
                    <div
                      onClick={() => toggleExpand(log.id)}
                      style={{
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {log.status === 'sucesso' ? (
                          <CheckCircle2 size={16} style={{ color: '#34d399' }} />
                        ) : (
                          <AlertCircle size={16} style={{ color: '#f87171' }} />
                        )}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            {log.transmissora} • {log.empresa} (NF: {log.notaFiscal})
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Arquivo: {log.arquivo} | R$ {log.valor.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span
                          className={`badge ${
                            log.status === 'sucesso' ? 'badge-success' : 'badge-danger'
                          }`}
                        >
                          {log.statusCode ? `HTTP ${log.statusCode}` : log.status}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {log.timestamp}
                        </span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>

                    {/* Detalhes Técnicos Expandidos (Request / Response Raw) */}
                    {isExpanded && (
                      <div
                        style={{
                          padding: '0.85rem 1rem',
                          background: '#0a0c10',
                          borderTop: '1px solid var(--border-subtle)',
                          fontSize: '0.8rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                        }}
                      >
                        <div>
                          <strong style={{ color: 'var(--text-secondary)' }}>Status da API:</strong>{' '}
                          <span style={{ color: log.status === 'sucesso' ? '#34d399' : '#f87171' }}>
                            {log.mensagem}
                          </span>
                        </div>

                        {log.requestDetails && (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                              Endpoint HTTP:
                            </div>
                            <code
                              style={{
                                display: 'block',
                                background: '#12151e',
                                padding: '0.4rem 0.6rem',
                                borderRadius: '4px',
                                color: '#a8446b',
                                wordBreak: 'break-all',
                              }}
                            >
                              POST {log.requestDetails.url}
                            </code>
                          </div>
                        )}

                        {log.requestDetails?.payloadJson && (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                              Payload JSON Enviado (form-data: json):
                            </div>
                            <pre
                              style={{
                                background: '#12151e',
                                padding: '0.5rem',
                                borderRadius: '4px',
                                color: '#e2e8f0',
                                overflowX: 'auto',
                                fontFamily: 'monospace',
                                fontSize: '0.775rem',
                              }}
                            >
                              {JSON.stringify(log.requestDetails.payloadJson, null, 2)}
                            </pre>
                          </div>
                        )}

                        {log.rawResponseText && (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                              Resposta Bruta do Servidor TUST (Raw Response):
                            </div>
                            <pre
                              style={{
                                background: '#12151e',
                                padding: '0.5rem',
                                borderRadius: '4px',
                                color: '#34d399',
                                overflowX: 'auto',
                                fontFamily: 'monospace',
                                fontSize: '0.775rem',
                              }}
                            >
                              {log.rawResponseText}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé das Ações */}
        <div className="modal-footer">
          {logs.length > 0 && (
            <button
              type="button"
              className="btn btn-danger"
              style={{ fontSize: '0.8rem', marginRight: 'auto' }}
              onClick={onClearLogs}
            >
              Limpar Logs
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem' }}
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
          >
            <Copy size={14} />
            <span>{copied ? 'Copiado!' : 'Copiar JSON'}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: '0.8rem' }}
            onClick={handleDownloadLogs}
            disabled={logs.length === 0}
          >
            <Download size={14} />
            <span>Baixar Arquivo de Logs</span>
          </button>
        </div>
      </div>
    </div>
  );
};
