import { Pendencia, SaneamentoDetalhe, SaneamentoResult } from '@/types/tust';

export const FALLBACK_IDS: Record<string, number> = {
  '1007': 7,
  '1090': 89,
  '1147': 146,
  '1159': 158,
  '1185': 184,
  '1234': 233,
  '1237': 236,
  '1247': 246,
};

function formatOnlyNumbers(text?: string | number): string {
  if (!text) return '';
  return String(text).replace(/\D/g, '');
}

function parseCookies(cookieHeaders: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const header of cookieHeaders) {
    const [nameVal] = header.split(';');
    const eqIdx = nameVal.indexOf('=');
    if (eqIdx !== -1) {
      const k = nameVal.slice(0, eqIdx).trim();
      const v = nameVal.slice(eqIdx + 1).trim();
      if (k) map.set(k, v);
    }
  }
  return map;
}

function stringifyCookies(cookieMap: Map<string, string>): string {
  return Array.from(cookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

export async function loginTUST(
  baseUrl: string,
  username: string,
  pass: string
): Promise<{ ok: boolean; cookies: string; message: string }> {
  try {
    const loginUrl = `${baseUrl.replace(/\/$/, '')}/Auth/Login`;

    // 1. GET login page to retrieve CSRF token and initial cookies
    const initRes = await fetch(loginUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'manual',
    });

    const initCookies = initRes.headers.getSetCookie();
    const cookieMap = parseCookies(initCookies);

    const html = await initRes.text();
    const tokenMatch = html.match(
      /name="__RequestVerificationToken" type="hidden" value="([^"]+)"/
    );
    const token = tokenMatch ? tokenMatch[1] : '';

    // 2. POST login credentials
    const params = new URLSearchParams();
    params.append('UserName', username);
    params.append('Password', pass);
    params.append('RememberMe', 'false');
    if (token) {
      params.append('__RequestVerificationToken', token);
    }

    const postRes = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: loginUrl,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Cookie: stringifyCookies(cookieMap),
      },
      body: params.toString(),
      redirect: 'manual',
    });

    // Capture post cookies
    const postCookies = postRes.headers.getSetCookie();
    for (const c of postCookies) {
      const [nameVal] = c.split(';');
      const eqIdx = nameVal.indexOf('=');
      if (eqIdx !== -1) {
        const k = nameVal.slice(0, eqIdx).trim();
        const v = nameVal.slice(eqIdx + 1).trim();
        if (k) cookieMap.set(k, v);
      }
    }

    // Portal (AuthController): sucesso = 302 para fora do login. 200 = senha inválida ou tela de MFA.
    // As APIs de consulta não exigem login, então um "falso login" só aparece no upload (resposta null).
    let location = postRes.headers.get('location') || '';
    if (postRes.status === 302 && !/\/Auth\/Login/i.test(location)) {
      // Igual ao requests.Session() do Python: segue os redirects acumulando cookies de cada passo.
      // O portal grava cookies de sessão na página de destino, não só no POST.
      const base = baseUrl.replace(/\/$/, '');
      for (let hop = 0; hop < 5 && location; hop++) {
        const next = new URL(location, base).toString();
        const r = await fetch(next, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Cookie: stringifyCookies(cookieMap),
          },
          redirect: 'manual',
        });
        parseCookies(r.headers.getSetCookie()).forEach((v, k) => cookieMap.set(k, v));
        location = r.status >= 300 && r.status < 400 ? r.headers.get('location') || '' : '';
        if (/\/Auth\/Login/i.test(location)) {
          return { ok: false, cookies: '', message: 'Portal recusou a sessão após o login (voltou para /Auth/Login)' };
        }
      }
      return { ok: true, cookies: stringifyCookies(cookieMap), message: 'Login realizado com sucesso' };
    }

    const finalCookies = stringifyCookies(cookieMap);
    const body = postRes.status === 200 ? await postRes.text() : '';
    if (/VerificarOtp/i.test(body)) {
      return {
        ok: false,
        cookies: finalCookies,
        message: 'Portal exige código MFA (enviado por e-mail). Login automático não concluído.',
      };
    }

    // Login.cshtml usa @Html.ValidationSummary: <div class="validation-summary-errors"><ul><li>msg</li>
    const erroPortal = body
      .match(/validation-summary-errors[\s\S]*?<\/ul>/i)?.[0]
      .match(/<li>([\s\S]*?)<\/li>/gi)
      ?.map((li) => li.replace(/<[^>]+>/g, '').trim())
      .join('; ');
    return {
      ok: false,
      cookies: finalCookies,
      message: `Erro na autenticação: status ${postRes.status}${erroPortal ? ` - portal diz: "${erroPortal}"` : ''}`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, cookies: '', message: `Falha na conexão: ${errorMsg}` };
  }
}

export async function fetchPendencias(
  baseUrl: string,
  cookies: string,
  idTransmissora: number | string,
  competencia: string
): Promise<{ ok: boolean; pendencias: Pendencia[]; message: string }> {
  try {
    const cleanBase = baseUrl.replace(/\/$/, '');
    const url = `${cleanBase}/api/conciliacaopagamentos?cdempresa=&cdfilial=&dtcompetencia=${encodeURIComponent(
      competencia
    )}&idtransmissora=${idTransmissora}&tpformapagamento=&tpintegracaoerp=&tpsituacaofaturatransmissao=`;

    const res = await fetch(url, {
      headers: {
        Cookie: cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'application/json, text/plain, */*',
        Referer: `${cleanBase}/Processo/ConciliacaoPagamentos/`,
      },
    });

    if (!res.ok) {
      return {
        ok: false,
        pendencias: [],
        message: `Erro da API TUST: status ${res.status}`,
      };
    }

    const data = await res.json();
    const pendencias: Pendencia[] = [];
    const comBoleto: string[] = [];

    if (data.situacoes && Array.isArray(data.situacoes)) {
      for (const sit of data.situacoes) {
        const situacao = sit.tpsituacaofaturatransmissao || '';
        if (sit.empresas && Array.isArray(sit.empresas)) {
          for (const emp of sit.empresas) {
            if (emp.itens && Array.isArray(emp.itens)) {
              for (const item of emp.itens) {
                // Itens pendentes são aqueles sem boleto (qtarquivosboleto == 0)
                if ((item.qtarquivosboleto ?? 0) > 0) {
                  comBoleto.push(`${item.idfaturatransmissao}:${item.nmempresa}`);
                }
                if ((item.qtarquivosboleto ?? 0) === 0) {
                  pendencias.push({
                    id: item.idfaturatransmissao,
                    empresa: item.nmempresa || '',
                    valor: Number(item.vlfatura || 0),
                    transmissora: item.nmtransmissora || '',
                    agente: item.cdempresa || '',
                    filial: item.cdfilial || '',
                    situacao,
                    notafiscal: item.nunotafiscal || '',
                    transmissora_cnpj: item.cdfornecedor || '',
                  });
                }
              }
            }
          }
        }
      }
    }

    return {
      ok: true,
      pendencias,
      message: `${pendencias.length} pendência(s) encontrada(s); ${comBoleto.length} já com boleto [${comBoleto.join(', ')}]`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, pendencias: [], message: `Erro ao buscar pendências: ${errorMsg}` };
  }
}

function generateUuidHex(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function uploadBoletoTUST(
  baseUrl: string,
  cookies: string,
  idFatura: number,
  fileName: string,
  fileBytes: Uint8Array,
  modoTeste = false
): Promise<{
  ok: boolean;
  message: string;
  statusCode?: number;
  requestDetails?: { url: string; payloadJson: any; fileFieldName: string };
  rawResponseText?: string;
}> {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const url = `${cleanBase}/api/conciliacaopagamentos/salvararquivos`;
  const payloadJson = { idfaturatransmissao: Number(idFatura) };
  const fileFieldName = generateUuidHex();
  // Upload de pasta traz caminho relativo no nome ("Pasta/Sub/arquivo.pdf"); portal espera só o nome.
  fileName = fileName.split(/[\\/]/).pop() || fileName;

  if (modoTeste) {
    return {
      ok: true,
      message: `[MODO TESTE] Simulação de upload aceita para ${fileName}`,
      statusCode: 200,
      requestDetails: { url, payloadJson, fileFieldName },
      rawResponseText: '{"vberro":false,"mensagens":[],"modoTeste":true}',
    };
  }

  try {
    const formData = new FormData();
    // Passa string JSON limpa sem filename="blob" (conforme especificação exata do TUST)
    formData.append('json', JSON.stringify(payloadJson));

    const fileBlob = new Blob([fileBytes as any], { type: 'application/pdf' });
    formData.append(fileFieldName, fileBlob, fileName);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: `${cleanBase}/Processo/ConciliacaoPagamentos/`,
        Origin: cleanBase,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        Cookie: cookies,
      },
      body: formData,
    });

    const rawText = await res.text();
    let respJson: any = null;
    try {
      respJson = JSON.parse(rawText);
    } catch {
      respJson = null;
    }

    if (!res.ok) {
      return {
        ok: false,
        message: `Erro HTTP ${res.status}: ${res.statusText}`,
        statusCode: res.status,
        requestDetails: { url, payloadJson, fileFieldName },
        rawResponseText: rawText,
      };
    }

    if (respJson && respJson.vberro) {
      const msgs = Array.isArray(respJson.mensagens) ? respJson.mensagens.join(', ') : 'Erro retornado pelo TUST';
      return {
        ok: false,
        message: `Erro do TUST: ${msgs}`,
        statusCode: res.status,
        requestDetails: { url, payloadJson, fileFieldName },
        rawResponseText: rawText,
      };
    }

    // HTTP 200 sozinho não garante anexo (portal já respondeu "null"). Confere na própria fatura.
    const verif = await verificarBoletoAnexado(baseUrl, cookies, idFatura, fileName);
    if (!verif.ok) {
      return {
        ok: false,
        message: `Portal respondeu HTTP ${res.status} mas boleto NÃO aparece na fatura: ${verif.message}`,
        statusCode: res.status,
        requestDetails: { url, payloadJson, fileFieldName },
        rawResponseText: rawText,
      };
    }

    return {
      ok: true,
      message: `Upload confirmado na fatura: ${verif.message}`,
      statusCode: res.status,
      requestDetails: { url, payloadJson, fileFieldName },
      rawResponseText: rawText || '{"vberro":false,"mensagens":[]}',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `Exceção no upload: ${errorMsg}`,
      statusCode: 500,
      requestDetails: { url, payloadJson, fileFieldName },
      rawResponseText: errorMsg,
    };
  }
}

// Fallback quando a fatura não tem NF: CNPJ da filial no cadastro de empresas do portal
// (api/empresatust -> filiais/{id}.nucnpjfilial). Lista de empresas é buscada uma vez por sessão.
export async function getCnpjEmpresaCadastro(
  baseUrl: string,
  cookies: string,
  cdempresa: string,
  cdfilial: string,
  cache: Map<string, any>
): Promise<string> {
  const base = baseUrl.replace(/\/$/, '');
  const get = async (path: string) => {
    // guarda a Promise: pendências rodam em paralelo e todas pegariam cache vazio
    if (!cache.has(path)) {
      cache.set(
        path,
        fetch(`${base}${path}`, { headers: { Cookie: cookies, Accept: 'application/json' } })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      );
    }
    return cache.get(path);
  };
  const empresas = await get('/api/empresatust?todos=true');
  const emp = (empresas?.lista || []).find((e: any) => e.cdempresa === cdempresa);
  if (!emp) return '';
  const filiais: any[] = emp.filiais?.length ? emp.filiais : (await get(`/api/empresatust/filiais/${emp.idempresatust}`)) || [];
  const filial = filiais.find((f) => f.cdfilial === cdfilial) || (filiais.length === 1 ? filiais[0] : null);
  return filial?.nucnpjfilial || '';
}

export async function verificarBoletoAnexado(
  baseUrl: string,
  cookies: string,
  idFatura: number,
  fileName: string
): Promise<{ ok: boolean; message: string }> {
  const det = await getFaturaDetalhes(baseUrl, cookies, idFatura);
  if (!det.ok || !det.fatura) return { ok: false, message: `falha ao reler fatura (${det.message})` };
  const f = det.fatura;
  const arquivos: any[] = (f.arquivos || []).filter((a: any) => !a.vbcancelado);
  const resumo = `qtarquivosboleto=${f.qtarquivosboleto} arquivos=[${arquivos
    .map((a) => `${a.tparquivo}:${a.nmarquivo}`)
    .join(', ')}]`;
  const anexado = (f.qtarquivosboleto ?? 0) > 0 || arquivos.some((a) => a.nmarquivo === fileName);
  return { ok: anexado, message: resumo };
}

export async function getFaturaDetalhes(
  baseUrl: string,
  cookies: string,
  idFatura: number
): Promise<{ ok: boolean; fatura?: any; message?: string }> {
  try {
    const cleanBase = baseUrl.replace(/\/$/, '');
    const url = `${cleanBase}/api/conciliacaopagamentos/fatura/${idFatura}`;
    const res = await fetch(url, {
      headers: {
        Cookie: cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'application/json, text/plain, */*',
      },
    });

    if (!res.ok) {
      return { ok: false, message: `Erro HTTP ${res.status}` };
    }

    const data = await res.json();
    return { ok: true, fatura: data };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: errorMsg };
  }
}

async function postBooleanEndpoint(
  baseUrl: string,
  cookies: string,
  endpoint: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    const cleanBase = baseUrl.replace(/\/$/, '');
    const url = `${cleanBase}${endpoint}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: `${cleanBase}/Processo/ConciliacaoPagamentos/`,
        Origin: cleanBase,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Cookie: cookies,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return typeof data === 'boolean' ? data : true;
  } catch {
    return false;
  }
}

export async function sanearPendenciasBatch(
  baseUrl: string,
  cookies: string,
  pendencias: Pendencia[],
  modoTeste = false
): Promise<SaneamentoResult> {
  const detalhes: SaneamentoDetalhe[] = [];

  for (const pend of pendencias) {
    const idFatura = pend.id;
    if (!idFatura) {
      detalhes.push({
        id_fatura: '-',
        empresa: pend.empresa || '-',
        valor_ons: pend.valor || 0,
        status: 'erro',
        mensagem: 'Pendência sem ID de fatura',
      });
      continue;
    }

    const faturaRes = await getFaturaDetalhes(baseUrl, cookies, idFatura);
    if (!faturaRes.ok || !faturaRes.fatura) {
      detalhes.push({
        id_fatura: idFatura,
        empresa: pend.empresa || '-',
        valor_ons: pend.valor || 0,
        status: 'erro',
        mensagem: `Erro ao buscar fatura: ${faturaRes.message || 'Desconhecido'}`,
      });
      continue;
    }

    const fatura = faturaRes.fatura;
    const tpIntegracao = String(fatura.tpintegracaoerp || '');
    if (tpIntegracao.toLowerCase() === 'enviado') {
      detalhes.push({
        id_fatura: idFatura,
        empresa: pend.empresa || '-',
        valor_ons: Number(fatura.vlons ?? pend.valor ?? 0),
        status: 'bloqueado',
        mensagem: 'Bloqueado: integração ERP = Enviado',
      });
      continue;
    }

    const valorOns = Number(fatura.vlons ?? pend.valor ?? 0);
    const notas: any[] = fatura.notasfiscais || [];
    const boletos: any[] = fatura.boletos || [];

    // Helper to pick items to remove: keep 1 item with exact value, remove the others
    const pickToRemove = (items: any[]) => {
      if (!items || items.length === 0) return [];
      const exact = items.filter(
        (it) => Math.abs(Number(it.vltotal ?? it.vlboleto ?? it.valor ?? 0) - valorOns) <= 0.01
      );
      if (exact.length === 0) return []; // no exact match, don't remove to avoid risk
      const keep = exact[0];
      return items.filter((it) => it !== keep);
    };

    const notasRemover = pickToRemove(notas);
    const boletosRemover = pickToRemove(boletos);

    let removidosNf = 0;
    let removidosBoleto = 0;
    const falhas: string[] = [];

    for (const nota of notasRemover) {
      const idNota = nota.idfaturatransmissaonotafiscal;
      if (!idNota) continue;
      if (modoTeste) {
        removidosNf++;
        continue;
      }
      const ok = await postBooleanEndpoint(
        baseUrl,
        cookies,
        '/api/conciliacaopagamentos/cancelarnotafiscal',
        { idfaturatransmissaonotafiscal: idNota, idfaturatransmissao: idFatura }
      );
      if (ok) removidosNf++;
      else falhas.push(`NF ${idNota}`);
    }

    for (const boleto of boletosRemover) {
      const idBoleto = boleto.idfaturatransmissaoboleto;
      if (!idBoleto) continue;
      if (modoTeste) {
        removidosBoleto++;
        continue;
      }
      const ok = await postBooleanEndpoint(
        baseUrl,
        cookies,
        '/api/conciliacaopagamentos/cancelarboleto',
        { idfaturatransmissaoboleto: idBoleto, idfaturatransmissao: idFatura }
      );
      if (ok) removidosBoleto++;
      else falhas.push(`Boleto ${idBoleto}`);
    }

    const status: 'sucesso' | 'parcial' = falhas.length > 0 ? 'parcial' : 'sucesso';
    const msg =
      falhas.length > 0
        ? `NFs removidas: ${removidosNf}, Boletos removidos: ${removidosBoleto}, Falhas: ${falhas.join(', ')}`
        : `NFs removidas: ${removidosNf}, Boletos removidos: ${removidosBoleto}`;

    detalhes.push({
      id_fatura: idFatura,
      empresa: pend.empresa || '-',
      valor_ons: valorOns,
      status,
      mensagem: msg,
    });
  }

  return {
    status: 'sucesso',
    mensagem: 'Saneamento concluído',
    detalhes,
  };
}

export async function discoverIdTUST(
  baseUrl: string,
  cookies: string,
  codigoOns: number | string,
  cnpj: string,
  transmissoraNome?: string
): Promise<{ ok: boolean; idTust?: number; message: string }> {
  try {
    const cleanBase = baseUrl.replace(/\/$/, '');
    const res = await fetch(`${cleanBase}/api/transmissora`, {
      headers: {
        Cookie: cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return { ok: false, message: `Erro ao consultar transmissoras: HTTP ${res.status}` };
    }

    const data = await res.json();
    if (data.lista && Array.isArray(data.lista)) {
      const targetOns = String(codigoOns).trim();
      const targetCnpj = formatOnlyNumbers(cnpj);

      for (const item of data.lista) {
        if (targetOns && String(item.cdons || '').trim() === targetOns) {
          if (item.idtransmissora) {
            return {
              ok: true,
              idTust: Number(item.idtransmissora),
              message: `ID TUST encontrado: ${item.idtransmissora}`,
            };
          }
        }
      }

      for (const item of data.lista) {
        if (targetCnpj && formatOnlyNumbers(item.cdfornecedor) === targetCnpj) {
          if (item.idtransmissora) {
            return {
              ok: true,
              idTust: Number(item.idtransmissora),
              message: `ID TUST encontrado por CNPJ: ${item.idtransmissora}`,
            };
          }
        }
      }

      if (transmissoraNome) {
        const targetNm = transmissoraNome.toLowerCase().trim();
        for (const item of data.lista) {
          const nm = String(item.nmtransmissora || item.nmfornecedor || item.cdtransmissora || '').toLowerCase();
          if (nm && (nm.includes(targetNm) || targetNm.includes(nm))) {
            if (item.idtransmissora) {
              return {
                ok: true,
                idTust: Number(item.idtransmissora),
                message: `ID TUST encontrado por Nome: ${item.idtransmissora}`,
              };
            }
          }
        }
      }
    }

    return { ok: false, message: 'ID TUST não encontrado na lista da API' };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Erro na descoberta de ID TUST: ${errorMsg}` };
  }
}
