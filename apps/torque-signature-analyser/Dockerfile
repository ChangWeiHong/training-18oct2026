FROM node:22-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
ENV NODE_OPTIONS=--max-old-space-size=700
RUN npm run build

FROM python:3.13-slim
WORKDIR /app
ENV OMP_NUM_THREADS=1 PORT=8080 PYTHONUNBUFFERED=1
COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt
COPY api/__init__.py api/analysis.py api/features.py api/main.py api/parsing.py api/synth.py api/
COPY api/samples api/samples
COPY --from=web /web/dist web/dist
EXPOSE 8080
CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT}
