#!/bin/sh
set -e

cert="/etc/letsencrypt/live/${SSL_CERT_DIR}/fullchain.pem"

if [ ! -f "$cert" ]; then
  echo "nginx: certificado não encontrado em $cert — modo HTTP-only (bootstrap)"
  cp /etc/nginx/templates/http-only.conf.template /etc/nginx/templates/default.conf.template
else
  echo "nginx: certificado encontrado — modo HTTPS"
fi

exec /docker-entrypoint.sh "$@"
