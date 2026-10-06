import { BoletoItem, MatchItem, Pendencia } from '@/types/tust';
import { formatOnlyNumbers } from './pdf-parser';

export function normalizeValueKey(valStr: string): string {
  // Converte "1.234,56" ou "1234.56" para "1234.56"
  const cleaned = valStr.trim();
  if (cleaned.includes(',')) {
    // Formato brasileiro: 1.234,56
    const withoutDots = cleaned.replace(/\./g, '');
    const withDot = withoutDots.replace(',', '.');
    const num = parseFloat(withDot);
    return isNaN(num) ? '' : num.toFixed(2);
  } else {
    // Formato US: 1234.56
    const num = parseFloat(cleaned);
    return isNaN(num) ? '' : num.toFixed(2);
  }
}

export function buildBoletoIndex(boletos: BoletoItem[]): Map<string, BoletoItem[]> {
  const index = new Map<string, BoletoItem[]>();

  for (const boleto of boletos) {
    for (const valorRaw of boleto.valores) {
      const key = normalizeValueKey(valorRaw);
      if (key) {
        if (!index.has(key)) {
          index.set(key, []);
        }
        // Evita duplicar o mesmo boleto no mesmo valor
        const list = index.get(key)!;
        if (!list.some((b) => b.arquivo === boleto.arquivo)) {
          list.push(boleto);
        }
      }
    }
  }

  return index;
}

// CNPJ pode vir quebrado em vários itens de texto do pdfjs; cai para busca nos dígitos do texto todo.
function boletoHasCnpj(b: BoletoItem, cnpj: string): boolean {
  return b.cnpjs.includes(cnpj) || formatOnlyNumbers(b.texto_completo).includes(cnpj);
}

// Código de barras (44 dígitos) ou, se não houver, a linha digitável (47 dígitos)
export function codigoBarras(b: BoletoItem): string {
  const t = b.texto_completo || '';
  const barras = t.match(/\b\d{44}\b/);
  if (barras) return barras[0];
  const linha = t.match(/\d{5}\.?\d{5}\s*\d{5}\.?\d{6}\s*\d{5}\.?\d{6}\s*\d\s*\d{14}/);
  return linha ? formatOnlyNumbers(linha[0]) : '';
}

export function matchSinglePendencia(
  pendencia: Pendencia,
  boletoIndex: Map<string, BoletoItem[]>,
  assignedFiles: Set<string> = new Set()
): { boleto?: BoletoItem; estrategia?: string; motivo?: string } {
  const targetValue = pendencia.valor.toFixed(2);
  const cnpjTransmissora = formatOnlyNumbers(pendencia.transmissora_cnpj);
  const cnpjEmpresa = formatOnlyNumbers(pendencia.empresa_cnpj);

  if (!cnpjTransmissora) return { motivo: 'CNPJ da transmissora não disponível' };
  if (!cnpjEmpresa) return { motivo: 'CNPJ da empresa não disponível (fatura sem NF)' };

  const porValor = (boletoIndex.get(targetValue) || []).filter(
    (b) => !assignedFiles.has(b.arquivo)
  );
  if (porValor.length === 0) return { motivo: 'Nenhum PDF com este valor' };

  // Regra: valor exato + CNPJ da transmissora + CNPJ da empresa, todos no mesmo PDF
  const candidatos = porValor.filter(
    (b) => boletoHasCnpj(b, cnpjTransmissora) && boletoHasCnpj(b, cnpjEmpresa)
  );

  if (candidatos.length === 1) {
    return { boleto: candidatos[0], estrategia: 'Valor + CNPJ Transmissora + CNPJ Empresa' };
  }
  // Mesmo boleto baixado 2x (arquivos diferentes, mesmo código de barras) não é ambiguidade
  const codigos = new Set(candidatos.map(codigoBarras));
  if (candidatos.length > 1 && codigos.size === 1 && !codigos.has('')) {
    return {
      boleto: candidatos[0],
      estrategia: `Valor + CNPJ Transmissora + CNPJ Empresa (${candidatos.length - 1} cópia(s) do mesmo boleto ignorada(s))`,
    };
  }
  if (candidatos.length > 1) {
    return {
      motivo: `Ambíguo: ${candidatos.length} PDFs com mesmo valor e CNPJs (${candidatos
        .map((b) => b.arquivo)
        .join(', ')})`,
    };
  }

  const soTransmissora = porValor.some((b) => boletoHasCnpj(b, cnpjTransmissora));
  return {
    motivo: soTransmissora
      ? 'PDF com valor e transmissora encontrado, mas CNPJ da empresa não confere'
      : 'PDF com este valor encontrado, mas CNPJ da transmissora não confere',
  };
}

export function matchAllPendencias(
  pendencias: Pendencia[],
  boletos: BoletoItem[]
): MatchItem[] {
  const index = buildBoletoIndex(boletos);
  const assigned = new Set<string>();

  return pendencias.map((pend, idx) => {
    const match = matchSinglePendencia(pend, index, assigned);
    if (match.boleto) {
      assigned.add(match.boleto.arquivo);
      return {
        id: `${pend.id}-${idx}`,
        pendencia: pend,
        boleto: match.boleto,
        estrategia: match.estrategia,
        status: 'pendente',
      };
    }

    return {
      id: `${pend.id}-${idx}`,
      pendencia: pend,
      status: 'nao_encontrado',
      mensagem: match.motivo || 'Boleto correspondente não localizado nos arquivos enviados',
    };
  });
}
