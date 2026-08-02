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
  it("requires a complete folder name", () => {
    const app = new App();

    expect(new ObsidianFile(app, new TFile("Archive/Tasks.md")).isInFolder("archive")).toBe(true);
    expect(new ObsidianFile(app, new TFile("Archive/Tasks.md")).isInFolder("Archive/")).toBe(true);
    expect(new ObsidianFile(app, new TFile("Archive2/Tasks.md")).isInFolder("archive")).toBe(false);
  });
});
