# Standalone Audit deployment and final FM2 cutover

Prepared 6 October 2026. **No live activation or data transfer has been performed by this task.**

The user-supplied `Audit-Deployment-Access.md` provisions `https://audit.digitalpalm.ai`, valid TLS, a dedicated `deploy_audit` account, `/home/deploy_audit/app`, persistent data at `/home/deploy_audit/data`, protected environment `/home/deploy_audit/app.env`, and `audit-web.service` bound to `127.0.0.1:8900`. Use that existing infrastructure. Do not change Nginx/TLS, touch retired iPlant files under `/opt/audit`, or install another service.

## Approval checkpoint

The user requested preparation first and confirmation before the move. Before live activation, obtain confirmation to deploy at the new domain and migrate existing Audit users/records/photos directly between the two accounts on the same server. The destination is `/home/deploy_audit/data`. No local live-data snapshot is required.

Automatic approval review rejected an attempted live-data export to this Mac because its local destination had not been explicitly approved for records/password hashes. That command did not execute. All preparation tests used synthetic data. Do not work around that decision; perform a direct server-side migration only after the destination/scope is approved.

## Access and preflight

Use the existing protected SSH key with `deploy_audit@187.127.167.149`. The account can write its own app/releases/backups/data directories and run only:

```sh
sudo -n /usr/local/sbin/audit-service status
sudo -n /usr/local/sbin/audit-service restart
sudo -n /usr/local/sbin/audit-service logs
```

Logs and environment files may contain sensitive data. Do not publish their contents. Node must be 20+, Python 3.9+ with venv must be available. The deploy script installs pinned PDF dependencies in `/home/deploy_audit/venv`.

Verify the live FM2 Audit API reports JSON backend before using the JSON exporter. If it reports MongoDB, stop and prepare an approved export from the active MongoDB collection. Do not migrate a stale JSON fallback.

## Chat ownership

Audit work and deployments belong to the Audit project chat. FM2 edits, freezes, redirects and restarts belong to the FM2 chat. Coordinate the one-time migration, but do not execute FM2 deployment commands from the Audit chat. The FM2 templates live separately in `deployments/fm2/` and are excluded from the Audit release.

## Two separate decisions

1. **New-domain staging/activation:** installs only the new Audit app using copied data. Its deployment script does not restart, edit or remove FM2.
2. **Final authoritative cutover:** requires a coordinated maintenance window. Users must sync the old APK to zero pending changes, freeze old Audit writes, create a fresh final snapshot, switch traffic, and retire the old Audit endpoints. Do not let both copies accept independent writes to the same logical audit records.

A read-only rehearsal may be staged before the window, but its snapshot must not be mistaken for the final data. The prepared app is tested locally; avoid exposing a writable stale copy as production.

## Stage the code-only release

Verify the supplied archive checksum. Extract it into a NEW directory under `/home/deploy_audit/releases`. The release includes its own server, frontend, shared Audit modules, source report assets, mobile web UI, scripts and launcher; it includes no finance data or live credentials.

The root launcher uses `exec /usr/bin/node server.mjs`, runs in the existing app directory and stays in the foreground for `audit-web.service`.

## Freeze and export — only after cutover approval

1. Back up affected FM2 source and the existing service drop-ins. Retain original data and uploads.
2. Install the separately prepared FM2 cutover code archive, which is inert by default. A server administrator must install `deployments/fm2/fm2-freeze.conf` from the source repository as `/etc/systemd/system/fm2.service.d/95-audit-migration.conf`, reload systemd and restart FM2. The existing `deploy_fm2` helper can restart only; it cannot create the drop-in. This Audit preparation does not perform that restart.
3. Confirm Audit API reads/writes return 503 and FM2 finance remains available. Ensure old in-flight requests are drained. This avoids the old JSON store writing seed data during the final export.
4. As `deploy_fm2`, create a NEW private snapshot using the staged exporter:

```sh
umask 077
node /path/to/export-data.mjs /var/lib/fm2 /opt/fm2/app /home/deploy_fm2/backups/audit-final-TIMESTAMP
```

The export contains only Audit context, users with unchanged password hashes/roles, entries with action/reply histories and sync receipts, project uploads and branding. No financial tables or FM2 session secrets are included.

5. Using an approved administrator-mediated transfer, copy that snapshot directly into a NEW private directory under `/home/deploy_audit/releases`. Preserve restrictive permissions and run:

```sh
node /home/deploy_audit/releases/RELEASE/scripts/verify-snapshot.mjs /home/deploy_audit/releases/SNAPSHOT
```

Record user/finding/file counts and checksums. Verify all referenced uploaded media exists. Do not remove the source snapshot or original FM2 Audit data.

## Activate the prepared Audit release

As `deploy_audit`, after explicit confirmation:

```sh
AUDIT_DEPLOY_CONFIRMED=audit.digitalpalm.ai bash /home/deploy_audit/releases/RELEASE/deploy/deploy-after-confirmation.sh /home/deploy_audit/releases/RELEASE /home/deploy_audit/releases/SNAPSHOT
```

The script refuses existing Audit data or a nonempty environment file; review such a case rather than overwriting it. It backs up placeholder code/data/environment, copies the approved snapshot into the independent data directory, generates a new Audit-only session secret and administrator credential, installs the launcher and restarts **Audit only** through the restricted helper.

Existing Audit users keep their passwords. Milo keeps creator, author and respondent roles without admin. The new administrator password is saved only to a private handover file under `/home/deploy_audit/backups`; FM2 admin credentials stay unchanged.

Verify HTTPS `/healthz`, login/logout, role checks, user directory, settings persistence, images, PDFs, and one controlled create/action/reply round trip. Check record counts and hashes before intentional test writes. Verify FM2 finance health separately. Never expose runtime JSON, environments or scripts through the static file handler.

## Finish FM2 separation and distribute APK

1. After new-host validation, a server administrator replaces the freeze drop-in with `deployments/fm2/fm2-cutover.conf` from the source repository, reloads systemd and restarts FM2. This is a separate authorized action; the Audit deployment script does not do it.
2. Confirm FM2 hides Audit forms, reports and Audit management controls. Old `/audit` and `/mobile-app/` pages redirect to the new host; old Audit APIs return 410. FM2's financial menus, data and login remain.
3. Distribute `AgIntel-Audit-new-domain-test.apk` after the new host is ready. Version code 2, package `ai.agrinexus.audit`, same signing certificate as the earlier test APK. It requires online login/download on the new origin.
4. All users must sync the OLD APK before installing the update. Offline storage is per origin; pending work is not automatically copied between domains. Do not uninstall or clear storage with unsynced work. Test camera/GPS on a physical Android device.

## Rollback and subsequent updates

- Before new Audit writes exist: restore the old Audit placeholder code/environment backup if necessary, restart only Audit with its helper, and separately remove the FM2 migration drop-in to reopen the original Audit endpoint. Original FM2 Audit data was retained; do not restore an old whole financial database.
- After new Audit writes exist: freeze both endpoints, preserve both datasets, and reconcile newer records, users, photos and sync receipts before choosing a writer. Never overwrite new Audit data with the old FM2 snapshot or enable both endpoints as independent writers.
- The deployment error trap restores prior code/environment but deliberately preserves data for recovery. Inspect leftover files before retrying; the first-install guard prevents accidental overwrite.
- For later source updates, preserve `/home/deploy_audit/data` and `app.env`; back up and update only source, then use the Audit restart helper. Do not rerun first-time migration or administrator initialization.
