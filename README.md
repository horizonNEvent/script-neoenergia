# ⚡ TUST Smart Uploader — Web (Vercel Edition)

Aplicação Web moderna construída em **Next.js (App Router, TypeScript)** e estilizada com **Vanilla CSS** seguindo a identidade visual oficial do [Pollvo Taxmart](https://pollvo.com/taxmart/).

Substitui completamente a versão legada em Streamlit, permitindo deploy direto na **Vercel** sem limitações de payload e com performance aprimorada.

---

## 🎨 Identidade Visual (Paleta Pollvo Taxmart)

As cores foram mapeadas diretamente do layout e CSS do [Pollvo Taxmart](https://pollvo.com/taxmart/):

| Elemento | Hex / RGBA | Uso no App |
|---|---|---|
| **Dark Navy / Hero** | `#1B1931` | Fundo principal da página |
| **Dark Secondary** | `#161426` | Header e topbar |
| **Card Roxo Translúcido** | `rgba(44, 32, 59, 0.85)` | Feature cards, caixas e painéis |
| **Card Hover** | `rgba(58, 42, 78, 0.95)` | Efeito hover dos cards |
| **Primary Brand (Berry/Magenta)** | `#843854` | Botões de ação primária, botões de upload |
| **Primary Brand Hover** | `#6E2E46` | Estado hover de botões principais |
| **Accent Pink / Magenta** | `#BD4A74` | Abas ativas, bordas de foco e títulos |
| **Accent Glow** | `rgba(189, 74, 116, 0.3)` | Efeitos de iluminação (glow) e badges |
| **Success / WhatsApp** | `#25D366` | Status conectado, sucesso de conciliação |
| **Warning / Amber** | `#FCB900` | Alertas de divergência e modo teste |
| **Danger / Rose** | `#CF2E2E` | Erros e ações de exclusão |
| **Texto Principal** | `#FFFFFF` | Cabeçalhos e números de destaque |
| **Texto Secundário** | `#E2E2E2` | Corpo de texto legível |
| **Texto Atenuado** | `#A39EB8` | Subtítulos e metadados |

---

## 🚀 Principais Recursos

1. **Parser de PDF 100% no Cliente (Navegador):**
   - Utiliza `pdfjs-dist` rodando diretamente no browser via web worker local (`public/pdf.worker.mjs`).
   - **Zero risco de timeout ou erro 413** na Vercel (evita o limite de 4.5MB em Serverless Functions).
2. **Conciliação Inteligente em 3 Estratégias:**
   - **Estratégia 1:** Valor Exato + CNPJ Exato (Confiança Alta).
   - **Estratégia 2:** Valor Exato + Razão Social compatível (Confiança Média).
   - **Estratégia 3:** Valor Exato em pendência única na competência.
3. **Saneamento Automático de NFs e Boletos:**
   - Detecta e remove boletos divergentes e cancela NFs duplicadas com 1 clique antes do re-upload.
4. **Descoberta Dinâmica de ID TUST:**
   - Busca em tempo real o ID interno da transmissora no TUST via código ONS ou CNPJ.
5. **Modo Teste / Simulação Integrado:**
   - Permite testar todo o fluxo de correspondência e leitura de PDFs sem alterar dados no TUST.
6. **Multi-Ambientes Pré-configurados:**
   - `AMERICAENERGIA`, `RIOENERGY`, `DIAMANTEENERGIA`, `ATLASENERGY`, `AETECAPITAL` e `CUSTOM`.

---

## 🛠️ Executando Localmente

```bash
# Instalar dependências
npm install

# Rodar servidor de desenvolvimento
npm run dev

# Acesse no navegador
http://localhost:3000
```

Para gerar a build de produção localmente:
```bash
npm run build
npm run start
```

---

## ☁️ Deploy na Vercel

O projeto foi configurado com `vercel.json` na raiz e usa padrão Next.js App Router:

1. Faça push do repositório para o **GitHub** / **GitLab** / **Bitbucket**.
2. No painel da **Vercel** (`https://vercel.com`):
   - Clique em **"Add New..."** → **"Project"**.
   - Importe este repositório (`script-neoenergia`).
   - Framework Preset: **Next.js** (detectado automaticamente).
   - Root Directory: `./` (raiz).
   - Clique em **"Deploy"**.

Tudo funcionará nativamente sem necessidade de configurações adicionais.
