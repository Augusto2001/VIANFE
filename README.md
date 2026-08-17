# 📄 DF-e Hub | Gestão Fiscal & Backup Automático no Google Drive

Sistema completo e profissional desenvolvido para **escritórios de contabilidade** gerenciarem o download, visualização, armazenamento e backup automatizado de notas fiscais (**NF-e, NFC-e, CT-e**) de todas as suas empresas clientes.

---

## 🚀 Principais Funcionalidades

### 1. 🏢 Gestão de Empresas Clientes & Isolamento Total (Multi-Tenant)
- **Segurança e Isolamento Rígido**: As consultas e telas filtram estritamente por empresa (`company_id`). Dados de clientes diferentes **nunca se misturam**.
- **Sem Dados Fictícios**: Apenas notas fiscais reais importadas ou sincronizadas são exibidas.
- **Consulta Automática de CNPJ**: Integração com a base pública da Receita Federal (BrasilAPI) para auto-preenchimento instantâneo da Razão Social, Nome Fantasia, UF, Município e Endereço.
- **Certificado Digital A1**: Upload seguro de certificados `.pfx` / `.p12` com criptografia de ponta a ponta (AES-256) em repouso.

### 2. 📊 Dashboard de Notas Fiscais com Filtros de Período
- **Seletor de Empresa Ativa**: Alterne com um clique entre clientes no topo da tela.
- **Filtros Rápidos de Data**:
  - `Últimos 7 dias`
  - `Últimos 15 dias`
  - `Últimos 30 dias`
  - `Personalizado` (Seleção de Data Inicial e Data Final via calendário).
- **Filtros por Tipo & Status**:
  - Entradas (Compras / Notas Recebidas de Fornecedores)
  - Saídas (Vendas / Notas Emitidas pelo Cliente)
  - Autorizadas / Canceladas
- **Busca Rápida**: Por Chave de Acesso (44 dígitos), Razão Social ou Número da Nota.

### 3. 📥 Ações por Nota Fiscal (Downloads & Detalhes)
- Ao lado de cada nota fiscal na tabela:
  - 📥 **Baixar XML**: Download direto do arquivo `.xml` oficial assinado.
  - 📄 **Baixar PDF**: Download do **DANFE** oficial formatado em PDF.
  - ☁️ **Enviar ao Drive**: Sincronização imediata e individual para a pasta do cliente.
  - 👁️ **Visualizar Detalhes**: Modal detalhado com itens, NCM, CFOP, quantidades e cálculo de impostos (ICMS, PIS, COFINS, IPI).
- **Ações em Lote**:
  - `Baixar Lote XML (.ZIP)`: Compacta todos os XMLs filtrados em um único arquivo ZIP.
  - `Baixar Lote PDF (.ZIP)`: Compacta todos os DANFEs PDF em um único arquivo ZIP.

### 4. ☁️ Sincronização & Agendamento Automático para o Google Drive
- **Organização Inteligente em Pastas**:
  ```
  📁 Google Drive
  └── 📁 Contabilidade / [Nome_da_Empresa_Cliente]
      └── 📁 2026 (Ano)
          └── 📁 08 (Mês)
              ├── 📁 XMLs (arquivos .xml originais)
              └── 📁 PDFs (DANFEs oficiais em PDF)
  ```
- **Agendador em Segundo Plano (Worker Cron)**: Sincronização programada com frequências configuráveis (Diária, a cada 6h, a cada 1h ou manual).
- **Histórico & Logs de Auditoria**: Registro detalhado com status de envio, quantidade de notas e mensagens de sucesso ou erro.

### 5. 📥 Importador de Lotes XML
- Área de arrastar e soltar (Drag & Drop) para importar notas fiscais históricas ou recebidas por e-mail em formato `.xml`, gerando automaticamente os DANFEs e gravando no banco da empresa selecionada.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Canvas Confetti.
- **Backend**: Node.js, Express, TypeScript, `node:sqlite` (SQLite Nativo de Alta Performance), Fast XML Parser, PDFKit, Google APIs Client (`googleapis`), Archiver.

---

## 📦 Como Instalar e Rodar Localmente

### 1. Pré-requisitos
- Node.js instalado (v18, v20 ou v22+)

### 2. Instalação das Dependências
Na raiz do projeto:
```powershell
npm.cmd install
cd server ; npm.cmd install ; cd ..
cd client ; npm.cmd install ; cd ..
```

### 3. Iniciar o Sistema (Backend + Frontend)
Execute o comando unificado:
```powershell
npm run dev
```

- **Frontend (Painel Web)**: [http://localhost:5173](http://localhost:5173)
- **Backend (API REST)**: [http://localhost:3001](http://localhost:3001)

---

## 🐙 Como Conectar com o seu GitHub

Para enviar este projeto para o seu repositório no GitHub:

1. Crie um novo repositório vazio no seu [GitHub](https://github.com/new) (ex: `app-xml-fiscal-drive`).
2. No terminal da pasta do projeto, execute os comandos:

```powershell
git init
git add .
git commit -m "feat: Sistema de Gestão e Download Automático de XML/PDF Fiscal e Google Drive"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

---

## 🔒 Segurança e Privacidade

- Os Certificados Digitais A1 e suas respectivas senhas são armazenados com criptografia **AES-256-CBC**.
- Todo o tráfego de dados é validado por `company_id`, impedindo o vazamento de informações entre empresas clientes.
