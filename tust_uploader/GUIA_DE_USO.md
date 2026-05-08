# Guia de Uso do TUST Smart Uploader

## 1. Objetivo

O TUST Smart Uploader automatiza o processo de identificação e envio de boletos para faturas pendentes no sistema TUST, com suporte a múltiplos ambientes.

---

## 2. Ambientes Suportados

Selecione no campo **Ambiente TUST** o ambiente correto antes de processar:

- AMERICAENERGIA
- RIOENERGY
- DIAMANTEENERGIA
- ATLASENERGY
- AETECAPITAL

---

## 3. Pré-requisitos

- Credenciais válidas do TUST para o ambiente escolhido.
- Arquivos PDF de boletos disponíveis em pasta local ou para upload manual.
- PDFs com texto legível (não apenas imagem), contendo preferencialmente:
  - valor da fatura;
  - CNPJ da transmissora;
  - identificação da empresa/agente.

---

## 4. Acesso à Aplicação

Ao abrir a aplicação Streamlit:

1. Preencha **Usuário TUST** e **Senha TUST**.
2. Defina a **Competência para Upload** (mês/ano).
3. Escolha como fornecer os boletos:
   - **Caminho**: informe a pasta com os PDFs;
   - **Upload**: selecione os arquivos diretamente na interface.

---

## 5. Fluxo Operacional Recomendado

### Etapa 1: Validação Inicial

1. Ative **Modo Teste (não faz upload real)**.
2. Selecione as transmissoras a processar.
3. Clique em **Processar**.
4. Analise o resultado:
   - itens com sucesso;
   - itens não encontrados;
   - possíveis divergências.

### Etapa 2: Ajustes

Se houver divergências:

1. Verifique os PDFs da competência;
2. Ajuste arquivos com dados incompletos ou ilegíveis;
3. Utilize o botão **Sanear** na seção de pendências quando necessário.

### Etapa 3: Upload Real

1. Desative **Modo Teste**;
2. Execute novamente em **Processar**;
3. Confirme o resultado final por transmissora.

---

## 6. Como Funciona a Identificação Automática

Para cada pendência da competência selecionada, o sistema:

1. Consulta pendências no TUST.
2. Lê os PDFs e extrai informações relevantes.
3. Faz o matching com prioridade:
   - valor exato + CNPJ + empresa;
   - valor exato + empresa;
   - valor exato (quando único candidato).
4. Realiza upload para a fatura correspondente.

---

## 7. Saneamento de Pendências

O botão **Sanear** atua em casos com documentos excedentes/divergentes:

- consulta o detalhe da fatura;
- compara documentos com o valor ONS;
- cancela itens divergentes utilizando endpoints oficiais;
- respeita bloqueios quando a integração ERP está no status **Enviado**.

Observação: o saneamento é conservador para reduzir risco de cancelamento indevido.

---

## 8. Boas Práticas Operacionais

- Processar por competência e por lote organizado de PDFs.
- Evitar misturar documentos de transmissoras distintas na mesma execução.
- Executar sempre primeiro em Modo Teste.
- Manter registro de execução (data, ambiente, competência, transmissoras e resultado).

---

## 9. Erros Comuns e Ações Recomendadas

### Pasta não encontrada

- Revisar o caminho informado;
- confirmar permissões de leitura.

### Nenhum PDF encontrado

- Confirmar extensão `.pdf`;
- verificar se os arquivos estão no nível correto da pasta.

### Boleto não encontrado

- Revisar legibilidade do PDF;
- confirmar valor e CNPJ no documento;
- validar se o arquivo pertence à competência processada.

### Falha no login

- Validar usuário/senha;
- confirmar ambiente correto;
- verificar conectividade.

---

## 10. Procedimento Padrão para Uso Mensal

1. Selecionar ambiente.
2. Informar credenciais.
3. Definir competência.
4. Carregar PDFs.
5. Rodar em Modo Teste.
6. Corrigir pendências.
7. Rodar upload real.
8. Validar resultado final.

