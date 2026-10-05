# Deployment ownership

This Git repository contains two applications. They have separate deployment directories, release artifacts, server accounts, data and services. There is no combined deployment command.

| Application | Source | Deployment instructions | Runtime |
| --- | --- | --- | --- |
| FM2 | Root `server.mjs`, `app.js`, `index.html`, `public/fm/` and financial modules | `deployments/fm2/README.md` | `fm2.digitalpalm.ai`, `deploy_fm2`, `fm2.service` |
| Audit | `standalone-audit/`; shared Audit code/assets in `audit/`; offline web and APK in `mobile/` | `standalone-audit/deploy/RUNBOOK.md` | `audit.digitalpalm.ai`, `deploy_audit`, `audit-web.service` |

`node standalone-audit/scripts/build-release.mjs NEW_DIRECTORY` produces an independent Audit release. It excludes the FM2 server, finance database and FM2 deployment templates. The Audit installer only restarts Audit. Do not deploy the whole repository as either application or use blanket rsync --delete over runtime data.

The applications still share some source modules during migration; separate folders do not mean separate Git repositories. Use independent local checkouts/branches, review shared `audit/` and `mobile/` changes, and coordinate compatibility until FM2 Audit is retired. No automatic push-to-production workflow is configured here.

Audit history: `standalone-audit/HANDOVER.md`. FM2 deployment and final old-endpoint shutdown remain in the FM2 chat. Never commit live credentials, user files, data exports or APK signing keys.
