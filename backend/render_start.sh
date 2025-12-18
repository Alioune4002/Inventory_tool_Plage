#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8000}"

# Always run from the backend directory (Render "Root Directory" is often set to backend/)
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BACKEND_DIR"

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting gunicorn on :$PORT ..."
exec gunicorn inventory.wsgi:application --bind "0.0.0.0:${PORT}"

