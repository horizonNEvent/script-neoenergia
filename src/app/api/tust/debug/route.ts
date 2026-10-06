// Rota de diagnóstico, só em dev. Reusa a sessão (baseUrl + cookies) da última chamada
// a /api/tust/pendencias para inspecionar faturas e testar variações do upload pelo terminal.
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { getFaturaDetalhes, verificarBoletoAnexado } from '@/lib/tust-service';

type Sessao = { baseUrl: string; cookies: string };
const sessao = () => (globalThis as any).__tustSessao as Sessao | undefined;

function bloqueado(req: NextRequest) {
  // Só acesso local: via túnel (Cloudflare) vem cf-connecting-ip / Host público. Rota lê arquivos do disco.
  const host = (req.headers.get('host') || '').split(':')[0];
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(host) && !req.headers.get('cf-connecting-ip');
  if (process.env.NODE_ENV === 'production' || !local) return NextResponse.json({ ok: false }, { status: 404 });
  if (!sessao()) return NextResponse.json({ ok: false, message: 'Sem sessão: faça uma busca de pendências no app' }, { status: 400 });
  return null;
}

// GET ?fatura=ID -> detalhe resumido da fatura
export async function GET(req: NextRequest) {
  const b = bloqueado(req);
  if (b) return b;
  const { baseUrl, cookies } = sessao()!;
  if (req.nextUrl.searchParams.has('auth')) {
    // Página MVC protegida: 200 = logado; 302 para /Auth/Login = sessão não autenticada
    const r = await fetch(`${baseUrl.replace(/\/$/, '')}/Processo/ConciliacaoPagamentos/`, {
      headers: { Cookie: cookies },
      redirect: 'manual',
    });
    return NextResponse.json({
      baseUrl,
      status: r.status,
      location: r.headers.get('location'),
      cookieNames: cookies.split(';').map((c) => c.split('=')[0].trim()),
    });
  }
  const id = Number(req.nextUrl.searchParams.get('fatura'));
  const det = await getFaturaDetalhes(baseUrl, cookies, id);
  if (!det.ok) return NextResponse.json(det);
  const f = det.fatura;
  return NextResponse.json({
    baseUrl,
    ...Object.fromEntries(
      Object.entries(f).filter(([, v]) => v === null || typeof v !== 'object')
    ),
    arquivos: f.arquivos,
    boletos: f.boletos,
    mensagenspendencias: f.mensagenspendencias,
  });
}

// POST {fatura, file, variant} -> upload com multipart montado à mão, depois confere na fatura.
// variant: "browser" (json sem Content-Type, igual Chrome) | "python" (json com application/json, igual requests)
export async function POST(req: NextRequest) {
  const b = bloqueado(req);
  if (b) return b;
  const { baseUrl, cookies } = sessao()!;
  const { fatura, file, variant = 'browser' } = await req.json();
  const nome = String(file).split(/[\\/]/).pop()!;
  const pdf = await readFile(file);

  const boundary = '----WebKitFormBoundary' + randomUUID().replace(/-/g, '').slice(0, 16);
  const campo = randomUUID().replace(/-/g, '');
  const jsonCT = variant === 'python' ? 'Content-Type: application/json\r\n' : '';
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="json"\r\n${jsonCT}\r\n` +
        JSON.stringify({ idfaturatransmissao: Number(fatura) }) +
        `\r\n--${boundary}\r\nContent-Disposition: form-data; name="${campo}"; filename="${nome}"\r\nContent-Type: application/pdf\r\n\r\n`
    ),
    pdf,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const base = baseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/conciliacaopagamentos/salvararquivos`, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Referer: `${base}/Processo/ConciliacaoPagamentos/`,
      Origin: base,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      Cookie: cookies,
    },
    body,
  });
  const raw = await res.text();
  const verif = await verificarBoletoAnexado(baseUrl, cookies, Number(fatura), nome);
  return NextResponse.json({
    variant,
    http: res.status,
    respHeaders: Object.fromEntries(res.headers),
    raw: raw.slice(0, 2000),
    verif,
  });
}
