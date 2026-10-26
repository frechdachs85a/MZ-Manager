#!/usr/bin/env bash
# Automatisches Update (Auftrag Marcus, 26.10.2026): holt den neuesten Stand von main und baut nur dann neu,
# wenn sich etwas geändert hat. Läuft per systemd-Timer alle 5 Minuten (eingerichtet von einrichten.sh).
# Protokoll: journalctl -u mz-coach-update
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")/../../.."
exec 9>/tmp/mz-coach-update.lock
flock -n 9 || { echo "Update läuft bereits"; exit 0; }

# Läuft gerade ein Abruf (Markierung der App, jünger als 3 Stunden), nicht neu starten: nächste Runde versuchen
MARKE="mz-coach/deploy/server/daten/abruf.laeuft"
if [ -f "$MARKE" ] && [ -n "$(find "$MARKE" -mmin -180)" ]; then
  echo "Abruf läuft, Update später"
  exit 0
fi

git fetch -q origin main
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
  exit 0
fi
git merge -q --ff-only origin/main
export GIT_COMMIT="$(git rev-parse --short HEAD)"
echo "Neuer Stand $GIT_COMMIT, baue neu"
cd mz-coach/deploy/server
docker compose up -d --build
docker image prune -f >/dev/null
echo "Fertig: $GIT_COMMIT läuft"
