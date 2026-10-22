# Audit production deployment

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

- https://audit.agrinexus.ai points directly to Malaysia. It must not traverse
  India; the former India fallback vhost was removed.
- https://audit.digitalpalm.ai intentionally retains India DNS and verified-TLS
  Nginx forwarding to Malaysia; preserve this route/certificate for existing APKs.
- SSH `deploy_audit@76.13.218.53`; service `audit-web.service`, localhost 8900.
- App `/home/deploy_audit/app`, launcher `start.sh`; Node `/usr/bin/node` 22.23.4.
- Private environment `/home/deploy_audit/app.env`, persistent data
  `/home/deploy_audit/data`, Python `/home/deploy_audit/venv/bin/python`.
- JSON files are authoritative, with SQLite index `audit-query.sqlite`.
  This is not a MongoDB app. Preserve users, roles, photos, SMTP and sessions.
- Scoped operations: `sudo -n /usr/local/sbin/audit-service status|restart|logs`
  (choose one action).
- Activation and migration are complete. Never rerun `deploy-after-confirmation.sh`
  or `init-instance.mjs` as a routine update. Older first-install/cutover instructions
  below are historical and do not describe the current deployment.
- Publish only the Audit code-only release from `standalone-audit/` using its
  build-release tooling. Preserve external data/environment and the Python venv.
  Never deploy/restart FM2 from Audit work; this is a shared Git repository with
  separate app ownership and deployment folders.
- Preserve the 23 October startup fix: fetch `/api/session`, project
  `/audit-context` and `/audit-access` concurrently using Promise.all. These
  independent reads were sequential and increased loading time.
- Verify `/healthz`, authenticated context/records, roles, photos and PDF generation;
  avoid test email delivery. Existing APK domains and signing keys stay unchanged.
