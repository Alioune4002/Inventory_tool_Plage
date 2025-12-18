#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT/frontend"
BACKEND_DIR="$ROOT/backend"

MANDATORY_ENVS=(
  DJANGO_SECRET_KEY
  DJANGO_DEBUG
  DJANGO_ALLOWED_HOSTS
  DATABASE_URL
  CORS_ALLOWED_ORIGINS
  STRIPE_API_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_SUCCESS_URL
  STRIPE_CANCEL_URL
  FRONTEND_URL
  VITE_API_BASE_URL
  INVITATIONS_SEND_EMAILS
)

OPTIONAL_ENVS=(
  SENDGRID_FROM_EMAIL
)

if [[ "${SKIP_ENV_CHECK:-}" != "true" ]]; then
  missing=()
  for var in "${MANDATORY_ENVS[@]}"; do
    if [[ -z "${!var:-}" ]]; then
      missing+=("$var")
    fi
  done
  invites_enabled="$(printf "%s" "${INVITATIONS_SEND_EMAILS:-true}" | tr '[:upper:]' '[:lower:]')"
  if [[ "$invites_enabled" == "true" ]]; then
    if [[ -z "${SENDGRID_API_KEY:-}" ]]; then
      missing+=("SENDGRID_API_KEY (required when invitation emails are enabled)")
    fi
  else
    printf "Info: invitation emails are disabled (INVITATIONS_SEND_EMAILS=%s); SendGrid check skipped.\n" "$invites_enabled"
  fi
  ai_enabled="$(printf "%s" "${AI_ENABLED:-false}" | tr '[:upper:]' '[:lower:]')"
  if [[ "$ai_enabled" == "true" ]] && [[ -z "${OPENAI_API_KEY:-}" ]]; then
    missing+=("OPENAI_API_KEY (required when AI_ENABLED=true)")
  fi

  if (( ${#missing[@]} )); then
    printf "Missing required env vars:\n"
    for var in "${missing[@]}"; do
      printf "  - %s\n" "$var"
    done
    exit 1
  fi

  for var in "${OPTIONAL_ENVS[@]}"; do
    if [[ -z "${!var:-}" ]]; then
      if [[ "$invites_enabled" != "true" ]] && [[ "$var" == "SENDGRID_FROM_EMAIL" ]]; then
        continue
      fi
      printf "Warning: optional env var %s not set (mail delivery/invitations might be disabled)\n" "$var"
    fi
  done
fi

echo "Running frontend lint/build..."
npm run lint --prefix "$FRONTEND_DIR"
if node -e "const pkg=require(process.argv[1]); process.exit(pkg?.scripts?.test ? 0 : 1)" "$FRONTEND_DIR/package.json"; then
  npm run test --prefix "$FRONTEND_DIR"
else
  echo "Skipping frontend tests (no npm test script defined)."
fi
npm run build --prefix "$FRONTEND_DIR"

echo "Running backend checks..."
PY_CMD="${BACKEND_PYTHON:-}"
if [[ -z "$PY_CMD" ]]; then
  if [[ -x "$BACKEND_DIR/.venv/bin/python" ]]; then
    PY_CMD="$BACKEND_DIR/.venv/bin/python"
  else
    if command -v python3 >/dev/null; then
      PY_CMD="python3"
    elif command -v python >/dev/null; then
      PY_CMD="python"
    else
      echo "Python interpreter not found. Activate backend venv or set BACKEND_PYTHON."
      exit 1
    fi
  fi
fi

"$PY_CMD" backend/manage.py check --settings=inventory.settings
(
  cd "$BACKEND_DIR"
  "$PY_CMD" -m pytest
)
