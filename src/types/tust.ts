export interface Transmissora {
  Codigo_ONS: number;
  Transmissora: string;
  CNPJ: string;
  ID_TUST?: number;
}

export interface Pendencia {
  id: number;
  empresa: string;
  valor: number;
  transmissora: string;
  agente?: string;
  filial?: string;
  situacao?: string;
  notafiscal?: string;
  transmissora_busca?: string;
  transmissora_cnpj?: string;
  empresa_cnpj?: string;
}

export interface BoletoExtracted {
  arquivo: string;
  valores: string[];
  cnpjs: string[];
  empresas: string[];
  texto_completo?: string;
}

export interface BoletoItem extends BoletoExtracted {
  file: File;
}

export interface MatchItem {
  id: string; // unique key
  pendencia: Pendencia;
  boleto?: BoletoItem;
  estrategia?: string;
  status: 'pendente' | 'processando' | 'sucesso' | 'erro' | 'nao_encontrado';
  mensagem?: string;
}

export interface AmbienteTUST {
  id: string;
  nome: string;
  url: string;
  usuarioPadrao: string;
  senhaPadrao: string;
}

export interface SaneamentoDetalhe {
  id_fatura: number | string;
  empresa: string;
  valor_ons: number;
  status: 'sucesso' | 'bloqueado' | 'parcial' | 'erro';
  mensagem: string;
}

export interface SaneamentoResult {
  status: 'sucesso' | 'erro';
  mensagem: string;
  detalhes: SaneamentoDetalhe[];
}

export interface UploadResult {
  sucesso: boolean;
  mensagem: string;
}
