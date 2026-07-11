# Gateway HTTPS — Subway VPS (registro-tour + ev_counter)
FROM nginx:alpine

COPY nginx/nginx.conf.template /etc/nginx/templates/default.conf.template

ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d
ENV NGINX_ENVSUBST_FILTER='^(SUBWAY_DOMAIN_FRONTEND|SUBWAY_DOMAIN_API|SUBWAY_DOMAIN_EV_COUNTER|SSL_CERT_DIR|FRONTEND_UPSTREAM)$'

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
