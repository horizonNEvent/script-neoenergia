import { NextRequest, NextResponse } from 'next/server';
import { discoverIdTUST } from '@/lib/tust-service';

export async function POST(req: NextRequest) {
  try {
    const { baseUrl, cookies, codigoOns, cnpj, transmissoraNome } = await req.json();

    if (!baseUrl || !cookies || (!codigoOns && !transmissoraNome)) {
      return NextResponse.json(
        { ok: false, message: 'URL, cookies e Código ONS ou Nome são obrigatórios' },
        { status: 400 }
      );
    }

    const result = await discoverIdTUST(baseUrl, cookies, codigoOns || '', cnpj || '', transmissoraNome || '');
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, message: `Erro ao descobrir ID TUST: ${errorMsg}` },
      { status: 500 }
    );
  }
}
