# 🏛️ Arquitetura e Infraestrutura de Produção (ViaNfe / Viacont)

## 1. Topologia da Oracle Cloud (IP 168.138.127.199)

`mermaid
graph TD
    Client[📱 Cliente / Navegador PWA] -->|HTTPS :443| NPM[Nginx Proxy Manager]
    
    NPM -->|Host: vianfe.contadordev.com.br| API[vianfe-api :3001]
    NPM -->|Host: n8n.contadordev.com.br| N8N[n8n Engine :5678]
    NPM -->|Host: sefaz-relay.contadordev.com.br| SEFAZ[sefaz-relay :8443]
    NPM -->|Host: painel.contadordev.com.br| NPM_ADMIN[NPM Admin :81]
    
    API -->|Storage & Data| SQLite[(database.sqlite WAL)]
    API -->|PDF Generation| Gotenberg[Gotenberg :3010]
    API -->|Nightly Query| SEFAZ_WS[SEFAZ Nacional mTLS]
    API -->|Real-time Bank| Bank_Webhooks[Open Finance Webhook]
`

## 2. Portas e Serviços Mapeados
- **vianfe-api**: Porta 3001 (Node.js Express + SPA Client PWA em /app/client/dist).
- **nginx-proxy-manager**: Portas 80, 81, 443 com certificados Let's Encrypt auto-renováveis.
- **n8n**: Porta 5678 (Workflows de atendimento WhatsApp e contingência).
- **sefaz-relay**: Porta 8443 (Relay mTLS com certificados A1 para SEFAZ).
- **gotenberg**: Porta 3010 (Conversão e renderização de DANFEs em PDF).

## 3. Rotinas e Agendamentos 24/7
- **01:15 BRT**: Varredura Noturna SEFAZ 1 (Consulta de NF-e emitidas contra clientes).
- **02:30 BRT**: Varredura Noturna SEFAZ 2 (Reconciliação e Manifestação).
- **09:30 BRT**: Radar de Alertas Preditivos WhatsApp (Disparo de guias a vencer em 48h).
- **A cada 30 min**: Sincronização e Backup com o Google Drive Nuvem.
