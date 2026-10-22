# FM2 production deployment — FM2 chat only

Updated 23 October 2026 (Asia/Kuala_Lumpur).

Production application deployments target **Malaysia: 76.13.218.53**, Hostinger
KVM 8, `srv2071562.hstgr.cloud`. India `187.127.167.149` / `srv1670614`
is not an application deployment target for this app. Its retired deployment
accounts/services must not be reactivated. Never select the SSH destination by
resolving a public digitalpalm.ai hostname: those names can still point to India.

Preserve live users, sessions, environment, uploads, database and application
settings. Review Git status and the intended revision; preserve unrelated work.
A Git push does not deploy production. Back up current Malaysia state before
publication, retain a previous code release, and restart only this application's
service when required. Never initialize or restore old India data over live data.
Transfer migration/backup data directly server-to-server; the Mac only orchestrates
and verifies. Binary Docker transfer helpers require `--log-driver none`.
Do not commit credentials, environment values, databases, backups or SSH keys.

Use existing protected SSH credentials with strict host verification. Malaysia's
ED25519 fingerprint is `SHA256:snKgdDjK7Dvuca8i2zpGA8KQkFwyqQaOyL0+Vy8nUeE`.
The existing local pinned host file is
`/Users/admin/Documents/ChatGPT/Server Check/new-kvm8-setup/known_hosts`;
the protected deployment key reference is
`/Users/admin/.ssh/digitalpalm_deploy_ed25519`. Never copy key material.

- https://fm2.digitalpalm.ai intentionally points to India; verified-TLS Nginx
  forwarding serves the Malaysia app. Preserve that route and its certificate.
- SSH `deploy_fm2@76.13.218.53`.
- Service `fm2.service`, localhost 4173, Node `/usr/bin/node` 22.23.4,
  entry `/opt/fm2/app/server.mjs`; application `/opt/fm2/app`.
- Persistent data `/var/lib/fm2/plantation-financial-model.db.json` and private
  `/var/lib/fm2/advisory-sso.json`; preserve uploads, branding and CPO caches.
  This application uses JSON, not a dedicated MongoDB instance.
- Staging `/home/deploy_fm2/releases`, backups `/home/deploy_fm2/backups`.
- Scoped helper permits `sudo -n /usr/local/sbin/fm2-service status` or `restart`;
  no logs permission was added. Private service environment/drop-ins stay outside Git.
- Standalone Audit cutover is complete. Preserve FM2_AUDIT_EXTERNAL_URL pointing
  to `https://audit.digitalpalm.ai`, FM2_AUDIT_FREEZE=0, retired Audit APIs returning
  410 and redirects. Never restore the old writable embedded Audit or restart Audit.
- Preserve the 23 October `advisory-sso.mjs` fix: after validating/assigning an
  Advisory session, GET `/` and `/app/` redirect to `/advisory-view` before the
  permitted-route check. Keep all read-only permission checks; do not broaden access.
- Stage only reviewed FM2 files, back up current state, validate, restart only FM2.
  Retain system Python PDF/Excel dependencies. Verify root/app, authenticated
  financial APIs, valid Advisory landing/read-only restrictions, PDF and Excel.
  Audit source/mobile artifacts in this shared repo are not FM2 release files.
