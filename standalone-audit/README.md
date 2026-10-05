# Standalone Audit domain preparation

Future work continues in the Audit project/chat. Start with [the Audit handover](HANDOVER.md) and [deployment ownership](../deployments/README.md). FM2-only deployment templates live separately in `deployments/fm2/`.

Prepared 6 October 2026 for **https://audit.digitalpalm.ai**. The supplied `Audit-Deployment-Access.md` confirms the domain/TLS and `audit-web.service` are provisioned; the package now targets `/home/deploy_audit/app` and loopback port 8900. This is a preparation branch. This task has not changed the current FM2 deployment, DNS, TLS or live Audit data.

## Included

- Independent Node HTTP server with its own `audit_session` cookie, secret and persistent data directory. No FM2 database, workbook, finance API, calculation engine or financial menus are shipped in the Audit release.
- Existing desktop Audit capture, photos/GPS, corrective actions, directory-backed assignments, deadlines, replies, monitoring and reports.
- Administrator-only Audit User Directory and role controls, company/project details, audit years/departments/areas, report settings and branding uploads.
- Mobile offline workspace and APK build targeting the new domain; existing Audit permissions and sync protocol remain compatible.
- Read-only data export and integrity verification scripts, a guarded installation script, dedicated-account deployment script and executable service launcher, migration freeze, FM2 menu removal and redirects, and rollback instructions.

## Data and account separation

The target is `/home/deploy_audit/data` on the existing server. Existing Audit usernames, salted password hashes, roles, entries, action IDs, response histories, sync receipts and image URLs are retained by the migration. Milo retains all three Audit roles; no administrator role is added to his account. FM2 accounts are not imported again.

The standalone administrator is initialized separately at installation. Its new password is written to a private handover file in `/home/deploy_audit/backups`; the FM2 administrator remains unchanged. No live account data or secrets are in Git or the code-only release.

A live snapshot was **not** copied to this Mac: automatic approval review rejected that transfer because the destination was not explicitly approved for sensitive Audit data. Preparation and tests use synthetic local data. At cutover, request approval for a direct transfer on the same server from `/var/lib/fm2` into `/home/deploy_audit/data`; a local copy is unnecessary.

## Build the release

From the repository root, using Node 20+:

```sh
node standalone-audit/scripts/build-release.mjs /absolute/path/to/new-release-directory
```

The resulting directory runs without the FM2 checkout or financial database. It contains the Audit source, required media/report assets, mobile web assets, deployment templates and migration scripts. Python dependencies are pinned in `deploy/requirements.txt`.

## Prepared Android build

Use JDK 17, Gradle 8.13 and Android SDK 35:

```sh
cd mobile/android
gradle -PauditHost=audit.digitalpalm.ai -PauditVersionCode=2 -PauditVersionName=0.2.0-test :app:assembleDebug :app:lintDebug
```

Application ID stays `ai.agrinexus.audit`; version code increases from 1 to 2 and the existing debug signing key is reused. The old-domain build remains available with default build properties. The prepared new-domain APK cannot log into production until DNS/TLS and the new service are active.

**Before updating:** every user must open the current APK online and reach zero pending changes. Different domains have different browser storage, so the new APK starts a new workspace and requires online login/download. Do not uninstall or clear the current app with pending work. Unsynced users must finish on the old endpoint before the final freeze. No claim is made that unsynced local data automatically moves between domains.

## Validation

- Audit workflow, directory assignment, duplicate retry, conflict and role-isolation tests.
- Standalone admin login/session, directory display, settings persistence, branding authorization, PDF generation including uploaded photos, and absence of FM2 APIs/files.
- Browser offline reload, persisted photo/draft, dependent finding/action/reply sync, directory email selection and account isolation against the standalone server.
- Migration snapshot checksum/record-count/media-reference checks on synthetic data.
- FM2 freeze and redirect tests preserve the finance login/API.
- Android build, lint and package signing verification. Native camera/GPS still require a physical Android device test.

## Local rehearsal

The current preview uses isolated synthetic data on `http://127.0.0.1:4188`. The desktop starts at `/app`; offline mockup is `/mobile-app/index.html` → Explore local mockup. A source-data copy and generated administrator credential live only under `/tmp/audit-domain-prep`, outside Git.

Full activation procedure: [Deployment runbook](deploy/RUNBOOK.md).
