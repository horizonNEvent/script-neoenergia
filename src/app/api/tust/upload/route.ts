import { NextRequest, NextResponse } from 'next/server';
import { uploadBoletoTUST } from '@/lib/tust-service';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const baseUrl = (formData.get('baseUrl') as string) || '';
    const cookies = (formData.get('cookies') as string) || '';
    const idFatura = Number(formData.get('idFatura') || 0);
    const modoTeste = formData.get('modoTeste') === 'true';
    const file = formData.get('file') as File | null;

    if (!baseUrl || !idFatura) {
      return NextResponse.json(
        { ok: false, message: 'URL base e ID da fatura são obrigatórios' },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { ok: false, message: 'Arquivo PDF não fornecido' },
        { status: 400 }
      );
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const result = await uploadBoletoTUST(
      baseUrl,
      cookies,
      idFatura,
      file.name,
      fileBytes,
      modoTeste
    );

    console.log(
      `[upload] fatura=${idFatura} ${file.name} teste=${modoTeste} -> ok=${result.ok} http=${result.statusCode} ${result.message} | resp=${(result.rawResponseText || '').slice(0, 300)}`
    );
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[upload] exceção: ${errorMsg}`);
    return NextResponse.json(
      { ok: false, message: `Erro no upload da fatura: ${errorMsg}` },
      { status: 500 }
    );
  }
}
