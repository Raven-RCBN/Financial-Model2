# Audit development and deployment handover

Prepared 6 October 2026, Asia/Kuala_Lumpur. This is the canonical technical handover for the new Audit project chat. The originating chat is now FM2-only. User explicitly requested this separation; this handover does not authorize production activation.

## Where work continues

- New project: `/Users/admin/Documents/Audit`.
- Independent source checkout: `/Users/admin/Documents/Audit/source`.
- Shared Git remote: `git@github.com:Raven-RCBN/Financial-Model2.git`.
- Preparation branch: `codex/audit-standalone-domain`; baseline commit `d2351cd`.
- New Audit chat uses branch `codex/audit-project-handover` in its own checkout. Future Audit branches should use `codex/audit-*`.
- Original source chat ID: `01a10a43-e7e8-7a40-8880-26a8e6ce816b`, previously titled “Add corrective action tracking”. It retains the conversation history; this handover summarizes decisions, delivered work and pending work.
- Private local access details: `../Audit-Deployment-Access.md`; prepared APK and code-only archives: `../artifacts/` relative to this checkout. No secret contents belong in Git/chat.

## User decisions and delivered history

1. Each finding supports corrective actions with a responsible person, email, due date, status, response/reply history and follow-up dates for monitoring overdue actions.
2. Separate Audit directory and roles: creator records observations/findings; corrective-action author adds recommendations, assignees and deadlines; assigned respondent replies and updates assigned actions. Admin manages users and setup. Audit accounts see Audit only, with server-side FM2 restrictions.
3. Responsible-person selection uses the active Audit directory and automatically resolves email, excluding administrator accounts.
4. Five FM2 directory names were provisioned as real Audit sign-in accounts. Those directory entries did not contain existing login credentials, so separate initial passwords were generated and handed over privately. Do not claim old FM2 passwords were copied. Existing Audit password hashes must be preserved during the standalone migration.
5. Milo has all three Audit workflow roles (create/recommend/respond), without administrator or FM2 permissions. Do not grant him admin on migration.
6. Web/mobile use AgIntel green and gold styling with light, readable type; the user explicitly rejected heavy bold text.
7. Android APK uses the same Audit account credentials/roles as the webapp. The user approved online login and download before offline work. Offline drafts, photos and queued finding/action/reply operations persist and sync later with duplicate/retry/conflict controls and per-user isolation.
8. User requested the entire Audit app be separated from FM2 to audit.digitalpalm.ai, including necessary management settings, directory, roles, reports and APK. Preparation is complete; live activation remains pending confirmation.
9. User now requests all further Audit development/deployment in the Audit chat; this source chat remains FM2-only. Do not restart/deploy FM2 from Audit work. Coordinate FM2-side cutover through its chat/user rather than silently making changes.

## Git and components

- `standalone-audit/server.mjs`: independent HTTP app, audit_session cookie, required independent secret, own data files and admin authentication, Audit APIs and static allowlist. No finance endpoints.
- `standalone-audit/app.js`, `index.html`, `styles.css`: Audit desktop capture/report and administrator management. Company/project, directory/roles, years/departments/areas, branding and report settings are included.
- `audit/audit-permissions.mjs`, `audit-store.mjs`, `mobile-sync.mjs`, `render_audit_pdf.py`: shared workflow/store/sync/PDF code. `audit/evidence/`, `audit/source-reports/`: required report assets.
- `mobile/web/`: service worker, offline storage, mockup and sync UI. `mobile/android/`: native Java WebView wrapper with camera/gallery and location support.
- `standalone-audit/scripts/build-release.mjs`: produces a standalone code-only release, rewrites shared module imports, isolates Mongo config under AUDIT_MONGODB_URI, and copies no FM2 server or financial database. Generated JSON store writes atomically and fails on corrupt data.
- `export-data.mjs`, `verify-snapshot.mjs`, `init-instance.mjs`: read-only scoped export, checksums/count/media verification and new standalone administrator/session initialization.
- Audit deployment only: `standalone-audit/deploy/`. FM2 deployment only: `deployments/fm2/`. FM2 freeze/redirect templates have been moved OUT of the Audit release.
- Main root `server.mjs`, `app.js`, `public/fm/app.js` contain pending FM2 freeze/redirect support. They belong to FM2 deployment, not the standalone Audit release.

Historical commits: b8f75f4 (accounts/actions isolation), ea17a32 (green/gold UI), 9dc9790 (offline APK and directory dropdown), d2351cd (standalone preparation and compatible APK). The handover adds documentation and deployment-folder separation; it does not merge or deploy the preparation branch.

## Verified infrastructure and current state

At the preparation check on 6 October 2026:

- Domain/TLS valid: https://audit.digitalpalm.ai. HTTPS /healthz reported deployment-ready, applicationDeployed:false.
- Host 187.127.167.149, SSH account deploy_audit, protected existing key path `/Users/admin/.ssh/digitalpalm_deploy_ed25519` (reference only; never copy key).
- App `/home/deploy_audit/app`, foreground launcher `start.sh`, service `audit-web.service`, loopback port8900, runtime user deploy_audit.
- Own persistent data `/home/deploy_audit/data`; env `/home/deploy_audit/app.env` mode0600 (empty at inspection); releases/backups under the same home.
- Only sudo helper `/usr/local/sbin/audit-service status|restart|logs` is allowed. No Nginx/TLS/general sudo. Existing infrastructure should be reused.
- Code-only baseline staged and checksum checked at `/home/deploy_audit/releases/audit-standalone-prepared-20261006`. This is baseline d2351cd packaging and predates the handover's deployment-file cleanup; rebuild/restage from current Git before cutover.
- Live app remains placeholder; no live records/credentials/photos have been transferred. Live FM2 remains unchanged by standalone preparation. Recheck current state before any future work; this is a dated observation.
- Do not touch retired iPlant `/opt/audit/app` or its credentials/backups.

## Activation checkpoint and next steps

The user has NOT yet confirmed new-domain activation or the direct migration. Obtain that confirmation in the Audit chat. Destination: `/home/deploy_audit/data` on the existing server. Read `deploy/RUNBOOK.md` first.

A previous attempt to copy a live-data snapshot to this Mac was rejected by automatic approval review because that sensitive-data destination was not explicitly authorized. It did not execute. No live snapshot is available locally. Do not retry or route around the rejection. The proposed next migration is direct server-side transfer after scope/destination approval.

Recheck active storage backend before using the JSON exporter (stop if Mongo; do not export stale JSON fallback). Coordinate the FM2 maintenance freeze with the FM2 chat and server administrator. All users sync old APK to zero pending first. Export only Audit users/hashes/roles, context, findings/actions/replies/sync receipts and referenced images/branding. Preserve original data; verify counts, checksums and all media references. Activate one authoritative writer; never expose two independent writable copies.

Audit first-install script requires AUDIT_DEPLOY_CONFIRMED=audit.digitalpalm.ai, refuses existing data/nonempty env, backs up the placeholder, initializes an independent admin credential and session secret, installs Python dependencies in an Audit venv and restarts only Audit. Do not rerun initialization for routine updates. The new admin credential goes into a private server handover; FM2 admin stays unchanged.

The FM2 systemd freeze/redirect step requires an administrator; deploy_fm2 cannot edit service drop-ins. This remains FM2-chat work. After activation verify HTTPS/login/roles/settings/PDF/photos/sync and counts, then coordinate old endpoint retirement. Preserve both datasets if rollback follows new writes.

## APK handover

Prepared artifact: `../artifacts/AgIntel-Audit-new-domain-test.apk`; package ai.agrinexus.audit, versionCode2, versionName0.2.0-test, target audit.digitalpalm.ai. Same debug certificate as previous APK: SHA256 31cae0b8ba0c41ca8a7bd3210f791ee8924e2917d76bc8ad485a711b34a3f161.

Build from mobile/android with JDK17, Gradle8.13, Android SDK35 (min26):

```sh
gradle --no-daemon -PauditHost=audit.digitalpalm.ai -PauditVersionCode=2 -PauditVersionName=0.2.0-test :app:assembleDebug :app:lintDebug
```

Default build properties still target FM2; ALWAYS specify the Audit host for new Audit builds. Update versionCode when distributing subsequent updates. Existing debug keystore is on this Mac; do not replace it or commit it. A release-signing strategy is still needed before a production distribution.

The new APK cannot production-login until activation. Each domain has separate WebView storage. Users MUST sync the old APK to zero pending before update, then log in online/download on the new host. Never uninstall/clear storage with pending work; there is no automatic cross-domain migration of offline drafts. Native camera/GPS needs a physical Android test; no device/emulator test was completed.

## Validation already completed at baseline

- 18 tests: audit-workflow, mobile-sync and audit-cutover. Roles, directory selection, retries/conflicts, freeze503 and redirect307/API410 while FM2 finance login remains available.
- Standalone browser/admin tests: own cookie, admin directory/settings persistence, PDF including photos, role restrictions, no FM2 APIs/private financial files, no browser JS errors.
- Mobile browser against standalone: initial login, offline reload, persisted drafts/photos, dependent finding/action/reply queue, retry idempotency and account/role isolation.
- Synthetic migration export/checksum/count/media verification; no real production migration performed.
- Android assembleDebug/lintDebug/signature and matching certificate passed. PDF renderer's existing undefined DARK_BLUE bug fixed when photo tests exposed it.

Run unit tests from repository root:

```sh
node --test tests/audit-workflow.test.mjs tests/mobile-sync.test.mjs tests/audit-cutover.test.mjs
```

Browser tests require a SYNTHETIC fixture only; never point them at production. `tests/standalone-audit-browser.mjs`, `tests/mobile-browser.mjs` document expectations. Previous local preview: http://127.0.0.1:4188/app and /mobile-app/index.html. It used `/tmp/audit-domain-prep/test-data`; temporary preview files may disappear and are not required deployment data.

## Local tool paths and private references

Node: `/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.
Playwright module: `/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`; Chrome channel available.
Android SDK: `/Users/admin/Library/Mobile Documents/com~apple~CloudDocs/Documents/Wildlife management/android-sdk`.
JDK: `/Users/admin/Library/Mobile Documents/com~apple~CloudDocs/Documents/Wildlife management/jdk/jdk-17.0.19+10/Contents/Home`.
Gradle: `/Users/admin/.gradle/wrapper/dists/gradle-8.13-bin/5xuhj0ry160q40clulazy9h7d/gradle-8.13/bin/gradle`.

Original workspace: `/Users/admin/Library/Mobile Documents/com~apple~CloudDocs/T7 CODEX/Archived Projects/Financial Model 2`.
Prior account handover remains private at that workspace's `AgIntel-Audit-Testing/Audit-account-handover.txt`; passwords are not copied into this handover or Git. Existing domain-preparation archives are in `Audit-Domain-Migration/`. No live account export should be inferred from these code-only artifacts.
