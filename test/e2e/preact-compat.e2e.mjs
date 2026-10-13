import assert from "node:assert/strict";
import path from "node:path";
import { build } from "esbuild";

import { browser, captureFailure, startObsidian, stopObsidian } from "./cdp-harness.mjs";

describe("production Preact compatibility in the real host", function () {
  before(async () => {
    const result = await build({
      entryPoints: [path.join(import.meta.dirname, "preact-compat-probe.jsx")],
      bundle: true,
      write: false,
      format: "iife",
      globalName: "taskPlannerCompatProbe",
      target: "es2018",
      minify: true,
      define: { "process.env.NODE_ENV": '"production"' },
      alias: { react: "preact/compat", "react-dom/client": "preact/compat/client" },
    });
    await startObsidian();
    await browser.execute(source => {
      window.taskPlannerCompatProbe = new Function(`${source}; return taskPlannerCompatProbe;`)();
    }, result.outputFiles[0].text);
  });
  afterEach(async function () {
    if (this.currentTest?.state === "failed") await captureFailure();
  });
  after(async () => {
    try {
      await browser.execute(() => { delete window.taskPlannerCompatProbe; });
    } finally {
      await stopObsidian();
    }
  });

  it("keeps shared event listeners independent across updates and unmount", async function () {
    assert.deepEqual(await browser.execute(() => window.taskPlannerCompatProbe.eventProbe()), {
      first: ["outer"],
      second: ["inner", "outer"],
      replaced: ["inner", "outer"],
      afterUnmount: [],
    });
  });

  it("cleans up each shared callback ref once across removal, remount and unmount", async function () {
    assert.deepEqual(await browser.execute(() => window.taskPlannerCompatProbe.refProbe()), {
      mounted: ["attach a", "attach b"],
      removed: ["cleanup a"],
      remounted: ["attach a"],
      unmounted: ["cleanup a", "cleanup b"],
      repeatedUnmount: [],
    });
  });
});
