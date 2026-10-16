# Audit Android programmer handover

Prepared 12 October 2026; workflow notes updated 17 October 2026. Start here when using the source ZIP.

## What is provided

A working Android **Java + WebView** test app with its HTML/CSS/JavaScript UI bundled inside the APK. It connects to **https://audit.digitalpalm.ai** for authentication, audit data and photos. Opening the installed APK offline uses its bundled UI and IndexedDB; it is not simply a shortcut to a website. The browser version uses a service worker instead.

The ZIP includes `mobile/android` (Android Studio project and Gradle wrapper), `mobile/web` (offline UI), `audit` and `standalone-audit` (backend reference and synthetic local test server), and focused tests. Existing production APIs serve the mobile app; no production server redeployment is needed to try this APK. Do not deploy the reference backend over production.

No live database, user passwords, SMTP credentials, original reports, uploaded photos, signing keys or server access documents are included. Test credentials in the fixture are fictional and work only against that fixture. Historical seed findings are removed from the packaged store; the package uses the standalone Audit store configuration. See `SOURCE-MANIFEST.json` for source provenance and file hashes.

## Login, roles and company access

The mobile app uses the **same webapp username and password**, posted to the same `/login` endpoint and checked against the same Audit user directory. There is no separate mobile user database or mobile password. `audit-access.identity` supplies `create`, `recommend`, `respond`, `companySetup` and `admin`; mobile screens use the workflow flags, while the backend rechecks permissions on every write. Respondents can update actions assigned to their email only. Company-specific users receive only their allowed company settings and findings; assignee choices are filtered for the finding company. Company setup and user administration remain webapp functions. Offline permissions are cached, so changes take effect at the next successful server check; removed access cannot be revoked inside an offline device instantly. The server refuses unauthorized uploads.

## Build the APK

Requirements from this project's build configuration: JDK 17, Android SDK platform 35, Gradle 8.13 (wrapper supplied), Android Gradle Plugin 8.12.0. Android Studio can open `mobile/android`. Set `JAVA_HOME` and `ANDROID_HOME`, or configure the local SDK in Android Studio. First build needs internet to fetch Gradle/dependencies.

```sh
cd mobile/android
./gradlew --no-daemon :app:assembleDebug :app:lintDebug
# Windows: gradlew.bat :app:assembleDebug :app:lintDebug
```

Output: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

Default package: `ai.agrinexus.audit`; version code **3**, version name **0.3.0-test**; minimum Android **8 / API 26**, target **35**. The default host is now `audit.digitalpalm.ai`. The old FM2 override remains for shared-source compatibility; do not use it for this Audit app.

```sh
./gradlew -PauditHost=audit.digitalpalm.ai -PauditVersionCode=4 -PauditVersionName=0.4.0-test :app:assembleDebug
```

Each new installable update needs an increased version code and the same signing certificate as the installed app. The supplied test APK uses the existing Audit debug certificate; your own debug build will normally use a different certificate. Do not uninstall an app holding unsynced work just to bypass a signing mismatch. For distribution, establish a privately managed release keystore/signing configuration, then build `:app:assembleRelease`. No release signing key/configuration is supplied. Keep keys outside Git.

The Android shell intercepts only allowlisted `/mobile-app/` assets on its configured HTTPS origin; API requests and cookies use that same origin. It blocks other top-level navigation, disables file access and mixed content, and delegates camera capture to the Android camera app through a FileProvider. Do not bypass TLS checks or add a broad JavaScript-to-native bridge.

## How data and photos reach the webapp

1. Sign in online with an existing Audit directory account. The app downloads permitted company settings, directory choices, findings and available photos.
2. Offline, select company/year/department/area, enter a finding, capture GPS if needed, and choose/take photos. The form autosaves locally; **Save finding on device** places a create operation into a persistent queue.
3. Reconnect with the app open and use **Sync now**. The queue uploads operations in order. Successful server responses replace the cached records and remove acknowledged queue entries.
4. In the webapp, select the same company and report year in **View & Report**. The synced finding and photos use the same backend records and appear there.
5. Recommendations must be assigned before finalization in the webapp. Assigned respondents can submit corrective actions, status, follow-up date and up to eight photos; server-side author/time and due-date permissions remain authoritative.

`mobile/web/app.js` owns IndexedDB, login, UI, image compression and the queue. `mobile/web/core.mjs` owns local projections and conflict snapshots. `audit/mobile-sync.mjs` validates operation IDs, retry receipts and concurrent edits. `audit/audit-permissions.mjs` enforces roles; `standalone-audit/server.mjs` enforces company access, stores photos and calls the shared write logic.

## Finalization rules as of 17 October 2026

Finalized findings and recommendations are locked for non-administrators. Only assigned respondents can add corrective-action replies. An administrator can reopen a webapp-created item as Draft in the webapp, notifying its creator and assignees; refinalization sends another notification. Imported report findings stay locked. Creator/admin draft edit and deletion are webapp features.

The existing mobile UI still offers some finding/recommendation edits that the updated server rejects with 403. Failed changes remain queued for review. Before field rollout, align the mobile UI with these rules and assemble recommendations before finalization, or implement server Draft creation/edit/finalization. The historical mobile browser workflow test below predates these restrictions; the current web workflow tests cover the enforced rules.

## Current HTTP contract

Base origin: `https://audit.digitalpalm.ai`.
Project identifier: **`project_opsl_15000ha_development`** (historical identifier still used by standalone Audit; it is not a company ID).
Let `P = /api/projects/project_opsl_15000ha_development/`.

| Request | Purpose / response |
| --- | --- |
| `POST /login` | URL-encoded `userid` and `password`; success sets HttpOnly `audit_session` cookie and redirects to `/app`. Invalid credentials return 401 HTML. Follow with session lookup. |
| `GET /api/session` | Authenticated `userId`, `role`, expiry and project access. |
| `GET P + audit-access` | `identity`, allowed `assignees`, notification status; full user directory is admin-only. |
| `GET P + audit-context` | Permitted companies and `project.settings.auditCompanyProfiles`; per-company years, departments and areas. |
| `GET P + audit-entries?company=URL_ENCODED_NAME&page=1&pageSize=200` | Paginated `items`, `total` and report summaries. Optional `auditYear`, `department`, `status`, `q`. Continue until all requested items are received. |
| `POST P + audit-sync` | JSON `{operationId, patch, base?}`. Success returns `{entry, ...}`; duplicate retry returns the same entry with `duplicate:true`. |
| `GET /audit/uploads/...` | Authenticated evidence image; keep cookie and company authorization. Store URLs returned by the server, never construct file paths. |
| `GET /logout` | Clears server cookie; local logout also locks the active workspace. |

Native rewrites must preserve the cookie jar across requests. Do not embed credentials/API keys in the APK or send admin credentials to field devices. Sessions last 12 hours; a 401 requires online sign-in with the same account, retaining queued work.

Example new finding (`operationId` and `patch.id` must be newly generated UUIDs; use company/settings actually returned for the user):

```json
{
  "operationId": "031ac5c0-9559-454d-954a-98cdb9a27e0c",
  "patch": {
    "id": "69421312-012e-4e98-aecf-1e9cba15407f",
    "entity": "JB FARMS OBAN Plantation",
    "auditYear": "2025",
    "department": "Mill Department",
    "area": "SOP compliance",
    "priority": "Medium",
    "finding": "Describe the observed issue",
    "impact": "Describe the impact",
    "location": "Block or location",
    "reference": "",
    "actions": [],
    "observationImages": [],
    "geo": null,
    "source": "Mobile field capture"
  }
}
```

Add photos as `{name, description, dataUrl:"data:image/jpeg;base64,..."}` in `observationImages`. The app compresses images to JPEG quality 0.8 and maximum edge 1600 px; maximum 12 finding photos. The server persists image bytes and returns `{url,name,description}`. An optional `geo` contains numeric `latitude`, `longitude`, `accuracy` in metres. Server request limit is 40 MiB; there is no chunked/resumable upload. A proxy may impose a lower limit.

Other patches:

- `update-finding`: existing `id`, updated finding fields, `newImages`, optional `geo`. `base` must contain the original values of `finding, impact, department, area, priority, location, reference, auditYear` (strings). Existing server Draft records must be edited/finalized in the webapp.
- `add-action`: finding `id`, `action:{id:UUID,description,owner,email,dueDate}`. Directory username/email must match an active respondent permitted for the finding's company. Date is `YYYY-MM-DD`.
- `update-action`: finding `id`, `actionId`, updated `action`; `base` contains original `description,owner,email,dueDate` strings.
- `reply`: finding `id`, `actionId`, `text`, `status` (`Open`, `In progress`, `Closed`), `dueDate` (follow-up, or empty), `images` (up to eight data-URL objects). `base` contains original `status,responseDueDate`. Follow-up dates do not extend the original assignment deadline.

Keep the **same operationId and unchanged patch** on network retries. Store the request durably before sending. A different patch using an acknowledged ID yields 409. Persist the response before removing the local operation. Upload a new finding before its dependent actions/replies. Current errors: 400 validation, 401 reauthentication, 403 role/company/deadline denial, 404 missing record, 409 conflict, 413 payload too large. Retain and visibly flag failed work. Do not silently overwrite another device's edits or automatically discard failed uploads.

Assignment/reminder email is a backend responsibility. The mobile app contains no SMTP credentials. The server determines timezone from recorded GPS, falling back to Africa/Lagos; after the due date ends in that timezone, respondents are locked while admins can extend/update.

## Run safe local verification

Use Node.js 22+ and Python 3 with SQLite support. No live database or cloud services are needed. From the package root:

```sh
node --test tests/mobile-sync.test.mjs tests/audit-response-evidence.test.mjs tests/audit-company-config.test.mjs tests/audit-drafts-notifications.test.mjs
node mobile/scripts/test-server.mjs
```

The fixture listens only on `127.0.0.1:4187`. Open `http://127.0.0.1:4187/mobile-app/index.html`. It creates fictional users `mobile.milo` (all three workflow roles) and `mobile.owner` (respondent), password `MobileTest-Only-2026`, and a fictional Training Plantation. `mobile.scoped` is a respondent restricted to a second fictional company, Restricted Training Plantation. It generates isolated temporary data and session secret, does not inherit SMTP settings, and removes temporary data on normal shutdown. The synthetic administrator `admin` uses the same fixture-only password for administrator workflow tests. Do not use these test accounts in production.

For automated browser verification, install Playwright and Google Chrome, keep the fixture running in one terminal, and run in another:

```sh
npm install --no-save playwright
node tests/mobile-browser.mjs
```

Alternatively set `PLAYWRIGHT_MODULE` to an installed Playwright `index.mjs` path. This test requires localhost and writes screenshots to the OS `/tmp` directory unless `MOBILE_TEST_OUTPUT` is set to an existing directory. The package backend is for this capture/sync test; historical PDF source files and evidence assets are omitted. PDF export dependencies are outside this mobile handover.

## Checks completed and remaining work

On 12 October 2026: debug APK assembled, Android lint completed with zero errors and one JavaScript-enabled WebView warning (JavaScript is required for this UI); 19 focused tests passed; browser test passed online login, airplane-mode reload, persisted draft/photo, ordered finding/action/reply sync, evidence downloads, idempotent retries respondent write denial, shared web/mobile session authentication and company isolation. These checks used synthetic local records, not production writes.

Before field rollout, the programmer should test the supplied APK on actual Android phones: first login/download; airplane mode and process restart; camera/gallery orientation and cancellation; GPS grant/deny; reconnect and webapp visibility for both finding and response photos; expired login; company-restricted account; revoked permission; concurrent edit; insufficient storage; and signed APK upgrade with pending data.

Known implementation limits to plan around:

- First sign-in/download must be online. App startup offline opens the last locally signed-in workspace. Logging out locks it until online login; cached data is not separately encrypted and is not remotely erasable offline.
- Mobile autosaved **device drafts** are distinct from the webapp's server **Draft** status. Saving a mobile finding queues an Open record; editing/finalizing an existing server Draft remains a webapp function. Do not assume complete feature parity.
- Sync runs while the app is open/resumed (and every 30 seconds with pending work), not as Android background WorkManager jobs. Force-closing pauses uploads.
- Current refresh paginates server reads but downloads all permitted companies' findings/photos and redraws a full local register. Large estates need selected-company/year offline packs, delta cursors, paged local rendering and bounded photo storage before broad rollout. Refresh currently runs before and after queue uploads, which can delay uploads on slow connections.
- Same-section conflicts are preserved for explicit review; there is no automatic field-level merge. 413 and transport failures remain pending and require attention; photo removal/resizing and a durable resumable upload API are follow-on improvements.
- UI assets are bundled in the APK. Webapp deployments do not automatically replace those assets; rebuild and distribute a signed APK update for mobile UI changes. Keep API changes backward compatible.
- Native hardware camera/GPS and Android lifecycle behavior have **not** been verified on a physical phone in this handover. The included APK is a test build, not a signed production release.
