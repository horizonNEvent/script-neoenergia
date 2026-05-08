import streamlit as st
from pathlib import Path
import json
from datetime import datetime
from core_uploader import processar_transmissora, analisar_pasta_boletos, buscar_pendencias_competencia_especifica, obter_id_tust_automatico, sanear_pendencias_por_valor

# Configuração da página
st.set_page_config(
    page_title="TUST Uploader",
    page_icon="📄",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Inicializar session state
if "mes_selecionado" not in st.session_state:
    st.session_state.mes_selecionado = 1  # fevereiro
if "ano_selecionado" not in st.session_state:
    st.session_state.ano_selecionado = 2026
if "modal_cadastro_aberto" not in st.session_state:
    st.session_state.modal_cadastro_aberto = False

st.title("📤 TUST Smart Uploader")
st.markdown("Interface para upload automático de boletos - **100% Inteligente**")

# ==================== CARREGAR CONFIGURAÇÕES ====================
base_folder = Path(__file__).resolve().parent
json_path = base_folder / "config" / "transmissoras.json"

try:
    with open(json_path, "r", encoding="utf-8") as f:
        transmissoras_config = json.load(f)
except FileNotFoundError:
    st.error(f"❌ Arquivo não encontrado: {json_path}")
    st.stop()

# Função para adicionar transmissora
def adicionar_transmissora(nome, cnpj, codigo_ons, id_tust=""):
    """Adiciona uma nova transmissora ao JSON"""
    try:
        # Valida se a transmissora já existe
        if any(t["Transmissora"].upper() == nome.upper() for t in transmissoras_config):
            return {"status": "erro", "mensagem": "Transmissora já existe no cadastro"}

        # Cria novo registro
        nova_transmissora = {
            "Codigo_ONS": int(codigo_ons),
            "Transmissora": nome.upper(),
            "CNPJ": cnpj
        }

        # ID_TUST é opcional - só adiciona se informado
        if id_tust:
            try:
                nova_transmissora["ID_TUST"] = int(id_tust)
            except ValueError:
                return {"status": "erro", "mensagem": "ID TUST deve ser um número"}

        # Adiciona à lista
        transmissoras_config.append(nova_transmissora)

        # Salva no JSON
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(transmissoras_config, f, ensure_ascii=False, indent=2)

        mensagem_id = ""
        if not id_tust:
            mensagem_id = " (ID TUST será descoberto automaticamente)"

        return {
            "status": "sucesso",
            "mensagem": f"✅ {nome} cadastrada com sucesso!{mensagem_id}",
            "transmissora": nova_transmissora
        }
    except ValueError:
        return {"status": "erro", "mensagem": "Código ONS deve ser um número"}
    except Exception as e:
        return {"status": "erro", "mensagem": f"Erro ao salvar: {e}"}

# Criar dicionário para acesso rápido por Codigo_ONS
transmissoras_dict = {
    config["Codigo_ONS"]: config for config in transmissoras_config
}

# ==================== SIDEBAR ====================
st.sidebar.header("⚙️ Configurações TUST")

# Mapeamento de ambientes TUST
ambientes_tust = {
    "AMERICAENERGIA": {
        "url": "https://tust-americaenergia.rsmbrasil.com.br",
        "usuario": "BRUNOVOLLU",
        "senha": "Bvlu@2023"
    },
    "RIOENERGY": {
        "url": "https://tust.rsmbrasil.com.br",
        "usuario": "",
        "senha": ""
    },
    "DIAMANTEENERGIA": {
        "url": "https://tust-diamanteenergia.rsmbrasil.com.br",
        "usuario": "",
        "senha": ""
    },
    "ATLASENERGY": {
        "url": "https://tust-atlasenergy.pollvo.com/",
        "usuario": "",
        "senha": ""
    },
    "AETECAPITAL": {
        "url": "https://tust-aetecapital.pollvo.com/",
        "usuario": "",
        "senha": ""
    }
}

# Seletor de ambiente
ambiente_selecionado = st.sidebar.selectbox(
    "🌐 Ambiente TUST:",
    options=list(ambientes_tust.keys()),
    index=0,
    help="Selecione o ambiente TUST que deseja usar"
)

ambiente_config = ambientes_tust[ambiente_selecionado]

st.sidebar.caption(f"URL: `{ambiente_config['url']}`")

# Credenciais (com valores padrão do ambiente selecionado)
username = st.sidebar.text_input(
    "Usuário TUST",
    value=ambiente_config.get("usuario", ""),
    help=f"Usuário para {ambiente_selecionado}"
)
password = st.sidebar.text_input(
    "Senha TUST",
    type="password",
    value=ambiente_config.get("senha", ""),
    help=f"Senha para {ambiente_selecionado}"
)

# Competência para UPLOAD (essa vai ser usada ao processar)
st.sidebar.subheader("📤 Competência para Upload")
st.sidebar.caption("Selecione a competência que será processada:")

col1, col2 = st.sidebar.columns(2)

with col1:
    mes = col1.selectbox(
        "Mês",
        options=range(1, 13),
        format_func=lambda x: f"{x:02d}",
        index=st.session_state.mes_selecionado - 1,
        label_visibility="collapsed",
        key="mes_upload"
    )

with col2:
    ano = col2.selectbox(
        "Ano",
        options=range(2024, 2029),
        index=list(range(2024, 2029)).index(st.session_state.ano_selecionado),
        label_visibility="collapsed",
        key="ano_upload"
    )

# Formata para o padrão TUST
competencia = f"{ano:04d}-{mes:02d}-01T03:00:00.000Z"

st.sidebar.info(f"📅 Upload: {mes:02d}/{ano}")

modo_teste = st.sidebar.checkbox("🧪 Modo Teste (não faz upload real)", value=False)

# ==================== SEÇÃO: ADICIONAR TRANSMISSORA ====================
st.sidebar.divider()
st.sidebar.header("📋 Transmissoras")

# Botão para abrir modal
if st.sidebar.button("➕ Cadastrar Nova", use_container_width=True, type="primary"):
    st.session_state.modal_cadastro_aberto = True

# Lista de transmissoras
st.sidebar.caption(f"**{len(transmissoras_config)} cadastrada(s)**")
with st.sidebar.expander("Ver todas", expanded=False):
    for idx, trans in enumerate(transmissoras_config, 1):
        col_nome, col_cod = st.columns([2, 1])
        col_nome.caption(f"{idx}. {trans['Transmissora']}")
        col_cod.caption(f"ONS: {trans['Codigo_ONS']}")

# ==================== MODAL: CADASTRAR TRANSMISSORA ====================
if st.session_state.modal_cadastro_aberto:
    # Container do modal (simulado com columns)
    modal_container = st.container(border=True)

    with modal_container:
        # Cabeçalho do modal
        col_header_title, col_header_close = st.columns([9, 1])
        with col_header_title:
            st.subheader("📝 Cadastrar Nova Transmissora")
        with col_header_close:
            if st.button("✕", key="close_modal", help="Fechar"):
                st.session_state.modal_cadastro_aberto = False
                st.rerun()

        st.divider()

        # Formulário - Primeira linha
        col1, col2 = st.columns(2)

        with col1:
            st.write("**NOME TRANSMISSORA**")
            nome_trans = st.text_input(
                "Nome da Transmissora",
                placeholder="Ex: NOVO ENERGY",
                label_visibility="collapsed",
                key="nome_trans_input"
            )

        with col2:
            st.write("**CNPJ**")
            cnpj_trans = st.text_input(
                "CNPJ",
                placeholder="XX.XXX.XXX/XXXX-XX",
                label_visibility="collapsed",
                key="cnpj_trans_input"
            )

        # Formulário - Segunda linha
        col3, col4 = st.columns(2)

        with col3:
            st.write("**CÓDIGO ONS**")
            codigo_ons = st.text_input(
                "Código ONS",
                placeholder="Ex: 1500",
                label_visibility="collapsed",
                key="codigo_ons_input"
            )

        with col4:
            st.write("**ID TUST** (Opcional)")
            id_tust = st.text_input(
                "ID TUST",
                placeholder="Deixe em branco",
                label_visibility="collapsed",
                key="id_tust_input",
                help="ID será descoberto automaticamente se deixar em branco"
            )
            st.caption("*Será descoberto ao processar")

        st.divider()

        # Botões
        col_btn1, col_btn2 = st.columns(2)

        with col_btn1:
            if st.button("✅ Adicionar Transmissora", use_container_width=True, type="primary"):
                if not nome_trans or not codigo_ons or not cnpj_trans:
                    st.error("⚠️ Preencha Nome, CNPJ e Código ONS (ID TUST é opcional)")
                else:
                    # Se não preencheu ID TUST, deixa em branco (será descoberto depois)
                    resultado = adicionar_transmissora(nome_trans, cnpj_trans, codigo_ons, id_tust if id_tust else "")

                    if resultado["status"] == "sucesso":
                        st.success(resultado["mensagem"])
                        st.balloons()
                        import time
                        time.sleep(2)
                        st.session_state.modal_cadastro_aberto = False
                        st.rerun()
                    else:
                        st.error(f"❌ {resultado['mensagem']}")

        with col_btn2:
            if st.button("❌ Cancelar", use_container_width=True):
                st.session_state.modal_cadastro_aberto = False
                st.rerun()

    st.divider()

# ==================== SEÇÃO: BUSCAR COMPETÊNCIAS ABERTAS ====================
st.sidebar.divider()
st.sidebar.header("🔍 Buscar Competências Abertas")
st.sidebar.caption("Visualize quais competências têm pendências:")

# Seleção de transmissora(s)
transmissoras_opcoes_dict = {config["Transmissora"]: config for config in transmissoras_config}
transmissoras_para_buscar = st.sidebar.multiselect(
    "Transmissora(s):",
    options=list(transmissoras_opcoes_dict.keys()),
    label_visibility="collapsed",
    key="transmissora_busca"
)

# Filtro de data SEPARADO (para busca)
st.sidebar.subheader("📅 Filtro de Data")
col1_busca, col2_busca = st.sidebar.columns(2)

with col1_busca:
    mes_busca = col1_busca.selectbox(
        "Mês",
        options=range(1, 13),
        format_func=lambda x: f"{x:02d}",
        index=1,  # fevereiro
        label_visibility="collapsed",
        key="mes_busca"
    )

with col2_busca:
    ano_busca = col2_busca.selectbox(
        "Ano",
        options=range(2024, 2029),
        index=2,  # 2026
        label_visibility="collapsed",
        key="ano_busca"
    )

competencia_busca = f"{ano_busca:04d}-{mes_busca:02d}-01T03:00:00.000Z"

# Botões de ação
col_btn1, col_btn2 = st.sidebar.columns(2)

with col_btn1:
    listar_comp = col_btn1.button("🔍 Listar", use_container_width=True)

with col_btn2:
    limpar = col_btn2.button("🗑️ Limpar", use_container_width=True)

if listar_comp:
    if not transmissoras_para_buscar:
        st.sidebar.warning("⚠️ Selecione ao menos uma transmissora")
    else:
        # Formata a data selecionada para exibição
        comp_formatada = f"{mes_busca:02d}/{ano_busca}"

        # Armazena todas as pendências de todas as transmissoras
        todas_pendencias = []

        for transmissora_nome in transmissoras_para_buscar:
            with st.spinner(f"Buscando pendências de {transmissora_nome} em {comp_formatada}..."):
                resultado = buscar_pendencias_competencia_especifica(
                    username,
                    password,
                    transmissoras_opcoes_dict[transmissora_nome],
                    competencia_busca,
                    base_url=ambiente_config["url"]
                )

            if resultado["status"] in ["sucesso", "aviso"]:
                pendencias = resultado.get("pendencias", [])
                # Adiciona nome da transmissora a cada pendência para referência
                for pend in pendencias:
                    pend["transmissora_busca"] = transmissora_nome
                todas_pendencias.extend(pendencias)
            else:
                st.sidebar.warning(f"⚠️ Erro ao buscar {transmissora_nome}: {resultado['mensagem']}")

        # Mostra resultado bem simples e limpo
        if todas_pendencias:
            st.sidebar.success(f"📅 {comp_formatada} - **{len(todas_pendencias)} pendências**")

            # Armazena no session state para abrir modal
            st.session_state.modal_aberto = True
            st.session_state.pendencias_modal = todas_pendencias
            st.session_state.transmissoras_modal = transmissoras_para_buscar
            st.session_state.competencia_modal = comp_formatada
        else:
            st.sidebar.info(f"📅 {comp_formatada} - Nenhuma pendência")

if limpar:
    if "modal_aberto" in st.session_state:
        del st.session_state.modal_aberto
    if "pendencias_modal" in st.session_state:
        del st.session_state.pendencias_modal
    st.sidebar.info("✓ Listagem limpa")

st.sidebar.divider()

# ==================== SELEÇÃO DE PASTA/ARQUIVOS ====================
st.sidebar.header("📁 Pasta com Boletos")

# Inicializa session state para os PDFs uploaded
if "uploaded_pdfs" not in st.session_state:
    st.session_state.uploaded_pdfs = None
if "use_folder_path" not in st.session_state:
    st.session_state.use_folder_path = True

# Abas para escolher entre caminho ou upload direto
tab1, tab2 = st.sidebar.tabs(["📂 Caminho", "📤 Upload"])

with tab1:
    st.caption("Indique o caminho da pasta:")
    pasta_selecionada = st.text_input(
        "Caminho da pasta com PDFs:",
        value=str(base_folder.parent / "boletos"),
        label_visibility="collapsed",
        help="Cole o caminho completo da pasta que contém os PDFs dos boletos"
    )

    folder_path = Path(pasta_selecionada)

    if folder_path.exists():
        pdf_count = len(list(folder_path.glob("*.pdf")))
        st.success(f"✅ Pasta encontrada - **{pdf_count} PDFs** detectados")
        st.session_state.use_folder_path = True
        st.session_state.uploaded_pdfs = None

        # Análise prévia dos PDFs
        with st.expander("📊 Pré-análise dos PDFs"):
            indice = analisar_pasta_boletos(folder_path)
            if indice:
                st.write(f"**Valores encontrados:** {len(indice)}")
                for valor, pdfs in sorted(indice.items()):
                    st.caption(f"💰 R$ {valor} → {len(pdfs)} arquivo(s)")
            else:
                st.warning("⚠️ Nenhuma informação extraída dos PDFs")
    else:
        st.error(f"❌ Pasta não encontrada: {pasta_selecionada}")
        st.session_state.use_folder_path = False
        folder_path = None

with tab2:
    st.caption("Selecione os PDFs diretamente:")
    uploaded_files = st.file_uploader(
        "Clique para selecionar PDFs:",
        type=["pdf"],
        accept_multiple_files=True,
        label_visibility="collapsed"
    )

    if uploaded_files:
        st.success(f"✅ **{len(uploaded_files)} PDF(s)** selecionado(s)")
        st.session_state.uploaded_pdfs = uploaded_files
        st.session_state.use_folder_path = False
        folder_path = None

        # Análise prévia dos PDFs uploaded
        with st.expander("📊 Pré-análise dos PDFs"):
            # Cria estrutura temporária para análise
            import tempfile
            import shutil

            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                for uploaded_file in uploaded_files:
                    with open(temp_path / uploaded_file.name, "wb") as f:
                        f.write(uploaded_file.getbuffer())

                indice = analisar_pasta_boletos(temp_path)
                if indice:
                    st.write(f"**Valores encontrados:** {len(indice)}")
                    for valor, pdfs in sorted(indice.items()):
                        st.caption(f"💰 R$ {valor} → {len(pdfs)} arquivo(s)")
                else:
                    st.warning("⚠️ Nenhuma informação extraída dos PDFs")
    else:
        st.session_state.use_folder_path = True

# ==================== MAIN ====================
st.divider()

col1, col2 = st.columns([2, 1])

with col1:
    st.subheader("Selecione as transmissoras a processar:")

    transmissoras_opcoes = [config["Transmissora"] for config in transmissoras_config]

    transmissoras_selecionadas = st.multiselect(
        "Transmissoras:",
        options=transmissoras_opcoes,
        default=[transmissoras_opcoes[0]] if transmissoras_opcoes else None,
        label_visibility="collapsed"
    )

with col2:
    st.subheader("Ações")
    processar = st.button("▶️ Processar", use_container_width=True, type="primary")

# ==================== RESULTADO ====================
if processar:
    if not transmissoras_selecionadas:
        st.warning("⚠️ Selecione ao menos uma transmissora")
    elif st.session_state.use_folder_path and (not folder_path or not folder_path.exists()):
        st.error(f"❌ Pasta não encontrada: {folder_path}")
    elif not st.session_state.use_folder_path and not st.session_state.uploaded_pdfs:
        st.error("❌ Nenhum PDF foi selecionado")
    else:
        import tempfile

        # Se usar PDFs uploaded, cria pasta temporária
        if not st.session_state.use_folder_path and st.session_state.uploaded_pdfs:
            temp_dir = tempfile.TemporaryDirectory()
            temp_path = Path(temp_dir.name)

            # Salva os PDFs uploaded na pasta temporária
            for uploaded_file in st.session_state.uploaded_pdfs:
                with open(temp_path / uploaded_file.name, "wb") as f:
                    f.write(uploaded_file.getbuffer())

            folder_path = temp_path

        st.divider()

        total_sucesso = 0
        total_falha = 0

        # Processa cada transmissora selecionada
        for trans_nome in transmissoras_selecionadas:
            # Encontra a config da transmissora
            config = next(
                (c for c in transmissoras_config if c["Transmissora"] == trans_nome),
                None
            )

            if not config:
                st.error(f"❌ Transmissora '{trans_nome}' não encontrada no JSON")
                continue

            st.subheader(f"📊 {trans_nome}")

            with st.spinner(f"Processando {trans_nome}..."):
                resultado = processar_transmissora(
                    username,
                    password,
                    config,
                    folder_path,
                    competencia,
                    modo_teste,
                    base_url=ambiente_config["url"]
                )

            if resultado["status"] == "sucesso":
                st.success(f"✅ {resultado['mensagem']}")

                if resultado["detalhes"]:
                    # Tabela de resultados
                    cols = st.columns([2, 1.5, 1.8, 1.2, 2.5])
                    cols[0].write("**Empresa**")
                    cols[1].write("**Valor (R$)**")
                    cols[2].write("**Arquivo Encontrado**")
                    cols[3].write("**Status**")
                    cols[4].write("**Detalhes**")

                    st.divider()

                    for item in resultado["detalhes"]:
                        cols = st.columns([2, 1.5, 1.8, 1.2, 2.5])
                        cols[0].write(item["empresa"])
                        cols[1].write(f"{item['valor']:,.2f}")
                        cols[2].write(
                            item["arquivo"] if item["arquivo"] != "-" else "—"
                        )

                        # Colorir status
                        if "✅" in item["status"]:
                            cols[3].success(item["status"])
                            total_sucesso += 1
                        else:
                            cols[3].error(item["status"])
                            total_falha += 1

                        cols[4].caption(item["mensagem"])

            else:
                st.error(f"❌ {resultado['mensagem']}")
                if resultado.get("detalhes"):
                    total_falha += len(resultado["detalhes"])

            st.divider()

        # Resumo final
        if transmissoras_selecionadas:
            col1, col2 = st.columns(2)
            with col1:
                st.success(f"✅ Total com **sucesso**: **{total_sucesso}**")
            with col2:
                st.error(f"❌ Total **não encontrado/falha**: **{total_falha}**")

# ==================== MODAL DE PENDÊNCIAS ====================
if st.session_state.get("modal_aberto"):
    st.divider()
    transmissoras_selecionadas = st.session_state.get('transmissoras_modal', [])
    trans_str = ", ".join(transmissoras_selecionadas) if transmissoras_selecionadas else "N/A"
    st.subheader(f"📋 Pendências - {trans_str} ({st.session_state.get('competencia_modal')})")

    pendencias = st.session_state.get("pendencias_modal", [])

    if pendencias:
        # Tabela com informações
        st.write(f"**Total: {len(pendencias)} pendência(s)**")

        col_sanear_1, col_sanear_2 = st.columns([2, 1])
        with col_sanear_1:
            st.caption("Saneia automaticamente NFs/boletos excedentes quando houver item com valor exato da ONS.")
        with col_sanear_2:
            sanear = st.button("🧹 Sanear", use_container_width=True, type="secondary")

        if sanear:
            with st.spinner("Executando saneamento automático..."):
                resultado_saneamento = sanear_pendencias_por_valor(
                    username=username,
                    password=password,
                    pendencias=pendencias,
                    base_url=ambiente_config["url"],
                    modo_teste=modo_teste,
                )

            if resultado_saneamento["status"] == "erro":
                st.error(f"❌ {resultado_saneamento['mensagem']}")
            else:
                st.success("✅ Saneamento executado")
                for item in resultado_saneamento.get("detalhes", []):
                    emoji = "✅" if item["status"] == "sucesso" else ("⛔" if item["status"] == "bloqueado" else "⚠️")
                    st.caption(
                        f"{emoji} Fatura {item['id_fatura']} | {item['empresa']} | "
                        f"ONS {item.get('valor_ons', 0):,.2f} | {item['mensagem']}"
                    )

        cols = st.columns([1.5, 2, 1.5, 1.5, 1.5, 2])
        cols[0].write("**Transmissora**")
        cols[1].write("**Empresa/Agente**")
        cols[2].write("**Filial**")
        cols[3].write("**Valor (R$)**")
        cols[4].write("**NF**")
        cols[5].write("**Situação**")

        st.divider()

        for pend in pendencias:
            cols = st.columns([1.5, 2, 1.5, 1.5, 1.5, 2])
            cols[0].write(pend.get("transmissora_busca", "-"))
            cols[1].write(pend.get("empresa", "-"))
            cols[2].write(pend.get("agente", "-"))
            cols[3].write(f"{pend.get('valor', 0):,.2f}")
            cols[4].write(pend.get("notafiscal", "-"))
            cols[5].write(pend.get("situacao", "-"))

        # Botão para fechar
        if st.button("❌ Fechar", use_container_width=True):
            st.session_state.modal_aberto = False
            st.rerun()

st.caption(f"Última atualização: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
