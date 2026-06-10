#!/usr/bin/env bash
# Runs ON the remote server during first-time bootstrap.
set -euo pipefail

APP_PORT="${APP_PORT:-3000}"

echo "==> Installing system packages..."
export DEBIAN_FRONTEND=noninteractive

if command -v apt-get >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq curl rsync build-essential
elif command -v yum >/dev/null 2>&1; then
  yum install -y curl rsync gcc-c++ make
else
  echo "Unsupported package manager. Install Node.js 20+ and PM2 manually."
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
if ! command -v node >/dev/null 2>&1 || [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "==> Installing Node.js 20..."
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
  elif command -v dnf >/dev/null 2>&1; then
    dnf module install -y nodejs:20 || dnf install -y nodejs
  elif command -v yum >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
  else
    echo "Unsupported OS. Install Node.js 20+ manually."
    exit 1
  fi
fi

echo "Node: $(node -v)"
echo "npm:  $(npm -v)"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> Installing PM2..."
  npm install -g pm2
  pm2 startup systemd -u root --hp /root 2>/dev/null || true
fi

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  echo "==> Opening port ${APP_PORT} in ufw..."
  ufw allow "${APP_PORT}/tcp" || true
fi

echo "==> Remote bootstrap finished."
