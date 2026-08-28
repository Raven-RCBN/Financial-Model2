import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("redirects the root route to the financial model tester", async () => {
  const response = await render();
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "/fm/index.html");
});

test("ships the static financial model app and seeded payload", async () => {
  const [index, app, page, layout, packageJson, seed] = await Promise.all([
    readFile(new URL("../public/fm/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/fm/app.js", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../public/fm/project-data.json", import.meta.url), "utf8"),
  ]);

  assert.match(index, /Plantation Financial Model/);
  assert.match(index, /\.\/app\.js\?v=24/);
  assert.match(app, /LOCAL_PROJECT_STORAGE_KEY/);
  assert.match(app, /\.\/project-data\.json/);
  assert.match(seed, /Octavus Plantation Ltd/);
  assert.match(seed, /project_opsl_15000ha_development/);
  assert.match(packageJson, /"react-loading-skeleton": "3\.5\.0"/);
  assert.match(page, /redirect\("\/fm\/index\.html"\)/);
  assert.match(layout, /title:\s*"Financial Model 2"/);
  assert.doesNotMatch(page, /SkeletonPreview/);
  assert.doesNotMatch(layout, /Starter Project/);

  await assert.rejects(
    access(new URL("public/_sites-preview", templateRoot)),
  );
});
