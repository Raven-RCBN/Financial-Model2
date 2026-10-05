# FM2 deployment — FM2 chat only

Audit has moved to its own project/chat for development and deployment. This directory owns only FM2 deployment instructions and its one-time Audit exit controls.

- Domain: https://fm2.digitalpalm.ai/app
- SSH account: `deploy_fm2@187.127.167.149`; existing protected Mac SSH key (see private local FM2-Deployment-Access.md).
- Application: `/opt/fm2/app`, entry point `server.mjs`.
- Persistent data: `/var/lib/fm2`; preserve uploads, branding and CPO cache within the app tree.
- Staging/backups: `/home/deploy_fm2/releases`, `/home/deploy_fm2/backups`.
- Service: `fm2.service`, loopback port 4173.
- Restricted helper: `sudo -n /usr/local/sbin/fm2-service status` or `restart`.

Stage only reviewed FM2 files, back up affected code/data, validate and then restart FM2 only. Audit releases, standalone server and Audit APK are not FM2 deployment artifacts. Do not copy `standalone-audit/` or its deployment files to replace FM2's server. Do not alter `/home/deploy_audit/` or restart Audit from this workflow.

## Pending one-time Audit exit

As of 6 October 2026, the source preparation exists but live FM2 was not changed by the standalone preparation. The new Audit service still has its placeholder. Activation/data transfer awaits user confirmation.

The pending FM2 code is in root `server.mjs`, `app.js`, `public/fm/app.js` and supporting PDF renderer changes on `codex/audit-standalone-domain`. Review the full diff against deployed FM2 before installation; Git main is not automatically this preparation branch.

`fm2-freeze.conf` blocks Audit API traffic while leaving finance available. `fm2-cutover.conf` sends old Audit pages to https://audit.digitalpalm.ai and retires old Audit APIs after validation. A server administrator must apply the selected drop-in at `/etc/systemd/system/fm2.service.d/95-audit-migration.conf`, reload systemd and coordinate the restart; deploy_fm2 cannot edit systemd configuration.

Do not enable both endpoints as independent writers. All old APK users must sync before freeze. Export/transfer scope and destination require the user's cutover confirmation. Keep original data and do not restore a stale full FM2 database as rollback. See the coordinated procedure in `../../standalone-audit/deploy/RUNBOOK.md`; perform only the FM2 steps from this chat.

## Final FM2-only removal release

The post-migration source now removes the embedded Audit page, navigation, management directory/setup fields, offline mock handlers, Audit login support, runtime imports, record/sync/PDF APIs and Audit-only CSS. Financial calculation change-history remains, labeled Financial Change History. Shared `audit/` source and `mobile/` still belong to the standalone Audit build in this monorepo; they are not FM2 runtime dependencies or publicly served by FM2. Retained live Audit records/uploads must not be deleted.

Deploy this removal only AFTER the standalone Audit chat confirms production activation, migrated credentials/data/media and role checks. The separately staged f9c29e1 freeze-only release remains the migration prerequisite and must not be replaced from an uncommitted working tree. After validation, install the reviewed removal files and the final cutover override. Old Audit APIs return 410, old pages/mobile paths redirect, and finance login/pages/APIs remain. FM2 no longer reads the Audit user directory. Do not roll back to a writable old Audit copy after new Audit writes.

Regression checks use synthetic data: `tests/fm2-freeze-browser.mjs` exercises authenticated finance/admin on an intercepted production hostname; set `FM2_POST_CUTOVER=1` for the final removal and settings-save checks. `tests/fm2-audit-removal.test.mjs` checks retired APIs/assets/accounts, finance APIs and retained data independence. Both require `AUDIT_CUTOVER_TEST_DB` pointing to a synthetic fixture. The browser check also needs Playwright.
