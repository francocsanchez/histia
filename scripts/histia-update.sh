#!/usr/bin/env bash

set -euo pipefail

APP_DIR="/opt/histia"
SERVICE_NAME="histia-app"
HEALTH_URL="http://127.0.0.1:3000/api/health"
MAX_ATTEMPTS=20
SLEEP_SECONDS=3

cd "$APP_DIR"

git pull origin main
docker compose pull "$SERVICE_NAME"
docker compose up -d "$SERVICE_NAME"

attempt=1
until curl --fail --silent --show-error "$HEALTH_URL" >/dev/null; do
  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "Healthcheck fallo luego de ${MAX_ATTEMPTS} intentos: $HEALTH_URL"
    docker compose ps
    docker compose logs --tail=100 "$SERVICE_NAME"
    exit 1
  fi

  echo "Esperando healthcheck (${attempt}/${MAX_ATTEMPTS})..."
  attempt=$((attempt + 1))
  sleep "$SLEEP_SECONDS"
done

docker compose ps

# Limpieza segura: solo imagenes dangling y cache no utilizada.
docker image prune -f
docker builder prune -f
