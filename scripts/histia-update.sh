#!/usr/bin/env bash

set -euo pipefail

APP_DIR="/opt/histia"
APP_SERVICE="histia-app"
ISSN_WORKER_SERVICE="histia-issn-worker"
APP_HEALTH_URL="http://127.0.0.1:3000/api/health"
MAX_ATTEMPTS=20
SLEEP_SECONDS=3

cd "$APP_DIR"

git pull origin main
docker compose pull "$APP_SERVICE" "$ISSN_WORKER_SERVICE"
docker compose up -d "$APP_SERVICE" "$ISSN_WORKER_SERVICE"

attempt=1
until curl --fail --silent --show-error "$APP_HEALTH_URL" >/dev/null; do
  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "Healthcheck fallo luego de ${MAX_ATTEMPTS} intentos: $APP_HEALTH_URL"
    docker compose ps
    docker compose logs --tail=100 "$APP_SERVICE"
    exit 1
  fi

  echo "Esperando healthcheck app (${attempt}/${MAX_ATTEMPTS})..."
  attempt=$((attempt + 1))
  sleep "$SLEEP_SECONDS"
done

docker compose ps

# Limpieza segura: solo imagenes dangling y cache no utilizada.
docker image prune -f
docker builder prune -f
