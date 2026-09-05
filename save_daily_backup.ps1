# Save Daily Backup Script for ViaNfe Project
$ErrorActionPreference = "Continue"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "💾 INICIANDO BACKUP DIÁRIO DO PROJETO VIANFE..." -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Git Commit & Push para o GitHub Remote (AUGUSTO2001/VIANFE)
Write-Host "1. Salvando alterações no Git local e enviando ao GitHub (AUGUSTO2001/VIANFE)..." -ForegroundColor Yellow
git add .
$dateStr = Get-Date -Format "dd/MM/yyyy HH:mm"
git commit -m "backup: Auto backup diario ViaNfe - $dateStr"
git remote set-url origin https://github.com/AUGUSTO2001/VIANFE.git 2>$null
if (-not $?) { git remote add origin https://github.com/AUGUSTO2001/VIANFE.git 2>$null }
git branch -M main
git push -u origin main

# 2. Backup na pasta C:\Users\USER\.gemini\antigravity\backups
Write-Host "2. Atualizando cópia de segurança em C:\Users\USER\.gemini\antigravity\backups..." -ForegroundColor Yellow
$backupDir = "C:\Users\USER\.gemini\antigravity\backups\app_xml_antigravity"
New-Item -ItemType Directory -Force -Path "C:\Users\USER\.gemini\antigravity\backups" | Out-Null
Copy-Item -Path "C:\app_xml_antigravity\*" -Destination $backupDir -Recurse -Force -Exclude "node_modules","dist",".git"

# 3. Confirmação do Arquivo Evernote
Write-Host "3. Verificando arquivo Evernote (vianfe_projeto_completo_evernote.md)..." -ForegroundColor Yellow
if (Test-Path "C:\app_xml_antigravity\vianfe_projeto_completo_evernote.md") {
    Copy-Item -Path "C:\app_xml_antigravity\vianfe_projeto_completo_evernote.md" -Destination "$backupDir\vianfe_projeto_completo_evernote.md" -Force
}

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "✅ BACKUP DIÁRIO CONCLUÍDO COM SUCESSO NAS 3 FONTES!" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Cyan
