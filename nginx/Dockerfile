# Gateway HTTPS — Subway VPS (registro-tour + ev_counter)
FROM nginx:alpine

COPY nginx/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/nginx.http-only.conf.template /etc/nginx/templates/http-only.conf.template
COPY nginx/docker-entrypoint.sh /docker-entrypoint-custom.sh
RUN chmod +x /docker-entrypoint-custom.sh

ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d
ENV NGINX_ENVSUBST_FILTER='^(SUBWAY_DOMAIN_FRONTEND|SUBWAY_DOMAIN_API|SUBWAY_DOMAIN_EV_COUNTER|SSL_CERT_DIR|FRONTEND_UPSTREAM)$'

EXPOSE 80 443

ENTRYPOINT ["/docker-entrypoint-custom.sh"]
CMD ["nginx", "-g", "daemon off;"]
