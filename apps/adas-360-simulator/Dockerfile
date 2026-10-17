FROM nginxinc/nginx-unprivileged:1.27-alpine@sha256:28d91bdce70ad09025ea901458fdd149259d8e05982ade79d4ef2c0d9470eb48
COPY index.html /usr/share/nginx/html/index.html
# Cloud Run sends traffic to $PORT (default 8080); the image listens on 8080.
EXPOSE 8080
