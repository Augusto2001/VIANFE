# 📌 DOCUMENTAÇÃO MESTRE & ROTEIRO DE AUDITORIA — VIANFE POR VIACONT

📅 Data de Atualização: 18 de Agosto de 2026  
🏢 Empresa: Viacont Inovações Contábeis  
📂 Pasta Compartilhada Oficial: C:\Users\USER\Documents\Codex\2026-08-01\revisar-2\outputs\

==================================================

📍 1. ONDE ESTÃO AS INSTRUÇÕES COMPARTILHADAS (LOCAIS DE CADASTRO)

1. PASTA COMPARTILHADA ENTRE OS AGENTES (Codex / Antigravity / Claude):
   👉 C:\Users\USER\Documents\Codex\2026-08-01\revisar-2\outputs\
   - LEIA_PRIMEIRO_MESTRE_VIANFE.md (Fonte Oficial de Continuidade)
   - INSTRUCAO_ANTIGRAVITY_SUBIR_VIANFE_ORACLE.md (Instruções da Nuvem)
   - RELATORIO_HANDOFF_ANTIGRAVITY.md (Relatório Técnico Handoff)

2. REPOSUTÓRIO DE CÓDIGO-FONTE LOCAL:
   👉 C:\app_xml_antigravity\

3. PASTA DE BACKUP FÍSICO DO SISTEMA:
   👉 C:\Users\USER\.gemini\antigravity\backups\app_xml_antigravity\

==================================================

🛡️ 2. ROTEIRO DE EXECUÇÃO EM ETAPAS (CORREÇÃO DE SEGURANÇA SEGUNDO A AUDITORIA MESTRE)

🚨 ETAPA 1 (IMEDIATA) — AUTHENTICATION & AUTHORIZATION MANDATÓRIA NAS ROTAS API:
- Aplicar o middleware verifyJwtAndTenant em 100% das rotas /api/* (exceto /auth/login).
- Eliminar qualquer senha padrão estática ou fallback de segredo fixo no código.

🛡️ ETAPA 2 — ISOLAMENTO MULTI-TENANT REAL NO BANCO DE DADOS:
- Adicionar a coluna tenant_id obrigatória em todas as tabelas (companies, invoices, certificates, nfe_manifestations, nfse_issued).
- Aplicar filtros de tenant_id em todas as queries e habilitar Row Level Security (RLS) no PostgreSQL.

🔑 ETAPA 3 — HARDENING DE CERTIFICADOS DIGITAIS A1:
- Abrir o PFX com node-forge antes de salvar no upload. Validar se o CNPJ do certificado é exatamente igual ao CNPJ da empresa e se está dentro do prazo de validade.
- Criptografar as chaves dos certificados com AES-256-GCM / Envelope Encryption.

📡 ETAPA 4 — ROTEAMENTO SEFAZ DFE VIA CONTAINER RELAY:
- Configurar a comunicação DFe para utilizar o container existente http://sefaz-relay:8443 com o RELAY_TOKEN e ICP-Brasil ativado (Zero rejectUnauthorized: false).

🏛️ ETAPA 5 — CONECTORES REAIS PARA MANIFESTAÇÃO SEFAZ E EMISSÃO DE NFS-E:
- Rotular qualquer simulação e conectar os webhooks à transmissão oficial SOAP/REST da SEFAZ Nacional e conectores de prefeituras (Salvador, Feira, Lauro, Curitiba, ADN).

☁️ ETAPA 6 — SUBIDA ISOLADA NO ORACLE CLOUD VIA DOCKER COMPOSE:
- Subir a pilha em /home/opc/vianfe/ com vianfe-api, vianfe-worker, vianfe-postgres e vianfe-redis em rede privada sem interferir no n8n, NPM ou ZapCont V2.

==================================================

💾 3. COMANDOS RÁPIDOS DE OPERAÇÃO
- Rodar Sistema Local: npm.cmd run dev (http://localhost:5173)
- Executar Backup Diário em 3 Fontes: npm.cmd run backup
- Testar Compilação TypeScript: npx.cmd tsc --noEmit (na pasta server)
