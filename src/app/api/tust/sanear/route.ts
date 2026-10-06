import { NextRequest, NextResponse } from 'next/server';
import { sanearPendenciasBatch } from '@/lib/tust-service';

export async function POST(req: NextRequest) {
  try {
    const { baseUrl, cookies, pendencias, modoTeste } = await req.json();

    if (!baseUrl || !cookies || !Array.isArray(pendencias)) {
      return NextResponse.json(
        { status: 'erro', mensagem: 'Dados inválidos para saneamento', detalhes: [] },
        { status: 400 }
      );
    }

    const result = await sanearPendenciasBatch(
      baseUrl,
      cookies,
      pendencias,
      Boolean(modoTeste)
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: 'erro', mensagem: `Erro durante saneamento: ${errorMsg}`, detalhes: [] },
      { status: 500 }
    );
  }
}
