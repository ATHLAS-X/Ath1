#!/usr/bin/env bash
# One-shot setup for Oracle Ampere A1 (ARM64, Ubuntu 22.04)
# Run as root or with sudo on a fresh VM.
set -euo pipefail

echo "==> Installing Docker"
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "==> Enabling Docker on boot"
systemctl enable docker
systemctl start docker

echo "==> Done. Copy infra/.env.template to infra/.env, fill secrets, then:"
echo "    cd infra && docker compose up -d"
