import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

test("server-renders the CBody framework site", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>CBody — DOM-shaped authoring, canvas-native rendering<\/title>/i,
  );
  assert.match(html, /Write the web/);
  assert.match(html, /Live playground/);
  assert.match(html, /ECS internals/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("uses a standards-compliant internal custom element name", async () => {
  const runtime = await readFile(
    new URL("../app/canvas-ecs.ts", import.meta.url),
    "utf8",
  );

  assert.match(runtime, /customElements\.define\("c-body", CanvasBodyElement\)/);
  assert.doesNotMatch(runtime, /customElements\.define\("cbody"/);
});

test("includes host suspension and ECS viewport culling", async () => {
  const runtime = await readFile(
    new URL("../app/canvas-ecs.ts", import.meta.url),
    "utf8",
  );

  assert.match(runtime, /class VisibilitySystem/);
  assert.match(runtime, /new IntersectionObserver/);
  assert.match(runtime, /subtreeInViewport/);
  assert.match(runtime, /rendered: stats\.rendered/);
  assert.match(runtime, /culled: stats\.culled/);
});
