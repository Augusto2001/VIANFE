# Regras obrigatórias do ViaNFe

- GitHub origin/main é a fonte oficial. Não publicar a partir de cópias antigas.
- Toda alteração deve terminar com testes, commit, push, deploy do mesmo SHA na Oracle e validação em produção. Se faltar uma etapa, declarar pendente.
- Não criar dados fictícios, estimativas apresentadas como fatos, protocolos ou sucessos simulados.
- Produção: /home/opc/vianfe, serviço Docker Compose vianfe-api. Nunca usar PM2 ou /var/www/vianfe.
- Usar deploy_oracle_cloud.sh com SHA completo após commit e push. Não copiar bundles manualmente para produção.
- Não apagar registros fiscais, certificados, credenciais, bancos ou alterações únicas ao limpar cópias. Backups devem ficar fora dos caminhos de build e servir somente para recuperação explícita.
- Não declarar que todo o sistema está livre de divergências com base em hashes de poucos arquivos.
