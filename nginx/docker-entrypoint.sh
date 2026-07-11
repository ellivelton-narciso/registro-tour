#!/bin/sh
set -e

cert_dir="${SSL_CERT_DIR_FRONTEND:-${SSL_CERT_DIR}}"
cert="/etc/letsencrypt/live/${cert_dir}/fullchain.pem"

# Só um .template em /etc/nginx/templates/ — evita upstream duplicado no envsubst
mkdir -p /etc/nginx/templates
rm -f /etc/nginx/templates/*.template

if [ ! -f "$cert" ]; then
  echo "nginx: certificado não encontrado em $cert — modo HTTP-only (bootstrap)"
  cp /etc/nginx/nginx-http-only.conf.template /etc/nginx/templates/default.conf.template
else
  echo "nginx: certificado encontrado — modo HTTPS"
  cp /etc/nginx/nginx-https.conf.template /etc/nginx/templates/default.conf.template
fi

exec /docker-entrypoint.sh "$@"
