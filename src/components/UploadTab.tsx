'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  Folder,
  Terminal,
} from 'lucide-react';
import { BoletoItem, MatchItem, Pendencia, Transmissora } from '@/types/tust';
import { parsePdfFile } from '@/lib/pdf-parser';
import { matchAllPendencias } from '@/lib/matcher';
import { UploadLogsModal, UploadLogEntry } from '@/components/UploadLogsModal';

// Varredura recursiva de diretórios via Drag & Drop
async function getAllPdfFilesFromDataTransfer(items: DataTransferItemList): Promise<File[]> {
  const pdfFiles: File[] = [];

  const traverseEntry = async (entry: any): Promise<void> => {
    if (!entry) return;
    if (entry.isFile) {
      if (entry.name.toLowerCase().endsWith('.pdf')) {
        await new Promise<void>((resolve) => {
          entry.file(
            (file: File) => {
              pdfFiles.push(file);
              resolve();
            },
            () => resolve()
          );
        });
      }
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const readBatch = (): Promise<any[]> =>
        new Promise((resolve) => {
          dirReader.readEntries(
            (entries: any[]) => resolve(entries),
            () => resolve([])
          );
        });

      let entries = await readBatch();
      while (entries.length > 0) {
        for (const childEntry of entries) {
          await traverseEntry(childEntry);
        }
        entries = await readBatch();
      }
    }
  };

  const promises: Promise<void>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        promises.push(traverseEntry(entry));
      } else {
        const file = item.getAsFile();
        if (file && (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf')) {
          pdfFiles.push(file);
        }
      }
    }
  }

  await Promise.all(promises);
  return pdfFiles;
}

interface UploadTabProps {
  transmissoras: Transmissora[];
  selectedTransmissoras: string[];
  onToggleTransmissora: (nome: string) => void;
  onSelectAllTransmissoras: () => void;
  competencia: string;
  baseUrl: string;
  cookies: string;
  modoTeste: boolean;
  onRequireAuth: () => void;
}

export const UploadTab: React.FC<UploadTabProps> = ({
  transmissoras,
  selectedTransmissoras,
  onToggleTransmissora,
  onSelectAllTransmissoras,
  competencia,
  baseUrl,
  cookies,
  modoTeste,
  onRequireAuth,
}) => {
  const [boletos, setBoletos] = useState<BoletoItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSearchingPendencias, setIsSearchingPendencias] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 });
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [parseProgress, setParseProgress] = useState({ current: 0, total: 0, filename: '' });
  const [searchProgress, setSearchProgress] = useState({ current: 0, total: 0, transmissora: '' });
  const [currentUploadItem, setCurrentUploadItem] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready' | 'missing'>('all');
  const [showExtractedPreview, setShowExtractedPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [uploadLogs, setUploadLogs] = useState<UploadLogEntry[]>([]);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Manipulação de arquivos
  const handleFiles = async (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter(
      (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
    );

    if (pdfFiles.length === 0) return;

    setIsParsing(true);
    setParseProgress({ current: 0, total: pdfFiles.length, filename: pdfFiles[0]?.name || '' });
    const newBoletos: BoletoItem[] = [];

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      setParseProgress({ current: i + 1, total: pdfFiles.length, filename: file.name });
      try {
        const extracted = await parsePdfFile(file);
        newBoletos.push({
          ...extracted,
          file,
        });
      } catch (err) {
        console.error(`Erro ao processar ${file.name}:`, err);
      }
    }

    setBoletos((prev) => {
      // Evita duplicatas pelo nome do arquivo
      const existingNames = new Set(prev.map((b) => b.arquivo));
      const filtered = newBoletos.filter((b) => !existingNames.has(b.arquivo));
      return [...prev, ...filtered];
    });

    setIsParsing(false);
  };

  const removeBoleto = (index: number) => {
    setBoletos((prev) => prev.filter((_, i) => i !== index));
    // Se remover um arquivo, limpa matches para re-analisar
    setMatches([]);
  };

  const clearAllBoletos = () => {
    setBoletos([]);
    setMatches([]);
  };

  // Buscar pendências e fazer match
  const handleBuscarEMatch = async () => {
    if (!cookies) {
      onRequireAuth();
      return;
    }

    if (selectedTransmissoras.length === 0) {
      alert('Selecione ao menos uma transmissora.');
      return;
    }

    if (boletos.length === 0) {
      alert('Adicione pelo menos um PDF para matching.');
      return;
    }

    setIsSearchingPendencias(true);
    setSearchProgress({ current: 0, total: selectedTransmissoras.length, transmissora: selectedTransmissoras[0] || '' });
    const todasPendencias: Pendencia[] = [];

    try {
      for (let i = 0; i < selectedTransmissoras.length; i++) {
        const transNome = selectedTransmissoras[i];
        setSearchProgress({ current: i + 1, total: selectedTransmissoras.length, transmissora: transNome });
        const config = transmissoras.find((t) => t.Transmissora === transNome);
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
        console.log(`[match] ${transNome}: ok=${data.ok} ${data.message} (${data.pendencias?.length ?? 0} pendências)`);
        if (data.ok && Array.isArray(data.pendencias)) {
          todasPendencias.push(...data.pendencias);
        }
      }

      if (todasPendencias.length === 0) {
        alert('Nenhuma pendência encontrada para as transmissoras selecionadas nesta competência.');
        setMatches([]);
      } else {
        const matchResults = matchAllPendencias(todasPendencias, boletos);
        for (const b of boletos) {
          console.log(`[match] PDF ${b.arquivo} valores=${b.valores.join(' ')} cnpjs=${b.cnpjs.join(' ')}`);
        }
        for (const m of matchResults) {
          console.log(
            `[match] fatura=${m.pendencia.id} ${m.pendencia.empresa} valor=${m.pendencia.valor} -> ${m.boleto ? m.boleto.arquivo : 'SEM MATCH: ' + m.mensagem}`
          );
        }
        setMatches(matchResults);
      }
    } catch (err) {
      console.error('Erro ao buscar pendências:', err);
      alert('Erro ao buscar pendências. Verifique sua conexão e login.');
    } finally {
      setIsSearchingPendencias(false);
    }
  };

  // Processar uploads em lote
  const handleProcessarUploads = async () => {
    if (!cookies) {
      onRequireAuth();
      return;
    }

    const readyItems = matches.filter((m) => m.boleto && m.status !== 'sucesso');
    if (readyItems.length === 0) {
      alert(
        totalComBoleto > 0
          ? 'Todos os boletos localizados já foram enviados com sucesso nesta sessão. Veja "Logs de Auditoria" ou rode "Buscar Pendências" de novo.'
          : 'Nenhum item com boleto encontrado pronto para upload.'
      );
      return;
    }

    setIsProcessing(true);
    setProcessProgress({ current: 0, total: readyItems.length });

    let processedCount = 0;

    for (const match of matches) {
      if (!match.boleto || match.status === 'sucesso') continue;

      setCurrentUploadItem(match.pendencia.transmissora || match.pendencia.empresa || match.boleto.arquivo);

      // Atualiza status para processando
      setMatches((prev) =>
        prev.map((item) =>
          item.id === match.id ? { ...item, status: 'processando' } : item
        )
      );

      try {
        const formData = new FormData();
        formData.append('baseUrl', baseUrl);
        formData.append('cookies', cookies);
        formData.append('idFatura', String(match.pendencia.id));
        formData.append('modoTeste', modoTeste ? 'true' : 'false');
        formData.append('file', match.boleto.file);

        const res = await fetch('/api/tust/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        // Registra log de auditoria detalhado
        const logItem: UploadLogEntry = {
          id: `${match.id}_${Date.now()}_${Math.random()}`,
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          faturaId: match.pendencia.id,
          empresa: match.pendencia.empresa || '-',
          transmissora: match.pendencia.transmissora || '-',
          notaFiscal: match.pendencia.notafiscal || '-',
          valor: match.pendencia.valor || 0,
          arquivo: match.boleto.arquivo,
          modoTeste,
          status: data.ok ? 'sucesso' : 'erro',
          statusCode: data.statusCode || (data.ok ? 200 : 500),
          mensagem: data.message || (data.ok ? 'Upload aceito' : 'Falha no upload'),
          requestDetails: data.requestDetails || {
            url: `${baseUrl}/api/conciliacaopagamentos/salvararquivos`,
            payloadJson: { idfaturatransmissao: match.pendencia.id },
          },
          rawResponseText: data.rawResponseText || JSON.stringify(data),
        };

        setUploadLogs((prev) => [logItem, ...prev]);

        setMatches((prev) =>
          prev.map((item) =>
            item.id === match.id
              ? {
                  ...item,
                  status: data.ok ? 'sucesso' : 'erro',
                  mensagem: data.message || (data.ok ? 'Upload concluído' : 'Falha no upload'),
                }
              : item
          )
        );
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const logItem: UploadLogEntry = {
          id: `${match.id}_${Date.now()}_${Math.random()}`,
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          faturaId: match.pendencia.id,
          empresa: match.pendencia.empresa || '-',
          transmissora: match.pendencia.transmissora || '-',
          notaFiscal: match.pendencia.notafiscal || '-',
          valor: match.pendencia.valor || 0,
          arquivo: match.boleto.arquivo,
          modoTeste,
          status: 'erro',
          statusCode: 500,
          mensagem: `Exceção: ${errorMsg}`,
          requestDetails: {
            url: `${baseUrl}/api/conciliacaopagamentos/salvararquivos`,
            payloadJson: { idfaturatransmissao: match.pendencia.id },
          },
          rawResponseText: errorMsg,
        };

        setUploadLogs((prev) => [logItem, ...prev]);

        setMatches((prev) =>
          prev.map((item) =>
            item.id === match.id
              ? { ...item, status: 'erro', mensagem: `Erro: ${errorMsg}` }
              : item
          )
        );
      }

      processedCount++;
      setProcessProgress({ current: processedCount, total: readyItems.length });
    }

    setIsProcessing(false);
  };

  const filteredMatches = matches.filter((m) => {
    if (filterStatus === 'ready') return !!m.boleto;
    if (filterStatus === 'missing') return !m.boleto;
    return true;
  });

  const totalComBoleto = matches.filter((m) => !!m.boleto).length;
  const totalSucesso = matches.filter((m) => m.status === 'sucesso').length;
  const totalFalha = matches.filter((m) => m.status === 'erro').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* PAINEL / CARD DE PROGRESSO ANIMADO */}
      {(isParsing || isSearchingPendencias || isProcessing) && (
        <div
          className="glass-panel"
          style={{
            padding: '1.25rem 1.5rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-focus)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="spinner" style={{ width: 20, height: 20, color: 'var(--accent-pink)' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {isParsing && 'Etapa 1/3: Extraindo Dados dos PDFs'}
                  {isSearchingPendencias && 'Etapa 2/3: Consultando Pendências TUST & Matching'}
                  {isProcessing && 'Etapa 3/3: Processando Uploads de Boletos'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {isParsing && `Lendo ${parseProgress.filename} (${parseProgress.current} de ${parseProgress.total})`}
                  {isSearchingPendencias && `Baixando pendências de ${searchProgress.transmissora} (${searchProgress.current} de ${searchProgress.total})`}
                  {isProcessing && `Enviando comprovante para ${currentUploadItem} (${processProgress.current} de ${processProgress.total})`}
                </div>
              </div>
            </div>

            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--accent-pink)' }}>
              {isParsing && `${Math.round((parseProgress.current / Math.max(parseProgress.total, 1)) * 100)}%`}
              {isSearchingPendencias && `${Math.round((searchProgress.current / Math.max(searchProgress.total, 1)) * 100)}%`}
              {isProcessing && `${Math.round((processProgress.current / Math.max(processProgress.total, 1)) * 100)}%`}
            </div>
          </div>

          {/* Barra de Progresso com Análise por Listras (Stripes) */}
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{
                width: `${
                  isParsing
                    ? (parseProgress.current / Math.max(parseProgress.total, 1)) * 100
                    : isSearchingPendencias
                    ? (searchProgress.current / Math.max(searchProgress.total, 1)) * 100
                    : (processProgress.current / Math.max(processProgress.total, 1)) * 100
                }%`,
              }}
            />
          </div>

          {/* Etapas Visuais */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '0.25rem' }}>
            <div className={`step-pill ${isParsing ? 'active' : boletos.length > 0 ? 'done' : ''}`}>
              <span className="step-num">1</span>
              <span>Análise de PDFs</span>
            </div>
            <div className={`step-pill ${isSearchingPendencias ? 'active' : matches.length > 0 ? 'done' : ''}`}>
              <span className="step-num">2</span>
              <span>Matching TUST</span>
            </div>
            <div className={`step-pill ${isProcessing ? 'active' : totalSucesso > 0 ? 'done' : ''}`}>
              <span className="step-num">3</span>
              <span>Upload Final</span>
            </div>
          </div>
        </div>
      )}
      {/* 1. SELEÇÃO DE TRANSMISSORAS */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.15rem' }}>1. Selecione as Transmissoras</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Selecione as transmissoras para buscar faturas pendentes da competência
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onSelectAllTransmissoras}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {selectedTransmissoras.length === transmissoras.length
              ? 'Desmarcar Todas'
              : 'Selecionar Todas'}
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
          {transmissoras.map((t) => {
            const isSelected = selectedTransmissoras.includes(t.Transmissora);
            return (
              <button
                key={t.Codigo_ONS}
                type="button"
                onClick={() => onToggleTransmissora(t.Transmissora)}
                className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  fontSize: '0.825rem',
                  padding: '0.45rem 0.9rem',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                {isSelected && <Check size={14} />}
                <span>{t.Transmissora}</span>
                <span style={{ opacity: 0.65, fontSize: '0.75rem' }}>
                  ({t.Codigo_ONS})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. DROPZONE DE ARQUIVOS PDF */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.25rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.15rem' }}>2. Carregue os Boletos (PDFs)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              O sistema analisa e extrai valores, CNPJs e empresas automaticamente
            </p>
          </div>
          {boletos.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowExtractedPreview(!showExtractedPreview)}
                style={{ fontSize: '0.8rem' }}
              >
                {showExtractedPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showExtractedPreview ? 'Ocultar Análise' : 'Ver Análise Prévia'}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={clearAllBoletos}
                style={{ fontSize: '0.8rem' }}
              >
                <Trash2 size={14} />
                Limpar Tudo
              </button>
            </div>
          )}
        </div>

        {/* Dropzone */}
        <div
          className="dropzone-box"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('dragging');
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('dragging');
          }}
          onDrop={async (e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('dragging');
            if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
              const foundPdfs = await getAllPdfFilesFromDataTransfer(e.dataTransfer.items);
              if (foundPdfs.length > 0) {
                handleFiles(foundPdfs);
                return;
              }
            }
            if (e.dataTransfer.files) {
              handleFiles(e.dataTransfer.files);
            }
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            multiple
            accept=".pdf,application/pdf"
            style={{ display: 'none' }}
          />
          <input
            type="file"
            ref={folderInputRef}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            {...({ webkitdirectory: '', directory: '' } as any)}
            multiple
            style={{ display: 'none' }}
          />

          <div className="dropzone-icon">
            <Folder size={28} />
          </div>
          <div className="dropzone-title">
            {isParsing ? 'Extraindo dados dos PDFs...' : 'Arraste pastas ou arquivos PDF aqui'}
          </div>
          <div className="dropzone-subtitle" style={{ marginBottom: '0.75rem' }}>
            A varredura por boletos PDF em subpastas é 100% recursiva e automática.
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                folderInputRef.current?.click();
              }}
            >
              <Folder size={16} />
              <span>Selecionar Pasta (Busca Recursiva)</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <FileText size={16} />
              <span>Selecionar Arquivos</span>
            </button>
          </div>
        </div>

        {/* Resumo dos PDFs Carregados */}
        {boletos.length > 0 && (
          <div style={{ marginTop: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                background: 'rgba(0, 229, 255, 0.06)',
                border: '1px solid rgba(0, 229, 255, 0.2)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={18} style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ fontWeight: 600 }}>
                  {boletos.length} arquivo(s) PDF carregado(s) e prontos
                </span>
              </div>
              <span className="badge badge-info">
                {boletos.reduce((acc, b) => acc + b.valores.length, 0)} valores extraídos
              </span>
            </div>

            {/* Visualização de Análise Prévia */}
            {showExtractedPreview && (
              <div
                style={{
                  marginTop: '1rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '0.75rem',
                  maxHeight: '320px',
                  overflowY: 'auto',
                  padding: '0.5rem',
                }}
              >
                {boletos.map((b, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.4rem',
                      }}
                    >
                      <strong
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '220px',
                        }}
                        title={b.arquivo}
                      >
                        {b.arquivo}
                      </strong>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBoleto(idx);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-rose)',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      Valores: {b.valores.slice(0, 3).join(', ') || 'Nenhum'}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      CNPJs: {b.cnpjs.slice(0, 2).join(', ') || 'Nenhum'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. AÇÃO DE MATCHING */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleBuscarEMatch}
          disabled={isSearchingPendencias || isParsing || boletos.length === 0}
          style={{ padding: '0.85rem 2.5rem', fontSize: '1rem' }}
        >
          {isSearchingPendencias ? (
            <>
              <div className="spinner" />
              <span>Consultando TUST & Fazendo Match...</span>
            </>
          ) : (
            <>
              <Search size={18} />
              <span>Buscar Pendências & Match Inteligente</span>
            </>
          )}
        </button>
      </div>

      {/* 4. RESULTADOS DO MATCH & EXECUÇÃO DO UPLOAD */}
      {matches.length > 0 && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.2rem' }}>Resultado da Correspondência</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {matches.length} fatura(s) pendente(s) • {totalComBoleto} com boleto localizado
              </p>
            </div>

            {/* Ação de upload em lote */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsLogModalOpen(true)}
                style={{ fontSize: '0.825rem' }}
              >
                <Terminal size={15} />
                <span>Logs de Auditoria ({uploadLogs.length})</span>
              </button>

              <button
                type="button"
                className="btn btn-emerald"
                onClick={handleProcessarUploads}
                disabled={isProcessing || totalComBoleto === 0}
              >
                {isProcessing ? (
                  <>
                    <div className="spinner" />
                    <span>Enviando ({processProgress.current}/{processProgress.total})...</span>
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    <span>Processar Uploads ({totalComBoleto})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Barra de Progresso durante upload */}
          {isProcessing && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.825rem',
                  marginBottom: '0.4rem',
                }}
              >
                <span>Progresso do Upload</span>
                <span>
                  {processProgress.current} de {processProgress.total} concluídos
                </span>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${(processProgress.current / Math.max(processProgress.total, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Filtros rápidos da tabela */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '0.75rem',
            }}
          >
            <button
              type="button"
              className={`btn ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              onClick={() => setFilterStatus('all')}
            >
              Todas ({matches.length})
            </button>
            <button
              type="button"
              className={`btn ${filterStatus === 'ready' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              onClick={() => setFilterStatus('ready')}
            >
              Com Boleto ({totalComBoleto})
            </button>
            <button
              type="button"
              className={`btn ${filterStatus === 'missing' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              onClick={() => setFilterStatus('missing')}
            >
              Sem Boleto ({matches.length - totalComBoleto})
            </button>
          </div>

          {/* Tabela de Matches */}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transmissora</th>
                  <th>Empresa / Agente</th>
                  <th>Valor (R$)</th>
                  <th>NF</th>
                  <th>Arquivo Correspondente</th>
                  <th>Estratégia</th>
                  <th>Status</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {filteredMatches.map((m) => {
                  const valorFormatado = m.pendencia.valor.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  });

                  return (
                    <tr key={m.id}>
                      <td>
                        <strong style={{ color: 'var(--accent-cyan)' }}>
                          {m.pendencia.transmissora_busca || m.pendencia.transmissora}
                        </strong>
                      </td>
                      <td>
                        <div>{m.pendencia.empresa}</div>
                        {m.pendencia.agente && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            Cód: {m.pendencia.agente}
                          </div>
                        )}
                      </td>
                      <td className="val-money">{valorFormatado}</td>
                      <td>{m.pendencia.notafiscal || '—'}</td>
                      <td>
                        {m.boleto ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <FileText size={15} style={{ color: 'var(--accent-emerald)' }} />
                            <span title={m.boleto.arquivo}>{m.boleto.arquivo}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>Não localizado</span>
                        )}
                      </td>
                      <td>
                        {m.estrategia ? (
                          <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                            {m.estrategia}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {m.status === 'sucesso' && (
                          <span className="badge badge-success">
                            <CheckCircle2 size={13} />
                            Sucesso
                          </span>
                        )}
                        {m.status === 'erro' && (
                          <span className="badge badge-danger">
                            <AlertCircle size={13} />
                            Erro
                          </span>
                        )}
                        {m.status === 'processando' && (
                          <span className="badge badge-warning">
                            <div className="spinner" style={{ width: '10px', height: '10px' }} />
                            Enviando
                          </span>
                        )}
                        {m.status === 'pendente' && (
                          <span className="badge badge-info">Pronto</span>
                        )}
                        {m.status === 'nao_encontrado' && (
                          <span className="badge badge-secondary">Pendente</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {m.mensagem || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Resumo Final se houver execuções */}
          {(totalSucesso > 0 || totalFalha > 0) && (
            <div
              style={{
                marginTop: '1.5rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <CheckCircle2 size={24} style={{ color: 'var(--accent-emerald)' }} />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Uploads com Sucesso
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{totalSucesso}</div>
                </div>
              </div>

              <div
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(244, 63, 94, 0.1)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <AlertCircle size={24} style={{ color: 'var(--accent-rose)' }} />
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Falhas no Upload
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{totalFalha}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Logs de Auditoria do Upload */}
      <UploadLogsModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        logs={uploadLogs}
        onClearLogs={() => setUploadLogs([])}
      />
    </div>
  );
};
