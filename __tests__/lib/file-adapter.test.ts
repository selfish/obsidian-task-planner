import { App, TFile } from "obsidian";
import { ObsidianFile } from "../../src/lib/file-adapter";

describe("ObsidianFile atomic writes", () => {
  it("delegates directly to Vault.process", async () => {
    const app = new App();
    const file = new TFile("Tasks.md");
    app.vault.process = jest.fn(async (_file: TFile, update: (content: string) => string) => update("latest"));
    const adapter = new ObsidianFile(app, file);

    await adapter.processContent((content) => `${content}\nchanged`);

    expect(app.vault.process).toHaveBeenCalledWith(file, expect.any(Function));
    expect((app.vault.process as jest.Mock).mock.results[0].value).resolves.toBe("latest\nchanged");
    expect(app.vault.modify).not.toHaveBeenCalled();
  });
});

describe("ObsidianFile folder matching", () => {
  it.each([
    ["Archive/Tasks.md", "///ARCHIVE///", true],
    ["Archive/Nested/Tasks.md", "/archive/nested/", true],
    ["Archive", "/archive/", true],
    ["Archive2/Tasks.md", "/archive/", false],
    ["Elsewhere/Archive/Tasks.md", "archive", false],
    ["Archive/Tasks.md", "", false],
    ["Archive/Tasks.md", "////", false],
    ["Archive/Tasks.md", "/", false],
    ["Archive//Nested/Tasks.md", "/archive//nested/", true],
    ["Archive/Nested/Tasks.md", "/archive//nested/", false],
    ["Archive/Tasks.md", " archive ", false],
    ["Ärchive/Tasks.md", "/ÄRCHIVE/", true],
    ["Archive/Tasks.md", "Archive\\", false],
  ])("matches %s against %s without changing boundaries", (path, folder, expected) => {
    expect(new ObsidianFile(new App(), new TFile(path)).isInFolder(folder)).toBe(expected);
  });

  it("handles large interior and boundary slash runs within a generous local budget", () => {
    const adapter = new ObsidianFile(new App(), new TFile("Archive/Tasks.md"));
    const folders = ["a" + "/".repeat(100_000) + "b", "/".repeat(100_000) + "ARCHIVE" + "/".repeat(100_000), "/".repeat(200_000)];
    const started = performance.now();
    expect(folders.map((folder) => adapter.isInFolder(folder))).toEqual([false, true, false]);
    // Availability regression, not a benchmark or whole-app performance claim.
    // Linear boundary scans take milliseconds; the old retrying regex takes seconds.
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it("requires a complete folder name", () => {
    const app = new App();

    expect(new ObsidianFile(app, new TFile("Archive/Tasks.md")).isInFolder("archive")).toBe(true);
    expect(new ObsidianFile(app, new TFile("Archive/Tasks.md")).isInFolder("Archive/")).toBe(true);
    expect(new ObsidianFile(app, new TFile("Archive2/Tasks.md")).isInFolder("archive")).toBe(false);
  });
});
