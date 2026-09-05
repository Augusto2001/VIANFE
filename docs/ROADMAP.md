# 🗺️ ROADMAP OFICIAL DE ETAPAS & EVOLUÇÃO (VIANFE / VIACONT)

> **Diretiva de Comportamento:** Sempre que o usuário disser etapas ou o que falta, apresentar este roadmap estruturado com os status atualizados de cada fase.

---

`mermaid
graph LR
    subgraph E1 [Etapa 1: Imediato / Piloto Operacional]
        A1[🧪 Teste Piloto PWA com Clientes]
        A2[🏦 Conexão Webhooks Open Finance Reais]
        A3[📑 Validação de Importação no Domínio Sistemas]
    end

    subgraph E2 [Etapa 2: Curto Prazo (Expansão BPO & Fiscal)]
        B1[📊 Exportação Contábil Multi-Layouts<br>(Questor, Alterdata, Fortes)]
        B2[🚚 Captura & Download de CT-e e MDF-e]
        B3[🧾 Suporte a Emissão de NFC-e (Balcão/PDV)]
    end

    subgraph E3 [Etapa 3: Médio Prazo (IA & App Stores)]
        C1[🤖 Chatbot IA no WhatsApp (Viviane Interativa)]
        C2[📦 Publicação Google Play & App Store (TWA)]
        C3[💳 Régua Automática de Honorários Viacont]
    end

    E1 --> E2
    E2 --> E3
`

---

## 🟢 Etapa 1: Validação Operacional & Teste de Campo (Imediato)
- [ ] **1.1 Teste Piloto do PWA nos Celulares dos Clientes**:
  - Testar instalação em 1-clique e atalhos rápidos em https://vianfe.contadordev.com.br.
- [ ] **1.2 Configuração dos Primeiros Webhooks de Bancos (Open Finance)**:
  - Apontar notificações de contas PJ reais (Inter PJ, Cora, Asaas) para o endpoint dedicado no sistema.
- [ ] **1.3 Importação de Teste no Sistema Domínio**:
  - Importar o .txt de conciliação gerado pelo sistema diretamente no módulo contábil da Domínio Sistemas.

---

## 🟡 Etapa 2: Expansão de Layouts Contábeis & Documentos Fiscais (Curto Prazo)
- [ ] **2.1 Exportador Multi-Sistemas Contábeis**:
  - Adicionar exportadores nos layouts **Questor, Alterdata, Fortes e SCI**.
- [ ] **2.2 Módulo de CT-e (Transporte) e MDF-e (Manifesto)**:
  - Captura e manifesto automático de Conhecimentos de Transporte Eletrônico da SEFAZ.
- [ ] **2.3 Emissão de NFC-e (Varejo / Balcão)**:
  - Módulo rápido de emissão de NFC-e para comércio local.

---

## 🔵 Etapa 3: Inteligência Artificial Interativa & Publicação Mobile (Médio Prazo)
- [ ] **3.1 Assistente Virtual Interativa no WhatsApp (IA Viviane)**:
  - Consulta interativa de impostos, faturamento e 2ª via de guias via WhatsApp.
- [ ] **3.2 Publicação Oficial nas Lojas Google Play e App Store**:
  - Distribuição via TWA / Capacitor com ícone nativo nas lojas.
- [ ] **3.3 Régua Automática de Honorários Viacont**:
  - Emissão de mensalidades contábeis com PIX e lembretes automáticos.
