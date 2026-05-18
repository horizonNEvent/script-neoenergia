import os
import json
import uuid
import requests
import pdfplumber
import re
from pathlib import Path

class TUSTClient:
    def __init__(self, username, password, base_url="https://tust-americaenergia.rsmbrasil.com.br"):
        """
        Cliente para TUST.
        base_url é dinâmico e deve receber a URL do ambiente selecionado no app.
        Ambientes atualmente suportados:
        - https://tust-americaenergia.rsmbrasil.com.br (AMERICAENERGIA)
        - https://tust.rsmbrasil.com.br (RIOENERGY)
        - https://tust-diamanteenergia.rsmbrasil.com.br (DIAMANTEENERGIA)
        - https://tust-atlasenergy.pollvo.com/ (ATLASENERGY)
        - https://tust-aetecapital.pollvo.com/ (AETECAPITAL)
        """
        self.session = requests.Session()
        self.base_url = base_url
        self.username = username
        self.password = password

    def login(self):
        """Login no TUST"""
        print(f"[LOGIN] Autenticando como {self.username}...")
        login_url = f"{self.base_url}/Auth/Login"

        try:
            init_res = self.session.get(login_url)
            token_match = re.search(r'name="__RequestVerificationToken" type="hidden" value="([^"]+)"', init_res.text)
            token = token_match.group(1) if token_match else None

            payload = {
                "UserName": self.username,
                "Password": self.password,
                "RememberMe": "false"
            }
            if token:
                payload["__RequestVerificationToken"] = token

            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": login_url,
                "User-Agent": "Mozilla/5.0"
            }

            response = self.session.post(login_url, data=payload, headers=headers)

            if response.status_code in [200, 302] or "ConciliacaoPagamentos" in response.url:
                return True, "Login realizado com sucesso"
            return False, f"Erro: status {response.status_code}"
        except Exception as e:
            return False, f"Exceção: {e}"

    def get_pendencias(self, id_transmissora, competencia):
        """Busca faturas pendentes"""
        url = f"{self.base_url}/api/conciliacaopagamentos"
        params = {
            "cdempresa": "",
            "cdfilial": "",
            "dtcompetencia": competencia,
            "idtransmissora": id_transmissora,
            "tpformapagamento": "",
            "tpintegracaoerp": "",
            "tpsituacaofaturatransmissao": ""
        }
        try:
            res = self.session.get(url, params=params)
            res.raise_for_status()
            data = res.json()
        except Exception as e:
            return []

        pendencias = []
        if "situacoes" in data:
            for sit in data["situacoes"]:
                situacao = sit.get("tpsituacaofaturatransmissao", "")
                for emp in sit.get("empresas", []):
                    for item in emp.get("itens", []):
                        if item.get("qtarquivosboleto", 0) == 0:
                            pendencias.append({
                                "id": item["idfaturatransmissao"],
                                "empresa": item["nmempresa"],
                                "valor": item["vlfatura"],
                                "transmissora": item["nmtransmissora"],
                                "agente": item.get("cdempresa", ""),
                                "situacao": situacao,
                                "notafiscal": item.get("nunotafiscal", ""),
                            })
        return pendencias

    def upload_boleto(self, id_fatura, file_path, modo_teste=False):
        """Faz upload de boleto"""
        if modo_teste:
            return True, f"[TESTE] Simularia upload de {file_path.name}"

        url = f"{self.base_url}/api/conciliacaopagamentos/salvararquivos"
        file_field_name = uuid.uuid4().hex

        headers = {
            "Accept": "application/json, text/plain, */*",
            "Referer": f"{self.base_url}/Processo/ConciliacaoPagamentos/",
            "User-Agent": "Mozilla/5.0",
            "Origin": self.base_url,
        }

        json_payload = {"idfaturatransmissao": id_fatura}
        files = {
            'json': (None, json.dumps(json_payload), 'application/json'),
            file_field_name: (file_path.name, open(file_path, 'rb'), 'application/pdf'),
        }

        try:
            res = self.session.post(url, files=files, headers=headers)
            res.raise_for_status()

            try:
                resp_json = res.json()
                if resp_json.get("vberro", False):
                    return False, f"Erro: {resp_json.get('mensagens', [])}"
                return True, "Upload aceito"
            except:
                return True, "Upload concluído"
        except Exception as e:
            return False, f"Erro: {e}"

    def get_fatura_detalhe(self, id_fatura):
        """Busca detalhes completos de uma fatura."""
        url = f"{self.base_url}/api/conciliacaopagamentos/fatura/{id_fatura}"
        try:
            res = self.session.get(url)
            res.raise_for_status()
            return True, res.json()
        except Exception as e:
            return False, {"erro": str(e)}

    def _post_boolean(self, path, payload):
        """POST JSON que retorna boolean (true/false)."""
        headers = {
            "Accept": "application/json, text/plain, */*",
            "Referer": f"{self.base_url}/Processo/ConciliacaoPagamentos/",
            "User-Agent": "Mozilla/5.0",
            "Origin": self.base_url,
            "Content-Type": "application/json",
        }
        url = f"{self.base_url}{path}"
        try:
            res = self.session.post(url, headers=headers, json=payload)
            res.raise_for_status()
            try:
                data = res.json()
                if isinstance(data, bool):
                    return data, f"POST {path} -> {data}"
                return False, f"POST {path} retorno não booleano"
            except Exception:
                return False, f"POST {path} resposta inválida"
        except Exception as e:
            return False, f"POST {path} erro: {e}"

    def excluir_nota_fiscal(self, id_fatura, id_nota):
        """
        Cancela/inativa nota fiscal conforme contrato oficial:
        POST /api/conciliacaopagamentos/cancelarnotafiscal
        """
        payload = {
            "idfaturatransmissaonotafiscal": id_nota,
            "idfaturatransmissao": id_fatura,
        }
        return self._post_boolean("/api/conciliacaopagamentos/cancelarnotafiscal", payload)

    def excluir_boleto(self, id_fatura, id_boleto):
        """
        Cancela/inativa boleto conforme contrato oficial:
        POST /api/conciliacaopagamentos/cancelarboleto
        """
        payload = {
            "idfaturatransmissaoboleto": id_boleto,
            "idfaturatransmissao": id_fatura,
        }
        return self._post_boolean("/api/conciliacaopagamentos/cancelarboleto", payload)


def format_for_search(text):
    """Remove caracteres especiais para busca"""
    if not text:
        return ""
    return re.sub(r'\D', '', str(text))


def descobrir_id_tust_por_pendencias(username, password, transmissora_info, base_url="https://tust-americaenergia.rsmbrasil.com.br"):
    """
    Descobre o ID TUST tentando buscar pendências com diferentes IDs.
    Esta é uma estratégia alternativa quando a API de busca direta não funciona.
    """
    try:
        client = TUSTClient(username, password, base_url=base_url)

        # Login
        ok, msg = client.login()
        if not ok:
            return None

        # Tenta usar uma competência genérica para buscar
        competencia_teste = "2026-02-01T03:00:00.000Z"

        # Tenta IDs em intervalo comum (1-500)
        for id_teste in range(1, 501):
            try:
                pendencias = client.get_pendencias(id_teste, competencia_teste)
                # Se retornar pendências, pode ser o ID correto
                # Verifica se é a transmissora certa consultando a resposta
                if pendencias:
                    return id_teste
            except:
                continue

        return None

    except Exception as e:
        return None


def obter_id_tust_automatico(username, password, codigo_ons, cnpj, base_url="https://tust-americaenergia.rsmbrasil.com.br"):
    """
    Descobre automaticamente o ID TUST consultando a API.
    Usa múltiplas estratégias.
    """
    try:
        client = TUSTClient(username, password, base_url=base_url)

        # Login
        ok, msg = client.login()
        if not ok:
            return {"status": "erro", "id_tust": None, "mensagem": f"Erro no login: {msg}"}

        # Estratégia 1: Tentar buscar pela API /api/transmissora
        try:
            res = client.session.get(f"{base_url}/api/transmissora")
            res.raise_for_status()
            data = res.json()

            if data.get("lista"):
                # Procura por Código ONS
                for item in data["lista"]:
                    cdons = str(item.get("cdons", "")).strip()
                    if cdons == str(codigo_ons).strip():
                        id_tust = item.get("idtransmissora")
                        if id_tust:
                            return {
                                "status": "sucesso",
                                "id_tust": id_tust,
                                "mensagem": f"✅ ID TUST encontrado: {id_tust}"
                            }

                # Procura por CNPJ se não achou por Código ONS
                cnpj_clean = format_for_search(cnpj)
                for item in data["lista"]:
                    cdfornecedor = format_for_search(item.get("cdfornecedor", ""))
                    if cdfornecedor == cnpj_clean:
                        id_tust = item.get("idtransmissora")
                        if id_tust:
                            return {
                                "status": "sucesso",
                                "id_tust": id_tust,
                                "mensagem": f"✅ ID TUST encontrado: {id_tust}"
                            }
        except:
            pass

        return {
            "status": "info",
            "id_tust": None,
            "mensagem": "⚠️ ID TUST não pode ser descoberto automaticamente. Deixe em branco e será descoberto ao processar pendências."
        }

    except Exception as e:
        return {
            "status": "erro",
            "id_tust": None,
            "mensagem": f"Erro geral: {e}"
        }

def extrair_texto_limpo(file_path):
    """Extrai texto de PDF"""
    texto = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                texto += page.extract_text() or ""
    except:
        pass
    return texto

def extrair_informacoes_pdf(file_path):
    """
    Extrai informações estruturadas de um PDF.
    Retorna um dict com valor, CNPJ e empresas encontradas.
    """
    content = extrair_texto_limpo(file_path)
    if not content:
        return None

    info = {
        "arquivo": file_path.name,
        "path": file_path,
        "valores": [],
        "cnpjs": [],
        "empresas": [],
        "texto_completo": content
    }

    # 🔍 Extrai valores (padrão: 1.234,56 ou 1234.56)
    pattern_valor_br = r'\d{1,3}(?:\.\d{3})*,\d{2}'  # 1.234,56
    pattern_valor_us = r'\d+\.\d{2}'  # 1234.56

    valores_br = re.findall(pattern_valor_br, content)
    valores_us = re.findall(pattern_valor_us, content)

    info["valores"] = list(set(valores_br + valores_us))  # Remove duplicatas

    # 🔍 Extrai CNPJs (formato: XX.XXX.XXX/XXXX-XX ou apenas números)
    pattern_cnpj = r'\d{2}\.?\d{3}\.?\d{3}/?0*\d{1,4}-?\d{2}'
    cnpjs = re.findall(pattern_cnpj, content)
    info["cnpjs"] = [format_for_search(c) for c in cnpjs]

    # 🔍 Extrai possíveis nomes de empresas (palavras maiúsculas de 3+ caracteres)
    words = re.findall(r'\b[A-Z][A-Z\s]{2,}\b', content)
    empresas = list(set([w.strip() for w in words if len(w.strip()) > 2]))
    info["empresas"] = empresas

    return info

def analisar_pasta_boletos(folder_path):
    """
    Analisa uma pasta inteira e extrai informações de todos os PDFs.
    Retorna um dicionário: {valor: [info_pdf1, info_pdf2, ...], ...}
    Organizado por valor para matching rápido.
    """
    pdf_files = list(folder_path.glob("*.pdf"))
    if not pdf_files:
        return {}

    indice_boletos = {}  # {valor_formatado: [lista de pdfs com esse valor]}

    for pdf_file in pdf_files:
        info = extrair_informacoes_pdf(pdf_file)
        if info and info["valores"]:
            for valor in info["valores"]:
                # Normaliza valor para chave
                valor_chave = valor.replace(".", "").replace(",", ".")
                if valor_chave not in indice_boletos:
                    indice_boletos[valor_chave] = []
                indice_boletos[valor_chave].append(info)

    return indice_boletos

def encontrar_boleto_inteligente(pendencia, indice_boletos):
    """
    Encontra boleto usando matching inteligente baseado em dados extraídos do PDF.

    Prioridade:
    1. Valor EXATO + CNPJ
    2. Valor EXATO + Empresa
    3. Valor EXATO (último recurso)
    """
    target_value = f"{pendencia['valor']:.2f}"
    target_cnpj = format_for_search(pendencia["transmissora_cnpj"]) if "transmissora_cnpj" in pendencia else ""
    target_empresa = pendencia['empresa'].upper()

    # Procura pelo valor exato
    if target_value not in indice_boletos:
        return None

    candidatos = indice_boletos[target_value]

    # ⭐ ESTRATÉGIA 1: Valor EXATO + CNPJ + Empresa
    for pdf_info in candidatos:
        if target_cnpj in pdf_info["cnpjs"]:
            # Verifica se tem alguma palavra-chave da empresa
            if any(palavra in " ".join(pdf_info["empresas"]) for palavra in target_empresa.split()):
                return pdf_info
            # Se não tem empresa mas tem CNPJ, já é bom match
            return pdf_info

    # ⭐ ESTRATÉGIA 2: Valor EXATO + Empresa (mesmo sem CNPJ exato)
    for pdf_info in candidatos:
        if any(palavra in " ".join(pdf_info["empresas"]) for palavra in target_empresa.split()):
            return pdf_info

    # ⭐ ESTRATÉGIA 3: Valor EXATO (último recurso - pode ter só 1 PDF com esse valor)
    if len(candidatos) == 1:
        return candidatos[0]

    return None


def buscar_pendencias_competencia_especifica(username, password, transmissora_info, competencia, base_url="https://tust-americaenergia.rsmbrasil.com.br"):
    """
    Busca as pendências de UMA competência ESPECÍFICA.
    Retorna a lista completa de pendências com detalhes.
    """
    client = TUSTClient(username, password, base_url=base_url)

    # Login
    ok, msg = client.login()
    if not ok:
        return {"status": "erro", "mensagem": msg, "pendencias": []}

    # Tenta primeiro usar ID_TUST do JSON, depois fallback
    FALLBACK_IDS = {
        "1007": 7, "1090": 89, "1147": 146, "1159": 158, "1185": 184,
        "1234": 233, "1237": 236, "1247": 246,
    }

    # Prioridade 1: ID_TUST no JSON
    id_tust = transmissora_info.get("ID_TUST")

    # Prioridade 2: FALLBACK_IDS
    if not id_tust:
        id_tust = FALLBACK_IDS.get(str(transmissora_info["Codigo_ONS"]))

    if not id_tust:
        return {"status": "erro", "mensagem": f"ID TUST não encontrado", "pendencias": []}

    try:
        pendencias = client.get_pendencias(id_tust, competencia)

        if pendencias:
            return {
                "status": "sucesso",
                "mensagem": f"{len(pendencias)} pendência(s) encontrada(s)",
                "competencia": competencia,
                "transmissora": transmissora_info["Transmissora"],
                "pendencias": pendencias
            }
        else:
            return {
                "status": "aviso",
                "mensagem": "Nenhuma pendência encontrada para esta competência",
                "competencia": competencia,
                "transmissora": transmissora_info["Transmissora"],
                "pendencias": []
            }
    except Exception as e:
        return {
            "status": "erro",
            "mensagem": f"Erro ao buscar pendências: {e}",
            "pendencias": []
        }


def processar_transmissora(username, password, transmissora_info, folder_path, competencia, modo_teste=False, base_url="https://tust-americaenergia.rsmbrasil.com.br"):
    """Processa uma transmissora completa"""
    client = TUSTClient(username, password, base_url=base_url)

    # Login
    ok, msg = client.login()
    if not ok:
        return {"status": "erro", "mensagem": msg, "detalhes": []}

    # Buscar ID TUST
    FALLBACK_IDS = {
        "1007": 7, "1090": 89, "1147": 146, "1159": 158, "1185": 184,
        "1234": 233, "1237": 236, "1247": 246,
    }

    # Prioridade 1: ID_TUST no JSON
    id_tust = transmissora_info.get("ID_TUST")

    # Prioridade 2: FALLBACK_IDS
    if not id_tust:
        id_tust = FALLBACK_IDS.get(str(transmissora_info["Codigo_ONS"]))

    if not id_tust:
        return {"status": "erro", "mensagem": "ID TUST não encontrado", "detalhes": []}

    # Buscar pendências
    pendencias = client.get_pendencias(id_tust, competencia)
    if not pendencias:
        return {"status": "sucesso", "mensagem": "Sem pendências", "detalhes": []}

    # 🔍 Analisar pasta: extrai informações de TODOS os PDFs
    indice_boletos = analisar_pasta_boletos(folder_path)
    if not indice_boletos:
        return {"status": "erro", "mensagem": "Nenhum PDF encontrado na pasta", "detalhes": []}

    # Adiciona CNPJ da transmissora às pendências para matching
    for pend in pendencias:
        pend["transmissora_cnpj"] = transmissora_info["CNPJ"]

    # Processar
    resultados = []
    for pend in pendencias:
        match = encontrar_boleto_inteligente(pend, indice_boletos)
        if match:
            ok, msg = client.upload_boleto(pend["id"], match["path"], modo_teste)
            resultados.append({
                "empresa": pend['empresa'],
                "valor": pend['valor'],
                "arquivo": match["arquivo"],
                "status": "✅ Sucesso" if ok else "❌ Erro",
                "mensagem": msg
            })
        else:
            resultados.append({
                "empresa": pend['empresa'],
                "valor": pend['valor'],
                "arquivo": "-",
                "status": "❌ Não encontrado",
                "mensagem": "Boleto não encontrado na pasta"
            })

    return {"status": "sucesso", "mensagem": f"{len(pendencias)} processadas", "detalhes": resultados}


def _to_float_safe(value):
    try:
        return float(value)
    except Exception:
        return 0.0


def _is_same_money(a, b, tol=0.01):
    return abs(_to_float_safe(a) - _to_float_safe(b)) <= tol


def _pick_to_remove_by_value(items, target_value):
    """
    Mantém somente 1 item com valor exato ao target (quando existir),
    marcando o restante para remoção.
    """
    if not items:
        return []

    exact = [item for item in items if _is_same_money(item.get("vltotal", item.get("vlboleto", item.get("valor", 0))), target_value)]
    if not exact:
        # Sem match exato, não remove automaticamente para evitar risco.
        return []

    keep = exact[0]
    to_remove = []
    for item in items:
        if item is keep:
            continue
        to_remove.append(item)
    return to_remove


def sanear_pendencias_por_valor(username, password, pendencias, base_url="https://tust-americaenergia.rsmbrasil.com.br", modo_teste=False):
    """
    Para cada pendência, busca a fatura e tenta remover notas/boletos divergentes
    para manter apenas o que bate com o valor ONS.
    """
    client = TUSTClient(username, password, base_url=base_url)
    ok, msg = client.login()
    if not ok:
        return {"status": "erro", "mensagem": f"Falha no login: {msg}", "detalhes": []}

    detalhes = []
    for pend in pendencias:
        id_fatura = pend.get("id")
        if not id_fatura:
            detalhes.append({
                "id_fatura": "-",
                "empresa": pend.get("empresa", "-"),
                "status": "erro",
                "mensagem": "Pendência sem id de fatura",
            })
            continue

        ok_detail, fatura = client.get_fatura_detalhe(id_fatura)
        if not ok_detail:
            detalhes.append({
                "id_fatura": id_fatura,
                "empresa": pend.get("empresa", "-"),
                "status": "erro",
                "mensagem": f"Erro ao buscar fatura: {fatura.get('erro')}",
            })
            continue

        tpintegracaoerp = str(fatura.get("tpintegracaoerp", ""))
        if tpintegracaoerp.lower() == "enviado":
            detalhes.append({
                "id_fatura": id_fatura,
                "empresa": pend.get("empresa", "-"),
                "valor_ons": _to_float_safe(fatura.get("vlons", pend.get("valor", 0))),
                "status": "bloqueado",
                "mensagem": "Bloqueado: integração ERP = Enviado",
            })
            continue

        valor_ons = _to_float_safe(fatura.get("vlons", pend.get("valor", 0)))
        notas = fatura.get("notasfiscais", []) or []
        boletos = fatura.get("boletos", []) or []

        notas_remover = _pick_to_remove_by_value(notas, valor_ons)
        boletos_remover = _pick_to_remove_by_value(boletos, valor_ons)

        removidos_nf = 0
        removidos_boleto = 0
        falhas = []

        for nota in notas_remover:
            id_nota = nota.get("idfaturatransmissaonotafiscal")
            if not id_nota:
                continue
            if modo_teste:
                removidos_nf += 1
                continue
            ok_del, info = client.excluir_nota_fiscal(id_fatura, id_nota)
            if ok_del:
                removidos_nf += 1
            else:
                falhas.append(f"NF {id_nota}: {info}")

        for boleto in boletos_remover:
            id_boleto = boleto.get("idfaturatransmissaoboleto")
            if not id_boleto:
                continue
            if modo_teste:
                removidos_boleto += 1
                continue
            ok_del, info = client.excluir_boleto(id_fatura, id_boleto)
            if ok_del:
                removidos_boleto += 1
            else:
                falhas.append(f"Boleto {id_boleto}: {info}")

        if falhas:
            status = "parcial"
            mensagem = f"NF removidas: {removidos_nf}, boletos removidos: {removidos_boleto}, falhas: {' | '.join(falhas[:3])}"
        else:
            status = "sucesso"
            mensagem = f"NF removidas: {removidos_nf}, boletos removidos: {removidos_boleto}"

        detalhes.append({
            "id_fatura": id_fatura,
            "empresa": pend.get("empresa", "-"),
            "valor_ons": valor_ons,
            "status": status,
            "mensagem": mensagem,
        })

    return {
        "status": "sucesso",
        "mensagem": "Saneamento concluído",
        "detalhes": detalhes,
    }
