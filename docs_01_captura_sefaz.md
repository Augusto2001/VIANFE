# CAMADA 1 — CAPTURA SEFAZ ROBUSTA
**Sistema:** VIANFE_ERP_BPO  
**Data:** 25 de Agosto de 2026  
**Status:** IMPLEMENTADO & VALIDADO  

---

## 1. Objetivo da Camada 1
Garantir uma captura de documentos fiscais eletrônicos (NF-e/CT-e) perante a SEFAZ Nacional que seja **imune a bloqueios por Consumo Indevido (Rejeição 656)**, garantindo a recuperação completa das notas das empresas clientes (**Amesfer** e **Churrascaria Tradição Gaúcha**) com rastreabilidade por logs de auditoria estruturados.

---

## 2. Regras e Arquitetura Implementada

### 2.1. Janela de Execução Restrita (01:00 às 03:00 - Horário de Brasília)
- **Motivo:** Evitar concorrência de consumo de NSU com os sistemas locais/ERPs dos próprios clientes durante o expediente comercial.
- **Implementação:**
  - scheduler.ts configurado para disparos automáticos estritamente às **01:15 AM** e **02:30 AM** (Horário de Brasília).
  - O método isWithinSefazWindow() valida o fuso America/Sao_Paulo. Se um disparo automático for acionado fora do intervalo [01:00, 03:00), a consulta é suspensa de forma segura e auditada (status: 'fora_da_janela').
  - O disparo manual por administradores via UI ou API permanece disponível sob demanda.

### 2.2. Prevenção Definitiva do Consumo Indevido (cStat 656)
- **Avanço Estrito de NSU:** Sempre que a SEFAZ retorna ultNSU, o valor é persistido imediatamente no banco de dados SQLite (companies.last_nsu). Nunca se reenvia um NSU antigo.
- **Tratamento de cStat 137 (Nenhum documento localizado):**
  - O sistema define automaticamente sefaz_locked_until = now + 60 minutos.
  - Interrompe o loop imediatamente. Próximas tentativas automáticas respeitam a carência.
- **Tratamento de cStat 656 (Consumo Indevido):**
  - O sistema define sefaz_locked_until = now + 65 minutos.
  - Interrompe o loop e registra log de aviso no console e banco.
- **Tratamento de cStat 138 (Lote com Documentos):**
  - Processa e ingere tanto XMLs completos (procNFe) quanto resumos (esNFe / esCTe).
  - Se ultNSU >= maxNSU, aplica carência de 60 minutos e encerra o lote.
  - Se houver mais lotes a baixar, aguarda um intervalo anti-rajada de **3.500ms** entre requisições.
- **Fila Sequencial por Empresa:** As empresas ativas são consultadas uma a uma em fila sequencial com pausa de **4.000ms a 5.000ms** entre CNPJs, eliminando rajadas concorrentes.

---

## 3. Recuperação de Empresas Críticas

### 3.1. Churrascaria e Conveniência Tradição Gaúcha (CNPJ: 51.090.446/0001-95)
- **Situação Anterior:** Travada em 20/07/2026 por descarte de resumos esNFe.
- **Recuperação Efetuada:**
  - NSUs 4669 a 4675 recuperados diretamente da SEFAZ Nacional via consulta pontual e ingestão com preenchimento automático de destinatário.
  - **Total de Notas no Banco:** 156 notas fiscais (Maio a Agosto/2026).
  - **Notas de Agosto/2026:** 7 notas (R$ 10.627,77) emitidas até 25/08/2026 de fornecedores reais (SOST Alimentos, DISTRIBUIDORA VALENÇA, SUPERGASBRAS, Seara, GUJAO ALIMENTOS).
  - **Drive Sincronizado:** G:\Meu drive\CLIENTES VIACONT\CLIENTES ATIVOS\CHURRASCARIA TRADIÇÃO LTDA (SN) ( 13 )\SETOR FISCAL\NFe\2026\08\Entradas\.

### 3.2. Amesfer Comercial Ltda (CNPJ: 54.879.195/0001-10)
- **Situação:** Base consistente com 63 notas fiscais e última emissão em 19/08/2026.
- **Estado de Carência:** sefaz_locked_until ativo e em dia com o maxNSU da SEFAZ Nacional.

---

## 4. Logs de Auditoria Estruturados

### 4.1. Tabela SQLite: sefaz_audit_logs
Armazena histórico de cada tentativa de consulta com os campos:
- id (UUID)
- company_id, cnpj, azao_social
- 
su_inicial, 
su_final, max_nsu
- 
otas_localizadas, 
otas_baixadas
- cstat, xmotivo
- 	rigger_type (gendado | manual)
- duracao_ms, iniciado_em, inalizado_em
- status (sucesso | loqueado_carência | ora_da_janela | erro)

### 4.2. Arquivo de Log Contínuo
- Localização: C:\VIANFE_ERP_BPO\logs\sefaz_audit.log
- Formato de linha:
  [TIMESTAMP] [TRIGGER] CNPJ: X | EMPRESA | NSU: ini->fim (max: Y) | Localizadas: A | Baixadas: B | cStat: C | Motivo: "..." | Status: S | Tempo: Zms

---

## 5. Validação da Camada 1
1. Compilação TypeScript do servidor sem erros (
pm run build -> Código 0).
2. Teste automatizado de proteção de janela noturna aprovado com bloqueio fora do horário (01:00 às 03:00).
3. Teste de trava de carência sefaz_locked_until aprovado (zero chamadas redundantes para a SEFAZ quando em carência).
4. Persistência de logs no banco e no arquivo C:\VIANFE_ERP_BPO\logs\sefaz_audit.log validada.
