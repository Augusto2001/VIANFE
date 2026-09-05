#!/bin/bash
# ==============================================================================
# SCRIPT OFICIAL DE DEPLOY — VIANFE POR VIACONT (ORACLE CLOUD / UBUNTU 24.04)
# ==============================================================================

set -e

echo "🚀 INICIANDO DEPLOY DO VIANFE NA ORACLE CLOUD..."

# 1. Atualizar Pacotes do Sistema
echo "1. Atualizando pacotes do sistema Ubuntu..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx certbot python3-certbot-nginx build-essential

# 2. Instalar Node.js 24 LTS e PM2
echo "2. Instalando Node.js 24 LTS e PM2..."
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# 3. Configurar Diretório da Aplicação
echo "3. Preparando diretório da aplicação..."
sudo mkdir -p /var/www/vianfe
sudo chown -R $USER:$USER /var/www/vianfe

# 4. Instalar Dependências e Fazer Build do Projeto
echo "4. Instalando dependências e realizando build..."
cd /var/www/vianfe
npm install
npm run build

# 5. Iniciar Serviços com PM2 Process Manager
echo "5. Iniciando API Backend e Servidor com PM2..."
pm2 stop vianfe-server 2>/dev/null || true
pm2 start server/dist/index.js --name "vianfe-server"
pm2 save
pm2 startup | tail -n 1 | sudo bash || true

# 6. Configurar Nginx Reverse Proxy
echo "6. Configurando Nginx Reverse Proxy..."
sudo tee /etc/nginx/sites-available/vianfe << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        root /var/www/vianfe/client/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/vianfe /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "=============================================================================="
echo "✅ DEPLOY DO VIANFE CONCLUÍDO COM SUCESSO NA ORACLE CLOUD!"
echo "🌐 Acesse no navegador pelo IP do servidor ou seu domínio configurado."
echo "=============================================================================="
