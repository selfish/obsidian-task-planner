import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";

const appVersion = process.env.OBSIDIAN_VERSION ?? "1.12.7";
const installerVersion = process.env.OBSIDIAN_INSTALLER_VERSION ?? "1.5.8";

export const config = {
  runner: "local",
  framework: "mocha",
  specs: ["./test/e2e/**/*.e2e.mjs"],
  maxInstances: 1,
  capabilities: [
    {
      browserName: "obsidian",
      browserVersion: appVersion,
      "wdio:obsidianOptions": {
        appVersion,
        installerVersion,
        plugins: ["."],
        vault: "./test/e2e/vault",
        copy: true,
      },
    },
  ],
  services: [["obsidian", { versionsUrl: pathToFileURL(path.resolve(".obsidian-cache/pinned-versions.json")).href }]],
  reporters: ["spec"],
  outputDir: path.resolve("artifacts/e2e/logs"),
  cacheDir: path.resolve(".obsidian-cache"),
  mochaOpts: { ui: "bdd", timeout: 120000 },
  waitforInterval: 100,
  waitforTimeout: 20000,
  logLevel: "error",
  injectGlobals: true,
  afterTest: async (_test, _context, result) => {
    if (result.passed) return;

    const artifactDir = path.resolve("artifacts/e2e");
    fs.mkdirSync(artifactDir, { recursive: true });
    try {
      fs.cpSync(obsidianPage.getVaultPath(), path.join(artifactDir, "vault"), { recursive: true });
    } catch (error) {
      fs.writeFileSync(path.join(artifactDir, "vault-copy-error.txt"), String(error));
    }
    try {
      await browser.saveScreenshot(path.join(artifactDir, "failure.png"));
    } catch (error) {
      fs.writeFileSync(path.join(artifactDir, "screenshot-error.txt"), String(error));
    }
  },
};
