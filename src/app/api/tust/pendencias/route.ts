import { NextRequest, NextResponse } from 'next/server';
import { fetchPendencias, getFaturaDetalhes, getCnpjEmpresaCadastro, discoverIdTUST, FALLBACK_IDS } from '@/lib/tust-service';

export async function POST(req: NextRequest) {
  try {
    const { baseUrl, cookies, idTransmissora, codigoOns, competencia, transmissoraNome, transmissoraCnpj } =
      await req.json();

    if (!baseUrl || !cookies || !competencia) {
      return NextResponse.json(
        { ok: false, message: 'Parâmetros incompletos (baseUrl, cookies, competencia são obrigatórios)' },
        { status: 400 }
      );
    }

    let finalId: number | string | undefined = undefined;

    // 1. Tentar descoberta dinâmica para o ambiente do TUST ativo (ex: RIO ENERGY, AMERICA, NEOENERGIA)
    if (codigoOns || transmissoraCnpj || transmissoraNome) {
      const disc = await discoverIdTUST(
        baseUrl,
        cookies,
        codigoOns || '',
        transmissoraCnpj || '',
        transmissoraNome || ''
      );
      if (disc.ok && disc.idTust) {
        finalId = disc.idTust;
      }
    }

    // 2. Se a descoberta dinâmica não retornou, usa o ID estático configurado ou FALLBACK_IDS
    if (!finalId) {
      finalId = idTransmissora;
    }
    if (!finalId && codigoOns) {
      finalId = FALLBACK_IDS[String(codigoOns)];
    }

    if (!finalId) {
      return NextResponse.json(
        { ok: false, message: `ID TUST não encontrado para a transmissora ${transmissoraNome || ''}` },
        { status: 400 }
      );
    }

    // ponytail: guarda sessão em memória só em dev, para /api/tust/debug
    if (process.env.NODE_ENV !== 'production') (globalThis as any).__tustSessao = { baseUrl, cookies };

    const result = await fetchPendencias(baseUrl, cookies, finalId, competencia);
    console.log(
      `[pendencias] ${transmissoraNome} base=${baseUrl} idTust=${finalId} comp=${competencia} -> ${result.message}`
    );

    // Annotate pendências with metadata for matching.
    // CNPJ da empresa só existe no detalhe da fatura (NF: nucnpjdestinatario).
    const cacheCadastro = new Map<string, any>();
    const annotated = await Promise.all(
      result.pendencias.map(async (p) => {
        const det = await getFaturaDetalhes(baseUrl, cookies, p.id);
        const nf = (det.fatura?.notasfiscais || []).find((n: any) => n.nucnpjdestinatario);
        return {
          ...p,
          transmissora_busca: transmissoraNome || p.transmissora,
          transmissora_cnpj: p.transmissora_cnpj || transmissoraCnpj || '',
          empresa_cnpj:
            nf?.nucnpjdestinatario ||
            (await getCnpjEmpresaCadastro(baseUrl, cookies, p.agente || '', p.filial || '', cacheCadastro)),
        };
      })
    );

    for (const p of annotated) {
      console.log(
        `[pendencias]   fatura=${p.id} ${p.empresa} valor=${p.valor} cnpjTrans=${p.transmissora_cnpj || '-'} cnpjEmp=${p.empresa_cnpj || '-'}`
      );
    }

    return NextResponse.json({
      ok: result.ok,
      pendencias: annotated,
      message: result.message,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, message: `Erro ao buscar pendências: ${errorMsg}`, pendencias: [] },
      { status: 500 }
    );
  }
}
