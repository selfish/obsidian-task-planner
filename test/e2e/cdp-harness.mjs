import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import CDP from "chrome-remote-interface";
import ObsidianLauncher from "obsidian-launcher";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CACHE = path.join(ROOT, ".obsidian-cache");
const ARTIFACTS = path.join(ROOT, "artifacts/e2e");
const appVersion = process.env.OBSIDIAN_VERSION ?? "1.13.6";
const installerVersion = process.env.OBSIDIAN_INSTALLER_VERSION ?? "1.5.8";

let client;
let processResult;
let stderr = "";

function errorText(details) {
  return details?.exception?.description ?? details?.text ?? "Obsidian evaluation failed";
}

async function evaluate(expression) {
  const result = await client.Runtime.evaluate({ expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(errorText(result.exceptionDetails));
  return result.result.value;
}

function call(fn, args, obsidian = false) {
  const params = JSON.stringify(args);
  const globals = obsidian ? "window.taskPlannerE2e(), " : "";
  return evaluate(`(async () => await (${fn.toString()})(${globals}...${params}))()`);
}

export const browser = {
  execute: (fn, ...args) => call(fn, args),
  executeObsidian: (fn, ...args) => call(fn, args, true),
  async executeObsidianCommand(id) {
    if (!(await this.executeObsidian(({ app }, command) => app.commands.executeCommandById(command), id))) {
      throw new Error(`Obsidian command ${id} not found or failed`);
    }
  },
  async waitUntil(predicate, { timeout = 20000, timeoutMsg = "Condition timed out" } = {}) {
    const deadline = Date.now() + timeout;
    let lastError;
    while (Date.now() < deadline) {
      try {
        if (await predicate()) return;
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`${timeoutMsg}${lastError ? `: ${lastError.message}` : ""}`);
  },
  sendCommand: (method, params) => client.send(method, params),
  async saveScreenshot(file) {
    const { data } = await client.Page.captureScreenshot({ format: "png" });
    fs.writeFileSync(file, Buffer.from(data, "base64"));
  },
};

export const obsidianPage = {
  getVaultPath: () => processResult.vault,
  read: (file) => fs.promises.readFile(path.join(processResult.vault, file), "utf8"),
};

function devToolsPort(proc) {
  return new Promise((resolve, reject) => {
    const onData = (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-20000);
      const port = stderr.match(/ws:\/\/[\w.]+?:(\d+)/)?.[1];
      if (port) resolve(Number(port));
    };
    proc.stderr.on("data", onData);
    proc.stdout.on("data", onData);
    proc.once("exit", (code) => reject(new Error(`Obsidian exited before opening DevTools (code ${code})\n${stderr}`)));
    setTimeout(() => reject(new Error(`Timed out waiting for Obsidian DevTools\n${stderr}`)), 20000).unref();
  });
}

export async function startObsidian() {
  stderr = "";
  const launcher = new ObsidianLauncher({
    cacheDir: CACHE,
    versionsUrl: pathToFileURL(path.join(CACHE, "pinned-versions.json")).href,
  });
  try {
    processResult = await launcher.launch({
      appVersion,
      installerVersion,
      vault: path.join(ROOT, "test/e2e/vault"),
      copy: true,
      plugins: [ROOT, path.join(ROOT, "test/e2e/helper-plugin")],
      args: ["--remote-debugging-port=0", "--test-type=webdriver"],
      spawnOptions: { stdio: ["ignore", "pipe", "pipe"] },
    });
    client = await CDP({ port: await devToolsPort(processResult.proc) });
    await Promise.all([client.Runtime.enable(), client.Page.enable()]);
    await browser.waitUntil(() => browser.execute(() => Boolean(window.taskPlannerE2e)), {
      timeout: 15000,
      timeoutMsg: "Task Planner E2E helper did not load",
    });
    await browser.executeObsidian(({ app }) => new Promise((resolve) => app.workspace.onLayoutReady(resolve)));
  } catch (error) {
    const errors = [error];
    try {
      await captureFailure();
    } catch (captureError) {
      errors.push(captureError);
    }
    try {
      await stopObsidian();
    } catch (cleanupError) {
      errors.push(cleanupError);
    }
    throw errors.length === 1 ? error : new AggregateError(errors, "Obsidian setup and cleanup failed");
  }
}

export async function captureFailure() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACTS, "process-output.txt"), stderr);
  if (!processResult?.vault) return;
  try {
    fs.cpSync(processResult.vault, path.join(ARTIFACTS, "vault"), { recursive: true });
  } catch (error) {
    fs.writeFileSync(path.join(ARTIFACTS, "vault-copy-error.txt"), String(error));
  }
  try {
    await browser.saveScreenshot(path.join(ARTIFACTS, "failure.png"));
  } catch (error) {
    fs.writeFileSync(path.join(ARTIFACTS, "screenshot-error.txt"), String(error));
  }
}

export async function stopObsidian() {
  const result = processResult;
  const cdp = client;
  processResult = undefined;
  client = undefined;
  if (!result && !cdp) return;

  const errors = [];
  try {
    await cdp?.close();
  } catch (error) {
    errors.push(error);
  }

  const proc = result?.proc;
  try {
    if (proc && proc.exitCode === null && proc.signalCode === null) {
      const exited = new Promise((resolve) => proc.once("exit", resolve));
      proc.kill("SIGTERM");
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
      if (proc.exitCode === null && proc.signalCode === null) {
        if (!proc.kill("SIGKILL")) throw new Error("Could not terminate Obsidian");
        const killed = await Promise.race([exited.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 5000))]);
        if (!killed) throw new Error("Timed out terminating Obsidian");
      }
    }
  } catch (error) {
    errors.push(error);
  }

  const cleanup = await Promise.allSettled([result?.configDir, result?.vault].filter(Boolean).map((directory) => fs.promises.rm(directory, { recursive: true, force: true })));
  errors.push(...cleanup.filter(({ status }) => status === "rejected").map(({ reason }) => reason));
  if (errors.length) throw new AggregateError(errors, "Could not clean up Obsidian E2E runtime");
}
