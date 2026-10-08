# Company settings and directory access

Audit management provides Add company and a company selector. Each company has its own project/estate name, report years, departments and audit areas. Report metadata is saved by company and year. Saving one company preserves all other profiles and years. Existing company names are immutable to preserve record references; adding another company does not move existing findings.

Legacy setup is presented as a separate profile for each existing company. The primary company retains its prior report metadata. Other companies retain the old shared dropdown choices until edited, but do not inherit the primary company's location, dates or year-specific titles. The first company-settings save materializes these profiles; no findings or credentials are migrated. Issued PDF baselines remain unchanged; generated reports use the selected company's saved metadata.

Directory users can have All companies (including companies added later) or Selected companies. Existing users without a scope retain All companies; the administrator always has all-company access. Company access does not grant new creator, author or respondent roles. Only active respondents assigned to the selected company, or to All companies, appear in responsible-person dropdowns. Saving a finalized assignment validates this server-side as well.

Standalone APIs enforce company access for listings, finding/action/reply writes, draft company changes, mobile sync, reports and evidence. Scope is read from the current directory on each request. Cached offline data already downloaded to a device cannot be remotely erased while the device is offline. Reconnect and refresh after directory/settings changes.

Shared Audit permission exports remain backward-compatible: FM2 callers that omit the optional company validation retain their existing behavior. Audit deployment includes the updated shared file only in the standalone release; no FM2 service changes are required.

Validation: audit-company-config.test.mjs and audit-companies-browser.mjs (synthetic localhost fixture only), plus existing workflow, notifications, query-index and mobile/browser suites. Browser coverage includes creating two companies, editing multiple report years, replacing the default year, distinct dropdowns, selected-company directory saves, all-company assignees, mobile-width layout, assignment rejection and cross-company API/PDF/media denial.

## Delegated company setup

Administrators can grant Company setup independently of creator, author and respondent roles. Active users with this permission see a dedicated Company setup screen; the user directory, password resets and role management remain administrator-only and their API writes return403. Company setup updates are limited to the user’s company scope. Adding a company requires All companies access. Existing clients that omit the setup flag on a directory save preserve it; explicitly clearing the checkbox revokes it.

The administrator directory is a keyboard-focusable scrolling region capped at55vh/520px, with sticky column headings. Editing controls stay outside the scroll region.
