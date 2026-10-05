#!/usr/bin/env bash
# Run as deploy_audit only after the user confirms live deployment and server-side data transfer.
set -euo pipefail
umask 077
[[ ${AUDIT_DEPLOY_CONFIRMED:-} == audit.digitalpalm.ai ]] || { echo 'Prepared only. Explicit cutover confirmation is required.' >&2; exit 2; }
[[ $(id -un) == deploy_audit ]] || { echo 'Use the dedicated deploy_audit account.' >&2; exit 2; }
release=${1:?Provide staged code release directory}
snapshot=${2:?Provide approved Audit-only snapshot in this account staging area}
case "$release" in /home/deploy_audit/releases/*) ;; *) echo 'Release must be in Audit staging.' >&2; exit 2;; esac
case "$snapshot" in /home/deploy_audit/releases/*) ;; *) echo 'Snapshot must be in Audit staging.' >&2; exit 2;; esac
app=/home/deploy_audit/app
data=/home/deploy_audit/data
envfile=/home/deploy_audit/app.env
[[ ! -e "$data/audit-context.json" ]] || { echo 'Existing Audit instance found. Refusing to overwrite data; use an incremental update procedure.' >&2; exit 2; }
[[ ! -s "$envfile" ]] || { echo 'Environment is already configured. Review and preserve it before initial deployment.' >&2; exit 2; }
node "$release/scripts/verify-snapshot.mjs" "$snapshot"
node --check "$release/server.mjs"
python3 -m venv /home/deploy_audit/venv
/home/deploy_audit/venv/bin/pip install -r "$release/deploy/requirements.txt"
backup=/home/deploy_audit/backups/before-standalone-$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$backup"
tar -czf "$backup/app.tar.gz" -C "$app" .
tar -czf "$backup/data.tar.gz" -C "$data" .
cp -p "$envfile" "$backup/app.env"
rollback() {
 code=$?
 trap - ERR
 tar -xzf "$backup/app.tar.gz" -C "$app"
 cp -p "$backup/app.env" "$envfile"
 sudo -n /usr/local/sbin/audit-service restart || true
 echo "Audit code/environment restored from $backup. Data preserved for recovery; FM2 untouched." >&2
 exit "$code"
}
trap rollback ERR
cp -a "$snapshot/." "$data/"
node "$release/scripts/init-instance.mjs" "$data" "$backup/new-app.env" "$backup/audit-admin-handover.txt"
cp -p "$backup/new-app.env" "$envfile"
cp -a "$release/." "$app/"
install -m 755 "$release/deploy/start.sh" "$app/start.sh"
sudo -n /usr/local/sbin/audit-service restart
for attempt in 1 2 3 4 5; do
 if curl --fail --silent --max-time 10 https://audit.digitalpalm.ai/healthz > "$backup/health.json"; then break; fi
 sleep 2
done
node -e 'const fs=require("fs");const data=JSON.parse(fs.readFileSync(process.argv[1]));if(data.service!=="audit"||data.status!=="ok")process.exit(1)' "$backup/health.json"
sudo -n /usr/local/sbin/audit-service status
trap - ERR
echo "Standalone Audit deployed. Private administrator handover: $backup/audit-admin-handover.txt"
echo 'FM2 source, data, service and routing were not changed by this script.'
