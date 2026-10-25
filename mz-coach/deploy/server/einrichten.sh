#!/usr/bin/env bash
# Einrichtung auf einem frischen Server mit Ubuntu 24.04: Hetzner Cloud (z. B. CAX11) oder Oracle Cloud Always Free.
# Aufruf auf dem Server:  bash einrichten.sh  [domain]
# Ohne Domain wird <öffentliche IP>.sslip.io benutzt (funktioniert sofort, HTTPS inklusive).
# Das Skript ist wiederholbar: ein zweiter Aufruf holt den neuesten Stand und startet neu (Update).
set -euo pipefail

REPO="https://github.com/frechdachs85a/MZ-Manager.git"
BRANCH="main"
ZIEL="$HOME/MZ-Manager"
# Als root (Hetzner) ohne sudo, sonst mit sudo (Oracle: Benutzer ubuntu)
if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

echo "== Firewall auf dem Server =="
# Nur Oracle: dessen Ubuntu-Abbilder blockieren per iptables alles außer SSH (REJECT-Regel). Hetzner hat keine
# solche Regel, dort passiert hier nichts. Vor Docker, damit nur diese Regeln gespeichert werden.
n="$({ $SUDO iptables -L INPUT --line-numbers -n 2>/dev/null || true; } | awk '$2=="REJECT"{print $1; exit}')"
if [ -n "$n" ]; then
  for p in 443 80; do
    $SUDO iptables -C INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || $SUDO iptables -I INPUT "$n" -p tcp --dport "$p" -j ACCEPT
  done
  if command -v netfilter-persistent >/dev/null; then $SUDO netfilter-persistent save; fi
  echo "Ports 80 und 443 geöffnet."
else
  echo "Keine blockierende Regel gefunden, nichts zu tun."
fi

echo "== Pakete (Docker, Git) =="
# Beim ersten Hochfahren hält oft das automatische Sicherheitsupdate die Paketsperre: bis 10 Minuten warten
APT="$SUDO env DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=600"
$APT update -y
$APT install -y docker.io docker-compose-v2 git curl
$SUDO systemctl enable --now docker

echo "== Auslagerungsspeicher =="
# Bei wenig Arbeitsspeicher (z. B. 4 GB) 2 GB Swap anlegen: Polster für den Bau und für Chromium
if [ "$(swapon --noheadings | wc -l)" -eq 0 ] && [ "$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)" -lt 6000 ]; then
  $SUDO fallocate -l 2G /swapfile && $SUDO chmod 600 /swapfile && $SUDO mkswap /swapfile && $SUDO swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
  echo "2 GB Swap angelegt."
else
  echo "Nicht nötig."
fi

echo "== Code holen =="
if [ -d "$ZIEL/.git" ]; then
  git -C "$ZIEL" fetch origin "$BRANCH" && git -C "$ZIEL" checkout "$BRANCH" && git -C "$ZIEL" pull --ff-only origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO" "$ZIEL"
fi
cd "$ZIEL/mz-coach/deploy/server"

echo "== Domain =="
if [ ! -f .env ]; then
  DOMAIN="${1:-}"
  if [ -z "$DOMAIN" ]; then
    IP="$(curl -fsS https://api.ipify.org)"
    DOMAIN="${IP//./-}.sslip.io"
  fi
  echo "DOMAIN=$DOMAIN" > .env
fi
# Selbst gewählter Einrichtungscode (z. B. aus der Cloud-Config): EINRICHTUNGSCODE=… bash einrichten.sh
if [ -n "${EINRICHTUNGSCODE:-}" ] && ! grep -q '^EINRICHTUNGSCODE=' .env; then
  echo "EINRICHTUNGSCODE=$EINRICHTUNGSCODE" >> .env
fi
grep '^DOMAIN=' .env
mkdir -p daten

echo "== Bauen und starten (beim ersten Mal einige Minuten) =="
$SUDO docker compose up -d --build

echo
echo "Fertig. Seite: https://$(sed -n 's/^DOMAIN=//p' .env)"
echo "Einrichtungscode (nur beim ersten Start):"
sleep 15
$SUDO docker compose logs app | grep -o "Einrichtungscode: [0-9A-F-]*" | tail -1 || echo "  noch nicht da: $SUDO docker compose logs app | grep Einrichtungscode"
