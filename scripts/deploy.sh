#!/usr/bin/env bash
# Deploy vibe-live to a remote server via SSH + rsync.
#
# Usage:
#   REMOTE_HOST=101.132.167.228 ./scripts/deploy.sh
#   ./scripts/deploy.sh --bootstrap   # first-time server setup
#
# Environment variables (see docs/deployment.md):
#   REMOTE_HOST      required — server IP or hostname
#   REMOTE_USER      default root
#   DEPLOY_SSH_KEY   default ~/.ssh/flowmore.pem
#   REMOTE_APP_DIR   default /opt/vibe-live
#   APP_PORT         default 3000

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$PROJECT_ROOT/.env.deploy" ]]; then
  # shellcheck disable=SC1091
  set -a
  source "$PROJECT_ROOT/.env.deploy"
  set +a
fi

REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_USER="${REMOTE_USER:-root}"
DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/flowmore.pem}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/opt/vibe-live}"
APP_PORT="${APP_PORT:-3000}"

BOOTSTRAP=false
SKIP_BUILD=false

usage() {
  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bootstrap) BOOTSTRAP=true; shift ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown option: $1" >&2; usage 1 ;;
  esac
done

if [[ -z "$REMOTE_HOST" ]]; then
  echo "Error: REMOTE_HOST is required." >&2
  echo "Example: REMOTE_HOST=101.132.167.228 ./scripts/deploy.sh" >&2
  exit 1
fi

DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY/#\~/$HOME}"

if [[ ! -f "$DEPLOY_SSH_KEY" ]]; then
  echo "Error: SSH key not found: $DEPLOY_SSH_KEY" >&2
  exit 1
fi

SSH_OPTS=(
  -i "$DEPLOY_SSH_KEY"
  -o StrictHostKeyChecking=accept-new
  -o BatchMode=yes
)

SSH_TARGET="${REMOTE_USER}@${REMOTE_HOST}"
RSYNC_SSH="ssh ${SSH_OPTS[*]}"

echo "==> Target: ${SSH_TARGET}:${REMOTE_APP_DIR}"

remote() {
  ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "$@"
}

if $BOOTSTRAP; then
  echo "==> Bootstrapping server (Node.js 20 + PM2)..."
  remote "bash -s" < "$SCRIPT_DIR/deploy-bootstrap-remote.sh"
  echo "==> Bootstrap complete."
fi

echo "==> Syncing files..."
rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.env.*.local' \
  --exclude '.DS_Store' \
  --exclude 'docs/infinite-scrolling-dragging-and-snapping-cards-with-gsap-and-scrolltrigger-smooth' \
  -e "$RSYNC_SSH" \
  "$PROJECT_ROOT/" "${SSH_TARGET}:${REMOTE_APP_DIR}/"

echo "==> Checking remote .env..."
if ! remote "test -f ${REMOTE_APP_DIR}/.env"; then
  echo ""
  echo "Warning: ${REMOTE_APP_DIR}/.env does not exist on the server."
  echo "Create it before the app can call the AI API. Example:"
  echo ""
  echo "  ssh -i ${DEPLOY_SSH_KEY} ${SSH_TARGET}"
  echo "  cat > ${REMOTE_APP_DIR}/.env <<'EOF'"
  echo "  ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3"
  echo "  ARK_API_KEY=your-key"
  echo "  ARK_MODEL=your-model"
  echo "  EOF"
  echo ""
fi

echo "==> Installing dependencies & building on server..."
BUILD_CMD="cd ${REMOTE_APP_DIR} && npm ci && npm run build"
if $SKIP_BUILD; then
  BUILD_CMD="cd ${REMOTE_APP_DIR} && npm ci"
fi
remote "$BUILD_CMD"

echo "==> Updating PM2 config port..."
remote "sed -i 's/-p [0-9]*/-p ${APP_PORT}/' ${REMOTE_APP_DIR}/deploy/ecosystem.config.cjs && \
  sed -i 's/PORT: \"[0-9]*\"/PORT: \"${APP_PORT}\"/' ${REMOTE_APP_DIR}/deploy/ecosystem.config.cjs && \
  sed -i 's|cwd: \"/opt/vibe-live\"|cwd: \"${REMOTE_APP_DIR}\"|' ${REMOTE_APP_DIR}/deploy/ecosystem.config.cjs"

echo "==> Starting / restarting app with PM2..."
remote "cd ${REMOTE_APP_DIR} && \
  (command -v pm2 >/dev/null || npm install -g pm2) && \
  pm2 startOrReload deploy/ecosystem.config.cjs --update-env && \
  pm2 save"

echo ""
echo "Deploy complete."
echo "  URL: http://${REMOTE_HOST}:${APP_PORT}"
echo ""
echo "If the page does not load, open port ${APP_PORT} in:"
echo "  - Alibaba Cloud security group (inbound rule)"
echo "  - Server firewall: ufw allow ${APP_PORT}/tcp  (if ufw is enabled)"
