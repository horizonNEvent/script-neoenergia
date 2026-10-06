import { BoletoExtracted } from '@/types/tust';

export function formatOnlyNumbers(text?: string | number): string {
  if (!text) return '';
  return String(text).replace(/\D/g, '');
}

export function extractDataFromText(text: string, fileName: string): BoletoExtracted {
  // Regex para valores: R$ 1.234,56 ou 1234.56
  const patternBr = /\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g;
  const patternUs = /\b\d+\.\d{2}\b/g;

  const valoresBr = text.match(patternBr) || [];
  const valoresUs = text.match(patternUs) || [];
  const todosValores = Array.from(new Set([...valoresBr, ...valoresUs]));

  // Regex para CNPJ
  const patternCnpj = /\b\d{2}\.?\d{3}\.?\d{3}\/?0*\d{1,4}-?\d{2}\b/g;
  const cnpjsEncontrados = text.match(patternCnpj) || [];
  const cnpjsLimpos = Array.from(new Set(cnpjsEncontrados.map((c) => formatOnlyNumbers(c))));

  // Regex para possíveis nomes de empresas (palavras em maiúsculas com 3+ caracteres)
  const patternEmpresas = /\b[A-ZÀ-Ú][A-ZÀ-Ú\s]{2,}\b/g;
  const empresasMatch = text.match(patternEmpresas) || [];
  const empresas = Array.from(
    new Set(
      empresasMatch
        .map((w) => w.trim())
        .filter((w) => w.length > 2 && !/^\d+$/.test(w))
    )
  );

  return {
    arquivo: fileName,
    valores: todosValores,
    cnpjs: cnpjsLimpos,
    empresas,
    texto_completo: text,
  };
}

export async function parsePdfFile(file: File): Promise<BoletoExtracted> {
  try {
    const pdfjs = await import('pdfjs-dist');

    if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
      useSystemFonts: true,
    });

    const doc = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      fullText += pageText + ' ';
    }

    return extractDataFromText(fullText, file.name);
  } catch (error) {
    console.warn(`Erro ao extrair texto com pdfjs de ${file.name}, tentando fallback bruto:`, error);
    // Fallback: extrai strings imprimíveis diretamente dos bytes do PDF
    try {
      const arrayBuffer = await file.arrayBuffer();
      const textDecoder = new TextDecoder('latin1');
      const raw = textDecoder.decode(arrayBuffer);
      return extractDataFromText(raw, file.name);
    } catch {
      return {
        arquivo: file.name,
        valores: [],
        cnpjs: [],
        empresas: [],
        texto_completo: '',
      };
    }
  }
}
