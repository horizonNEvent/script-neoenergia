import os
import json
import uuid
import requests
import pdfplumber
import re
from pathlib import Path

# --- CONFIGURAÇÃO ---
USERNAME = "BRUNOVOLLU"
PASSWORD = "Bvlu@2023"
BASE_URL = "https://tust-americaenergia.rsmbrasil.com.br"
COMPETENCIA = "2026-02-01T03:00:00.000Z" 
MODO_TESTE = False # <--- SE TRUE, NÃO FAZ O UPLOAD

class TUSTClient:
    def __init__(self):
        self.session = requests.Session()
        self.base_url = BASE_URL

    def login(self):
        print(f"--- Fazendo login como {USERNAME}...")
        login_url = f"{self.base_url}/Auth/Login"
        
        try:
            # 1. Primeiro GET para pegar os cookies iniciais e o Token CSRF
            init_res = self.session.get(login_url)
            
            # Tenta encontrar o __RequestVerificationToken no HTML
            token_match = re.search(r'name="__RequestVerificationToken" type="hidden" value="([^"]+)"', init_res.text)
            token = token_match.group(1) if token_match else None
            
            if token:
                print(f"[INFO] Token CSRF encontrado: {token[:10]}...")
            
            payload = {
                "UserName": USERNAME,
                "Password": PASSWORD,
                "RememberMe": "false"
            }
            if token:
                payload["__RequestVerificationToken"] = token

            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": login_url,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
            }

            # 2. POST de Login
            response = self.session.post(login_url, data=payload, headers=headers)
            
            if response.status_code == 200 and "Login" not in response.url:
                print("[OK] Login realizado com sucesso!")
                return True
            elif response.status_code == 302:
                print("[OK] Login realizado (Redirecionamento).")
                return True
            else:
                # Se a URL de resposta for a de conciliacao, provavelmente ja esta logado
                if "ConciliacaoPagamentos" in response.url:
                    print("[OK] Já estava logado.")
                    return True
                print(f"[ERRO] Falha no login (Status {response.status_code}).")
                # Se deu erro 500, vamos logar um pedaço da resposta para entender
                if response.status_code == 500:
                    print(f"       Dica do erro: {response.text[:500]}")
                return False
        except Exception as e:
            print(f"[ERRO] Exceção no login: {e}")
            return False


    def get_pendencias(self, id_transmissora):
        print(f"--- Buscando faturas pendentes para transmissora ID {id_transmissora}...")
        url = f"{self.base_url}/api/conciliacaopagamentos"
        params = {
            "cdempresa": "",
            "cdfilial": "",
            "dtcompetencia": COMPETENCIA,
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
            print(f"[ERRO] Falha ao buscar pendências: {e}")
            return []
        
        pendencias = []
        total_faturas = 0
        total_com_boleto = 0
        if "situacoes" in data:
            for sit in data["situacoes"]:
                situacao = sit.get("tpsituacaofaturatransmissao", "")
                for emp in sit.get("empresas", []):
                    for item in emp.get("itens", []):
                        total_faturas += 1
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
                        else:
                            total_com_boleto += 1
        
        if total_com_boleto > 0:
            print(f"   ✅ {total_com_boleto} fatura(s) já possuem boleto — ignoradas.")
        return pendencias


    def upload_boleto(self, id_fatura, file_path):
        if MODO_TESTE:
            print(f"[*] [MODO TESTE] Iria fazer upload de {file_path.name} para fatura {id_fatura}")
            return True

        print(f"--- Fazendo upload de {file_path.name} para fatura {id_fatura}...")
        url = f"{self.base_url}/api/conciliacaopagamentos/salvararquivos"

        # O TUST espera o campo do arquivo com nome UUID aleatório (sem hifens),
        # exatamente como o browser gera via input[type=file].
        # Enviar com nome 'file' faz o servidor ignorar o arquivo silenciosamente.
        file_field_name = uuid.uuid4().hex  # ex: "c74be4d39e0bd928bef2ce9865ee4cbc"

        headers = {
            "Accept": "application/json, text/plain, */*",
            "Referer": f"{self.base_url}/Processo/ConciliacaoPagamentos/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
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

            # Verifica o JSON de retorno: {"mensagens": [], "vberro": false}
            try:
                resp_json = res.json()
                if resp_json.get("vberro", False):
                    mensagens = resp_json.get("mensagens", [])
                    print(f"[ERRO] Servidor rejeitou o arquivo: {mensagens}")
                    return False
                else:
                    print(f"[OK] Upload aceito pelo servidor! (vberro=false, mensagens={resp_json.get('mensagens', [])})")
                    return True
            except Exception:
                # Fallback: se a resposta não for JSON, considera sucesso se status 200
                print(f"[OK] Upload concluído (resposta raw): {res.text[:200]}")
                return True

        except Exception as e:
            print(f"[ERRO] Erro no upload: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"       Resposta do servidor: {e.response.text[:300]}")
            return False

def format_for_search(text):
    if not text: return ""
    return re.sub(r'\D', '', str(text))

def extrair_texto_limpo(file_path):
    texto = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                texto += page.extract_text() or ""
    except Exception as e:
        print(f"[AVISO] Erro ao ler {file_path.name}: {e}")
    return texto

def encontrar_boleto_na_pasta(pendencia, pdf_files, cnpj_transmissora):
    print(f"--- Analisando {len(pdf_files)} arquivos para {pendencia['empresa']} (R$ {pendencia['valor']})...")
    
    target_value = f"{pendencia['valor']:.2f}"
    target_cnpj = format_for_search(cnpj_transmissora)
    
    # Lista de palavras chave baseada no nome da empresa (agente)
    agent_keywords = pendencia['empresa'].split()
    # Filtra palavras curtas e comuns
    agent_keywords = [k.upper() for k in agent_keywords if len(k) > 3]

    for pdf in pdf_files:
        # Se o nome do arquivo JA CONTEM o codigo do agente de forma obvia, prioriza
        filename_upper = pdf.name.upper()
        if pendencia['agente'].upper() in filename_upper:
            content = extrair_texto_limpo(pdf)
            # Verifica apenas valor e cnpj
            if (target_value.replace(".", ",") in content or target_value in content) and target_cnpj in format_for_search(content):
                return pdf

        content = extrair_texto_limpo(pdf)
        content_clean = format_for_search(content)
        
        # Valor formatado variacoes
        val_comma = target_value.replace(".", ",")
        
        if (val_comma in content or target_value in content) and target_cnpj in content_clean:
            # Se tivermos keywords do agente, verifica se estao no texto
            if any(k in content.upper() for k in agent_keywords):
                return pdf
            # Se for o único PDF com esse valor, aceita
            # (No caso de Sobral, os nomes dos arquivos sjp1, cor1 ja ajudam)
            if pdf.name.lower().startswith(pendencia['agente'].lower()):
                return pdf
                
    return None

def main(termo_busca):
    client = TUSTClient()
    # Tenta login, mas prossegue mesmo se falhar (pode estar em sessão de rede local)
    client.login()

    # Carregar mapeamento
    project_root = Path(__file__).resolve().parents[2]
    json_path = project_root / "tust_uploader" / "config" / "transmissoras.json"
    if not json_path.exists():
        print("❌ Arquivo transmissoras.json não encontrado.")
        return
        
    with open(json_path, "r", encoding="utf-8") as f:
        mapeamento = json.load(f)

    # Filtrar transmissora
    trans_info = next((t for t in mapeamento if termo_busca.upper() in t["Transmissora"].upper() or termo_busca.lower() in t["Slug"]), None)
    
    if not trans_info:
        print(f"❌ Transmissora '{termo_busca}' não encontrada.")
        return

    print(f"*** Iniciando processamento para: {trans_info['Transmissora']} (CNPJ: {trans_info['CNPJ']})")
    
    # Identificar ID TUST
    id_tust = None
    
    # IDs conhecidos do HAR para agilizar e garantir precisão
    FALLBACK_IDS = {
        "1007": 7,    # AFLUENTE
        "1234": 233,  # SOBRAL
        "1237": 236,  # ATIBAIA
        "1247": 246,  # BIGUACU
        "1159": 158,  # NARANDIBA (Pelo HAR: NARANDIBA (SE EXTREMOZ II))
        "1185": 184,  # POTIGUAR
    }
    
    ons_code = str(trans_info["Codigo_ONS"])
    id_tust = FALLBACK_IDS.get(ons_code)
    
    if not id_tust:
        print("--- Tentando descobrir ID via API...")
        try:
            # Tenta buscar pelo nome ou código ONS
            res = client.session.get(f"{BASE_URL}/api/transmissora?q={trans_info['Transmissora']}")
            lista = res.json().get("lista", [])
            for item in lista:
                if format_for_search(item["cdons"]) == ons_code or format_for_search(item["cdfornecedor"]) == format_for_search(trans_info["CNPJ"]):
                    id_tust = item["idtransmissora"]
                    break
        except Exception as e:
            print(f"[AVISO] Falha na consulta de ID: {e}")
        
    if not id_tust:
        print("❌ Não foi possível identificar o ID da transmissora no TUST.")
        return

    print(f"--- ID TUST Identificado: {id_tust}")
    pendencias = client.get_pendencias(id_tust)
    if not pendencias:
        print("✅ Nenhuma pendência de boleto encontrada.")
        return

    print(f"⚠️ Encontradas {len(pendencias)} faturas aguardando boleto.")

    # Listar PDFs locais
    folder_path = project_root / "boletos" / trans_info["Slug"]
    if not folder_path.exists():
        print(f"❌ Pasta {folder_path} não existe.")
        return

    pdf_files = list(folder_path.glob("*.pdf"))
    if not pdf_files:
        print(f"📁 Nenhum arquivo PDF encontrado na pasta {folder_path}.")
        return

    sucesso = 0
    falha = 0
    for pend in pendencias:
        print(f"\n>>> [{pend['agente']}] {pend['empresa']} | NF {pend['notafiscal']} | R$ {pend['valor']:.2f} | Status: {pend['situacao']}")
        match = encontrar_boleto_na_pasta(pend, pdf_files, trans_info["CNPJ"])
        if match:
            ok = client.upload_boleto(pend["id"], match)
            if ok:
                sucesso += 1
            else:
                falha += 1
        else:
            print(f"❌ Não encontrei boleto para {pend['empresa']} (Valor: {pend['valor']})")
            falha += 1

    print(f"\n{'='*50}")
    print(f"✅ Uploads com sucesso : {sucesso}")
    print(f"❌ Falhas/não encontrado: {falha}")
    print(f"{'='*50}")

if __name__ == "__main__":
    import sys
    termo = sys.argv[1] if len(sys.argv) > 1 else "sobral"
    main(termo)
