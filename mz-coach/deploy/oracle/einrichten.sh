#!/usr/bin/env bash
# Einrichtung auf einem frischen Oracle-Cloud-Server mit Ubuntu 24.04 (Always Free, Ampere A1 oder AMD).
# Aufruf auf dem Server:  bash einrichten.sh  [domain]
# Ohne Domain wird <öffentliche IP>.sslip.io benutzt (funktioniert sofort, HTTPS inklusive).
# Das Skript ist wiederholbar: ein zweiter Aufruf holt den neuesten Stand und startet neu (Update).
set -euo pipefail

REPO="https://github.com/frechdachs85a/MZ-Manager.git"
BRANCH="main"
ZIEL="$HOME/MZ-Manager"

echo "== Pakete (Docker, Git) =="
export DEBIAN_FRONTEND=noninteractive
sudo -E apt-get update -y
sudo -E apt-get install -y docker.io docker-compose-v2 git iptables-persistent curl
sudo systemctl enable --now docker

echo "== Firewall auf dem Server: Ports 80 und 443 öffnen =="
# Oracles Ubuntu-Abbilder blockieren eingehende Verbindungen außer SSH per iptables
for p in 80 443; do
  if ! sudo iptables -C INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null; then
    # vor der ersten REJECT-Regel einfügen, sonst ans Ende
    n="$(sudo iptables -L INPUT --line-numbers -n | awk '$2=="REJECT"{print $1; exit}')"
    if [ -n "$n" ]; then sudo iptables -I INPUT "$n" -p tcp --dport "$p" -j ACCEPT; else sudo iptables -A INPUT -p tcp --dport "$p" -j ACCEPT; fi
  fi
done
sudo netfilter-persistent save

echo "== Code holen =="
if [ -d "$ZIEL/.git" ]; then
  git -C "$ZIEL" fetch origin "$BRANCH" && git -C "$ZIEL" checkout "$BRANCH" && git -C "$ZIEL" pull --ff-only origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO" "$ZIEL"
fi
cd "$ZIEL/mz-coach/deploy/oracle"

echo "== Domain =="
if [ ! -f .env ]; then
  DOMAIN="${1:-}"
  if [ -z "$DOMAIN" ]; then
    IP="$(curl -fsS https://api.ipify.org)"
    DOMAIN="${IP//./-}.sslip.io"
  fi
  echo "DOMAIN=$DOMAIN" > .env
fi
cat .env
mkdir -p daten

echo "== Bauen und starten (beim ersten Mal einige Minuten) =="
sudo docker compose up -d --build

echo
echo "Fertig. Seite: https://$(sed -n 's/^DOMAIN=//p' .env)"
echo "Einrichtungscode (nur beim ersten Start):"
sleep 15
sudo docker compose logs app | grep -o "Einrichtungscode: [0-9A-F-]*" | tail -1 || echo "  noch nicht da: sudo docker compose logs app | grep Einrichtungscode"
