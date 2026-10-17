FROM nginx:1.27-alpine
ENV PORT=8080
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY index.html apps.json /usr/share/nginx/html/
