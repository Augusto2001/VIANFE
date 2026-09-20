#!/usr/bin/env bash
# Execute na Oracle: bash deploy_oracle_cloud.sh <SHA completo de origin/main>
set -euo pipefail
cd /home/opc/vianfe
exec 9>/home/opc/.vianfe-deploy.lock
flock -n 9 || { echo 'Outro deploy está em execução'; exit 1; }
sha="${1:?Informe o SHA completo publicado no GitHub}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'SHA inválido'; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo 'Alterações locais: deploy bloqueado'; exit 1; }
git fetch origin main
[[ "$(git rev-parse origin/main)" == "$sha" ]] || { echo 'SHA não é o origin/main atual'; exit 1; }
[[ "$(git rev-parse HEAD)" == "$sha" ]] || { echo 'Faça checkout do SHA aprovado antes de executar este script'; exit 1; }
# Não ativar o scheduler versionado enquanto o cron legado ainda existe.
legacy_cron=$(sudo -n crontab -l)
if printf '%s\n' "$legacy_cron" | grep -v '^#' | grep -q '/app/server/storage/auto_ciencia_standalone.mjs'; then
  echo 'Migração pendente: retire o cron legado com server/scripts/migrate_science_cron.py após backup'
  exit 1
fi
# O build usa dependências do lockfile e imagem Node identificada por digest.
node_image='node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1'
sudo -n docker run --rm -v /home/opc/vianfe:/work -w /work "$node_image" sh -c 'npm --prefix server ci && npm --prefix client ci && npm --prefix server run build && npm --prefix client run build'
sudo -n docker run --rm -v /home/opc/vianfe:/work -w /work "$node_image" sh -c 'node server/tests/science-protocol.cjs && node server/tests/scheduler-ciencia.cjs && node server/tests/no-simulated-success.cjs'
[[ "$(git ls-remote origin refs/heads/main | cut -f1)" == "$sha" ]] || { echo 'GitHub mudou durante o build'; exit 1; }
old_image=$(sudo -n docker inspect vianfe-api --format '{{.Image}}')
sudo -n docker tag "$old_image" "vianfe-recovery:before-${sha:0:12}"
sudo -n docker build --label "org.opencontainers.image.revision=$sha" -t vianfe-vianfe-api .
sudo -n docker compose up -d --no-deps --no-build vianfe-api
healthy=0
for attempt in $(seq 1 15); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null; then healthy=1; break; fi
  sleep 2
done
[[ "$healthy" == 1 ]] || { echo 'Falha de saúde; entrega pendente, imagem de recuperação preservada'; exit 1; }
actual=$(sudo -n docker inspect vianfe-api --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')
[[ "$actual" == "$sha" ]] || { echo 'Container não corresponde ao SHA'; exit 1; }
curl -fsS https://vianfe.contadordev.com.br/health
printf '\nDeploy verificado: %s\n' "$sha"
