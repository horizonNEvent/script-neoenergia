import { NextRequest, NextResponse } from 'next/server';
import { loginTUST } from '@/lib/tust-service';

export async function POST(req: NextRequest) {
  try {
    const { baseUrl, username, password } = await req.json();

    if (!baseUrl || !username || !password) {
      return NextResponse.json(
        { ok: false, message: 'URL, usuário e senha são obrigatórios' },
        { status: 400 }
      );
    }

    const result = await loginTUST(baseUrl, username, password);
    console.log(
      `[login] ${baseUrl} ok=${result.ok} ${result.message} | cookies=${result.cookies
        .split(';')
        .map((c) => c.split('=')[0].trim())
        .join(',')}`
    );
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, message: `Erro interno no login: ${errorMsg}` },
      { status: 500 }
    );
  }
}
