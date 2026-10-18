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

## 12 October 2026 — offline Android programmer handover

User requested the mobile APK source for a programmer and confirmed that login,
roles and company scope must match the webapp. Prepared source ZIP and test APK
in the local Audit `artifacts` folder (`Audit-Mobile-Programmer-Source-20261012.zip`
and `Audit-Mobile-0.3.0-test.apk`). `mobile/PROGRAMMER-HANDOVER.md` is the build,
auth/API, offline-photo sync and limitation reference. The reproducible package
script uses an explicit code allowlist, strips historical seed records from the
packaged store and excludes runtime data, credentials, original reports and keys.

Changed Android's default host to `audit.digitalpalm.ai`, default version to
0.3.0-test/code 3, generated the Gradle 8.13 wrapper and made the native user-agent
use BuildConfig version. APK assets are bundled, so web deployments do not update
installed mobile UI. Existing Audit debug certificate is retained, no key included.
No production data or deployed server files were changed for this task.

Android assembleDebug/lintDebug passed (one expected JavaScript-enabled WebView
warning; zero errors). Nineteen focused unit tests passed. The synthetic localhost
browser test passed offline reload/draft/photo persistence, ordered dependent
sync, authenticated evidence, retry deduplication, shared web/mobile session,
server respondent write denial and selected-company isolation. Hardware camera,
GPS and lifecycle remain to be validated on a physical Android device.

The current mobile device autosave is distinct from server Draft status; server
Draft editing/finalization stays in the webapp. Sync is foreground-only and fetches
all permitted records/photos; selected offline packs, bounded storage, delta sync
and native background upload remain potential programmer improvements.

## 13 October 2026 — report download control

Removed the print icon, leaving one Download report PDF button. Blob URLs remain
valid for 60 seconds rather than being revoked immediately. Added visible progress,
server error messages, PDF content/signature validation, timeout and duplicate-click
guard. Synthetic browser test `tests/audit-download-browser.mjs` verified an actual
PDF download containing all six findings beyond the five-row page, error recovery,
and invalid HTML-response rejection. Parsed the three-page PDF and viewed page 1.

Deployed only standalone-audit/app.js (SHA256
78ac83f0b6d4c731f3002d8b6bc02d24e4bc40fa00d876a944eab0c47efa4e54).
Server backup: /home/deploy_audit/backups/before-download-fix-20261013/app.js.
No service restart or data changes. Live authenticated frontend checks confirm the
print icon is absent and delayed URL cleanup is served.

User approved server-only verification after automatic review rejected a broad
live report diagnostic. No report bytes or credentials were copied to the Mac.
Both OBAN year exports returned HTTP 200: 2024 has 24 findings including all 22
imported sections, produces 59 pages (55 original plus additional-record appendix),
6,822,626 bytes. 2025 has all 22 imported sections and produces 107 pages,
27,165,044 bytes, SHA256 identical to the uploaded original. No corrective actions
were present in either year at verification. Existing export behavior preserves
original pages and appends additional records; it does not re-typeset the imported
narrative. User's current report download fix leaves that export behavior intact.

## 13 October 2026 — recommendation and assignee corrective-action workflow

Auditor-authored description is now labelled Recommendation in data entry,
tracking, user-role labels, notification text and generated PDF follow-up sections.
Assignee response is labelled Corrective action taken. Data entry shows a disabled
corrective-action textbox and photo controls under each recommendation, explaining
that they open only after finalization. Existing schema/records are unchanged.

Standalone workflowOptions now enables lockFinalized. Non-admin users cannot
change finalized findings, recommendations or assignments, or add recommendations;
only assigned respondents with respond permission can submit corrective-action
replies/photos/status. Draft creator editing and draft validation remain unchanged.
Administrator corrections/deadline extensions and the existing overdue lock remain.
The shared validator gates this behavior on the standalone option, leaving FM2's
options unchanged. Mobile sync enforces it too, including observation updates;
idempotent acknowledgements remain accepted. Older mobile builds that attempt to
add recommendations after saving an Open finding receive the new explicit 403 and
retain the queued change for review. Future mobile UI work must assemble the
recommendations before finalization or support server Draft finalization; the
previous programmer source ZIP/test APK was not rebuilt in this webapp task.

Validation: 18 workflow/photo/mobile unit tests passed; synthetic browser verified
visible disabled draft controls, editable recommendation, pre-finalization reply
rejection, post-finalization edit rejection for creator/respondent, and assigned
corrective action with photo/server author/time. No production test records created.

Deployed six source files only from audit-recommendation-workflow-20261013.tar.gz
(SHA256 4c4fd768377d5e3c930170f92ad1915cb89c54d93fa79f0db6f16f1cb9659050).
Code backup: /home/deploy_audit/backups/before-recommendation-workflow-20261013/source.tar.gz.
Only Audit service restarted. Runtime data and FM2 unchanged.

## 17 October 2026 — draft editing/deletion, evidence retention and administrator reopening

Detailed Findings now shows Edit at the top of drafts owned by the current creator
(or any draft for an administrator). Edit opens the populated Data Entry form,
including all observation photos. Delete draft requires confirmation and the exact
saved revision; the API enforces creator/admin permissions, rejects finalized or
imported records and stale writes, and prevents a stale editor recreating a deleted
draft. Deletion retains a private recovery record in data/deleted-drafts and keeps
photo files to avoid breaking shared references.

Administrators can select Reopen as draft on finalized webapp-created findings.
Imported OBAN PDF findings remain locked, per explicit user choice. Reopening
preserves the original creator and corrective-action/photo history, pauses assignee
updates, and records the administrator/time. The creator/admin can revise and
finalize again. Recommendations with existing responses cannot be removed while
editing. Server-owned lifecycle notification revisions notify the creator and
assigned users on reopening and re-finalization through the existing persistent
email ledger/retry worker. Original draft creation still sends no assignment mail.

Removed the shared normalizer's silent 12-observation-photo truncation. Desktop
save/edit/report/PDF preserves every attached observation photo. Saving waits for
photo preparation. Mobile's existing capture limit remains 12 new photos per
upload, but replying to desktop entries with more photos no longer rejects them.
Earlier unlinked uploads were not reassociated: ownership is uncertain and the
user expressly prohibited changes to existing records during testing.

Validation: 29 workflow, mobile, draft and notification unit tests passed. A
synthetic localhost browser test uploaded 16 photos, saved/reloaded/edited/deleted
a draft, checked cancel/stale-save/unauthorized deletion, exercised admin reopen,
creator re-finalization and assignee lock. Generated PDF contains all 16 captions
and 16 image placements over three pages. Email tests use a simulated sender and
verify retries/deduplication; no test messages sent to real users. The temporary
fixture has a known synthetic-only administrator login for these tests.

Deployed six source files only from audit-draft-reopen-photos-20261017.tar.gz,
SHA256 5cd1d6871d0b3532ca54c8c7527701c4dc4f6fefe171e28df024dedd9267ab9b.
Backup: /home/deploy_audit/backups/before-draft-reopen-photos-20261017/source.tar.gz.
Compared live source before installation; canonical standalone store/import
transforms retained. Restarted audit-web.service only. Health passed, all six
installed source hashes matched, and findings/context/users remained byte-for-byte
unchanged across deployment. SMTP configuration checked without revealing values.

Git synchronization on 17 October: verified the eight changed desktop/backend
source files against live checksums. Updated the remaining mobile/web/app.js
version-label change with a source backup at
/home/deploy_audit/backups/before-mobile-label-20261017/app.js. Public health passed;
findings, settings and user directory checksums were unchanged. Included the
previously packaged mobile programmer guide in the checkout, with current
finalization restrictions documented. No APK rebuild was performed in this sync.

## 18 October 2026 — local-only formatting and image-preview review

User explicitly requested local implementation and preview before deployment.
Uncommitted working tree adds accessible image dialogs (click/keyboard, Escape,
Close, focus return and actual-size toggle) for observation and response evidence.
Data-entry findings, impact, recommendations, assignee corrective-action text and
observation captions have only Bold/Italic/Underline toolbar buttons. Plain text
remains unchanged in the schema; optional character-range style arrays are saved
alongside it, normalized on persistence, escaped on display and rendered in the
standalone PDF. Emails/search and existing mobile clients continue reading plain
text. Text ranges count Unicode code points. Pasted content is plain text only.

New dependency audit/text-format.mjs must accompany the shared store/permissions;
the release and programmer-package allowlists include it. Frontend app.js is now
loaded as a module, and the standalone server explicitly serves this one helper.
No arbitrary HTML is stored/rendered. Imported source-PDF pages remain unchanged.

31 unit tests passed. Synthetic browser checked all three selected-text styles,
draft save/reload/finalization, report display, image dialog keyboard/close/focus,
and generated PDF; PDF fonts confirm bold and italic. Screenshots and synthetic
PDF are outside Git at ../artifacts/local-formatting-preview-20261018. Local server
port4187 uses temporary fictional fixture data and SMTP is disabled. No production
files, records, emails, deployment or Git push performed for this preview.

Local preview refinement: B/I/U buttons are 28px square. Writing areas grow up to
192px then scroll internally; image captions use shorter scrolling editors.
Screen evidence uses compact thumbnail grids (96px image height), retaining the
full-size image dialog and unchanged PDF rendering. Browser check with eight
unsaved sample paragraphs confirmed 192px client height, 1080px scroll height and
scrolling to the last paragraph (scrollTop 888). The existing synthetic report
thumbnail measured 196x96px and opened its enlarged dialog; Escape closed it.
No records were saved or changed during these layout checks.

## 18 October 2026 — approved formatting deployment

User approved Git and webapp publication after local review. View & Report now
also scrolls long text on screen, preserves B/I/U and uses compact clickable
thumbnails. Screen-only rules leave printed text unbounded; PDF generation keeps
the complete text and evidence images.

31 unit tests passed, plus synthetic browser checks for draft deletion/reopening
and 16-photo PDF retention, finalized assignee updates, and compact editor/report
scrolling with keyboard access and unrestricted print height. Browser regression
selectors now identify their own records when the fixture contains other entries.

Deployed nine source files only from audit-formatting-update-20261018.tar.gz,
SHA256 59854ff62e358c55ac605ce0b90f14b081a3a936c17eecd60d58d64084d4887a.
Backup: /home/deploy_audit/backups/before-formatting-20261018/source.tar.gz.
Preflight matched live files to the previous Git version with standalone import
and storage transforms. Restarted audit-web.service only. Installed hashes and
public HTTPS health passed for audit.digitalpalm.ai and audit.agrinexus.ai.
Records, directory, settings and uploaded-photo fingerprints remained unchanged.
