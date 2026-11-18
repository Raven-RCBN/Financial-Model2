// Standalone visibility: audit authors retain company-wide oversight.
export function assignedIssueScope(actor) {
  return actor.admin || actor.create || actor.recommend ? null : {email: String(actor.email || '').trim().toLowerCase()};
}
export function canViewIssue(actor, entry) {
  const scope = assignedIssueScope(actor);
  if (!scope) return true;
  if (!scope.email || entry.status === 'Draft') return false;
  return [entry.ownerEmail, entry.owner2Email, ...(entry.actions || []).map(a => a.email)]
    .some(email => String(email || '').trim().toLowerCase() === scope.email);
}
