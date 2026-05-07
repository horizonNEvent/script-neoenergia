# 📤 TUST Smart Uploader

Interface inteligente para upload automático de boletos no sistema TUST.

## 🚀 Instalação

### Primeiro acesso

1. **Instale as dependências:**
```bash
pip install streamlit requests pdfplumber
```

### Para usar a segunda vez
Só execute o app, não precisa reinstalar.

---

## 📋 Estrutura de Pastas

O app agora é **100% inteligente** - não precisa de estrutura rígida!

```
amee/
├── transmissoras.json          ← Dados das transmissoras (não mudar)
├── app_uploader.py             ← Interface (não mudar)
├── core_uploader.py            ← Lógica do backend (não mudar)
├── README.md                   ← Este arquivo
├── boletos_fev/                ← Qualquer pasta com PDFs
│   ├── doc1.pdf
│   ├── invoice_cemar.pdf
│   └── ...
└── documentos_importantes/     ← O nome NÃO importa!
    ├── boleto_2026.pdf
    └── ...
```

**O nome da pasta pode ser QUALQUER UM!** O app lê os PDFs e extrai as informações automaticamente.

---

## 🏃 Como Usar

### 1. **Prepare os PDFs** (em qualquer pasta!)

- Crie uma pasta com qualquer nome (ex: `boletos_fev/`, `documentos/`, `temp/`)
- Coloque os PDFs dos boletos dentro
- Os PDFs devem conter:
  - ✅ **Valor da fatura** (ex: "15.234,50" ou "15234.56")
  - ✅ **CNPJ da transmissora** (ex: "27.853.556/0001-87")
  - ✅ **Nome da empresa** (ex: "CEMAR", "COELBA")

### 2. **Abra o app**
```bash
streamlit run app_uploader.py
```

O navegador abre automaticamente em `http://localhost:8501`

### 3. **Use a interface**

1. **À esquerda (SIDEBAR):**
   - Digite seu usuário/senha TUST
   - Configure a competência (mês/ano)
   - **Cole o caminho da pasta com PDFs** (qualquer pasta!)
   - Veja quantos PDFs foram detectados
   - Ative "Modo Teste" se quiser simular antes

2. **Na área principal:**
   - Selecione uma ou mais transmissoras
   - Clique em [▶️ Processar]
   - Veja o resultado em tempo real

3. **Pré-análise (opcional):**
   - Clique em "📊 Pré-análise dos PDFs"
   - Veja quais valores foram encontrados nos boletos

### 4. **Resultado**
Você verá uma tabela com:
- ✅ **Sucesso**: Boleto encontrado e upload realizado
- ❌ **Erro**: Algo deu errado no upload
- ❌ **Não encontrado**: Boleto não foi encontrado na pasta

---

## 🧠 Como o App é Inteligente

Em vez de usar o nome da pasta, o app:

1. **Lê TODOS os PDFs** da pasta que você informou
2. **Extrai automaticamente:**
   - 💰 Valores (ex: "15.234,50")
   - 🏢 CNPJs (ex: "27.853.556/0001-87")
   - 👤 Nomes de empresas (ex: "CEMAR", "COELBA")

3. **Faz matching inteligente:**
   - Valor EXATO + CNPJ + Empresa ✅ (melhor match)
   - Valor EXATO + Empresa (sem CNPJ exato)
   - Valor EXATO (último recurso)

4. **Upload automático** do arquivo correto

**Resultado:** Nome da pasta é completamente irrelevante!

---

## 🆕 Adicionar Nova Transmissora

Se precisar adicionar uma transmissora que não está no JSON:

### 1. **Abra `transmissoras.json`**

### 2. **Adicione um novo objeto:**
```json
{
  "Codigo_ONS": 1111,
  "Transmissora": "NOME DA TRANSMISSORA",
  "CNPJ": "XX.XXX.XXX/XXXX-XX"
}
```

### 3. **Pronto!** Quando você abrir o app, a nova transmissora aparecerá automaticamente.

---

## ⚙️ Configurações Importantes

### Usuário/Senha TUST
- Digite uma vez, fica salvo na sessão
- Não é armazenado em arquivo (seguro)

### Caminho da Pasta com PDFs
- Cole o caminho completo da pasta
- Exemplo: `D:\Downloads\boletos_fev`
- Pode ser qualquer pasta com PDF!

### Competência
Formato: `YYYY-MM-DDTHH:MM:SS.000Z`
- Padrão: `2026-02-01T03:00:00.000Z`
- Deixe assim se não souber mudar

### Modo Teste
- ☐ **Desativado** (padrão): Faz upload real
- ☑️ **Ativado**: Apenas simula, não faz upload (útil para testar)

---

## 🔧 Troubleshooting

### "Pasta não encontrada"
- ✅ Copie o caminho completo da pasta
- ✅ Verifique se digitou certo
- ✅ Exemplo correto: `D:\Workspace\projetos-da-rsm\script-neoenergia\amee\boletos`

### "Nenhum PDF encontrado"
- ✅ Verificar se a pasta existe
- ✅ Verificar se tem arquivos `.pdf` (extensão)
- ✅ Não pode ter pastas dentro (só PDFs no primeiro nível)

### "Boleto não encontrado"
O boleto precisa ter esses 3 dados para ser encontrado:
- ✅ **Valor exato** da fatura (ex: "15.234,50" ou "15234.56")
- ✅ **CNPJ da transmissora** (ex: "27.853.556/0001-87" ou "27853556000187")
- ✅ **Nome da empresa** (ex: "CEMAR", "COELBA", "LIGHT")

**Dica:** Use a "📊 Pré-análise" para ver exatamente quais valores o app detectou.

### "Erro ao fazer login"
- ✅ Verificar usuário/senha
- ✅ Verificar conexão com internet
- ✅ Verificar se o site TUST está disponível

---

## 📊 Estrutura do JSON

O arquivo `transmissoras.json` tem apenas 3 campos por transmissora:

```json
{
  "Codigo_ONS": 1234,          ← Código ONS (não muda)
  "Transmissora": "SOBRAL",     ← Nome da transmissora (não muda)
  "CNPJ": "27.853.556/0001-87"  ← CNPJ da transmissora (não muda)
}
```

Simples e limpo!

---

## 🎯 Dicas

1. **Qualquer pasta funciona** - `Downloads`, `Desktop`, `Documentos`, etc
2. **Nomes não importam** - Os PDFs é que falam
3. **Use Modo Teste** - Sempre teste antes de fazer upload real
4. **Pré-análise ajuda** - Veja o que o app conseguiu extrair dos PDFs
5. **PDFs precisam ser legíveis** - Boletos em imagem podem não ser detectados

---

## 🔍 O que o App Extrai dos PDFs

Para cada PDF encontrado, o app automaticamente busca por:

```
💰 Valores: 1.234,56 | 1234.56 | 12345,67
🏢 CNPJs: XX.XXX.XXX/XXXX-XX | XXXXXXXXXXXXXXXX
👤 Empresas: CEMAR, COELBA, LIGHT, COPEL, etc
```

Exemplo de saída da pré-análise:
```
Valores encontrados: 3
  💰 15234.50 → 2 arquivo(s)
  💰 8500.00 → 1 arquivo(s)
  💰 12100.00 → 1 arquivo(s)
```

---

## ❓ Dúvidas?

Se algo não funcionar:
1. Ative "Modo Teste"
2. Use "📊 Pré-análise" para debug
3. Veja o resultado e as mensagens de erro
4. Se ainda tiver dúvida, guarde os erros e converse com o desenvolvedor

---

**Versão:** 3.0 (100% Inteligente)  
**Última atualização:** 14/04/2026
