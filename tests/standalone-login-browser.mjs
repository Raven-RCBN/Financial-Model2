// Run only against an isolated synthetic fixture, never production.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.STANDALONE_TEST_URL;
if (!base || !['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) {
  throw new Error('Supply a localhost STANDALONE_TEST_URL with synthetic data.');
}
const api = '/api/projects/project_opsl_15000ha_development/';
const password = 'Synthetic-Login-Test-2026';
const adminPassword = fs.readFileSync(process.env.STANDALONE_TEST_ADMIN_FILE, 'utf8').match(/Initial password: (.+)/)[1];
const browser = await chromium.launch({channel: 'chrome', headless: true});
try {
  const admin = await browser.newContext();
  const page = await admin.newPage();
  await page.goto(base + '/login');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({width, height: 900});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.getByRole('button', {name: 'Sign in', exact: true}).isVisible(), true);
  }
  await page.setViewportSize({width: 1440, height: 1000});
  if (process.env.LOGIN_SCREENSHOT) await page.screenshot({path: process.env.LOGIN_SCREENSHOT, fullPage: true});
  await page.getByLabel('Username', {exact: true}).fill('admin');
  await page.getByLabel('Password', {exact: true}).fill(adminPassword);
  await page.getByRole('button', {name: 'Sign in', exact: true}).click();
  await page.locator('#auditFinding').waitFor();
  assert.equal(await page.locator('#adminMenu').isVisible(), true);
  const access = await (await admin.request.get(base + api + 'audit-access')).json();
  for (const key of ['admin', 'create', 'recommend', 'respond']) assert.equal(access.identity[key], true);
  const roles = [
    ['creator', true, false, false], ['author', false, true, false],
    ['respondent', false, false, true], ['allroles', true, true, true],
    ['noaccess', false, false, false],
  ];
  const users = roles.map(([name, create, recommend, respond]) => ({id: 'login-test-' + name, name: 'login-test-' + name, email: name + '@example.test', status: 'Active', password, auditPermissions: {create, recommend, respond}}));
  users.push({...users[0], id: 'login-test-inactive', name: 'login-test-inactive', status: 'Inactive'});
  const saved = await admin.request.put(base + api + 'audit-access', {data: {users: [...access.users.filter(u => !u.name.startsWith('login-test-')), ...users]}});
  assert.equal(saved.status(), 200);
  for (const [name, create, recommend, respond] of roles) {
    const context = await browser.newContext();
    const login = await context.request.post(base + '/login', {form: {userid: 'login-test-' + name, password}, maxRedirects: 0});
    assert.equal(login.status(), 303, name);
    const role = await (await context.request.get(base + api + 'audit-access')).json();
    assert.deepEqual({admin: role.identity.admin, create: role.identity.create, recommend: role.identity.recommend, respond: role.identity.respond}, {admin: false, create, recommend, respond}, name);
    assert.deepEqual(role.users, []);
    assert.equal(JSON.stringify(role).includes('credential'), false);
    for (const route of ['audit-access', 'audit-settings', 'audit-branding']) assert.equal((await context.request.put(base + api + route, {data: {}})).status(), 403, name + ': ' + route);
    await context.request.get(base + '/logout');
    assert.equal((await context.request.get(base + '/api/session')).status(), 401);
    await context.close();
  }
  const signedOut = await browser.newContext();
  for (const [userid, candidate] of [['login-test-inactive', password], ['admin', 'incorrect-password'], ['missing-user', password]]) {
    const response = await signedOut.request.post(base + '/login', {form: {userid, password: candidate}, maxRedirects: 0});
    assert.equal(response.status(), 401);
    assert.match(await response.text(), /role="alert"/);
    assert.equal((await signedOut.request.get(base + '/api/session')).status(), 401);
  }
  assert.equal((await admin.request.put(base + api + 'audit-access', {data: {users: access.users}})).status(), 200);
  console.log('PASS: responsive login; admin directory management and full role access; every role combination; restricted management; inactive/invalid login rejection; logout.');
} finally {
  await browser.close();
}
