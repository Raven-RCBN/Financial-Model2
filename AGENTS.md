# Shared FM2 and Audit repository — deployment routing

As of 23 October 2026 both live applications run on Malaysia `76.13.218.53`.
Do not deploy either app to retired India `187.127.167.149` accounts/services.
Public digitalpalm.ai DNS still points to India forwarding; never use it to pick
the SSH deployment target. Preserve these forwarding routes and certificates.

Audit owner: Audit project/chat, source `standalone-audit/`; read
`standalone-audit/deploy/CURRENT-PRODUCTION.md` when present. FM2 owner: FM2
project/chat, read `deployments/fm2/CURRENT-PRODUCTION.md` when present.
This branch may contain only its owner's updated runbook: do not infer that the
other app should be deployed from here. Never restart the other app implicitly.

Audit `audit.agrinexus.ai` goes directly to Malaysia without an India fallback;
`audit.digitalpalm.ai` and `fm2.digitalpalm.ai` retain India forwarding.
Migration/activation are complete; historical first-install approval checkpoints
do not describe the current instance. Preserve active users/data/settings/secrets,
Audit's parallel startup reads and FM2's validated Advisory landing redirect.
Read the current app runbook before constructing a release. Git publication alone
is not production deployment. Never initialize users or restore old data as an update.

Application/database migrations must transfer directly server-to-server; never
relay data through the Mac. Docker binary helpers require `--log-driver none`.
Do not commit private keys, live databases, backups, environment or credentials.
Preserve unrelated work and use separate app deployment folders.
