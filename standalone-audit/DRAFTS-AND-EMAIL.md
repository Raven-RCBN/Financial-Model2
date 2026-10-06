# Drafts, notifications and deadlines

Data Entry starts in Draft. Blank observations and incomplete corrective actions may be saved. View & Report's Item status filter finds saved drafts; Edit draft reopens the same record with its photos. Only the creator (with create permission) or an administrator may edit/finalize it. A revision check rejects stale edits. Select Open and save to finalize: the observation and every included action's description, active directory assignee, email and valid due date are required. Creator-only users may still create observations for a corrective-action author to assign later, preserving existing role separation. Finalized observations cannot be reverted to Draft. Drafts are excluded from PDF exports.

At save, the browser attempts to capture the entry's current coordinates if none have already been recorded. Permission denial/unavailability falls back to Nigeria. The server resolves coordinates using the vendored timezone lookup and stores the zone. Finalized items retain that zone for deadlines; later replies cannot change it. Calendar deadlines are inclusive: updates lock at the next local midnight, including mobile requests received after the deadline. Follow-up dates do not extend the action deadline. Administrators can extend the actual deadline or record updates. Existing items use their stored coordinates, otherwise Africa/Lagos.

The Audit process runs its notification worker at startup, every minute, and after writes. New/finalized assignments, added actions and changed assignments/deadlines enroll in a durable notification revision. Draft saves do not enroll. Unchanged historical/imported/demo records are not retrospectively enrolled on deployment. Open actions notify the assignee of assignment, then both creator and assignee two calendar days before the action due date and on the due date. Duplicate recipient addresses are deduplicated. The two-day reminder catches up on the preceding day if the service was unavailable. Stale assignments and reminders are cancelled by closure, reassignment or changed deadlines; no emails are sent after the deadline. A reminder on a date already passed is not fabricated.

Delivery state persists privately in `data/audit-email-ledger.json`; failure retries after 15 minutes. Message IDs are stable for a notification/recipient. SMTP has no transactional exactly-once guarantee: an interrupted send after remote acceptance but before ledger persistence may be retried. Only one audit-web process should run the worker. Closed records and inactive assignees do not receive new notifications.

## Private server configuration

Set these only in `/home/deploy_audit/app.env` (0600), preserving existing variables, then restart **audit-web.service only** using the restricted helper:

- `AUDIT_SMTP_HOST`: SMTP hostname
- `AUDIT_SMTP_PORT`: 465 (SSL) or 587 (STARTTLS)
- `AUDIT_SMTP_SECURITY`: `ssl` or `starttls`; certificate validation is mandatory
- `AUDIT_SMTP_USERNAME`: authorized sending account
- `AUDIT_SMTP_PASSWORD`: current SMTP/app password
- `AUDIT_MAIL_FROM`: authorized sender address
- `AUDIT_ADMIN_EMAIL`: current administrator creator reminder recipient

Directory users' current active email addresses are used for creator reminders. Administrator reminders use AUDIT_ADMIN_EMAIL, so it may be changed later without editing historical records. No SMTP secret is returned to clients. SMTP passwords/configuration, delivery ledger and live runtime data must stay outside Git. No mail connector credentials are reused.

Admin status: authenticated `GET /api/projects/<project>/audit-entries?notifications=status`. Missing configuration is shown in Data Entry and Audit management; failed deliveries are reported by the status endpoint. Configuration presence alone does not prove delivery. Verify authenticated SMTP sending and recipient receipt before declaring live email complete.

Tests: `tests/audit-drafts-notifications.test.mjs`, `tests/audit-drafts-browser.mjs` (synthetic localhost only), existing workflow/sync/query-index/photo and navigation tests. Build with the standalone release builder to retain its isolated imports and atomic JSON writes.
