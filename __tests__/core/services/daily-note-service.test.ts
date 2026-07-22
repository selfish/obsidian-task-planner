import { App, TFile, TFolder } from "obsidian";

import { DailyNoteService } from "../../../src/core/services/daily-note-service";
import { readDailyNoteSettings } from "../../../src/integrations/daily-notes";

jest.mock("../../../src/integrations/daily-notes", () => ({
  readDailyNoteSettings: jest.fn(),
}));

jest.mock("../../../src/utils/moment", () => ({
  moment: () => ({
    format: (format: string) => {
      if (format === "YYYY/MM/DD") return "2026/01/19";
      return "2026-01-19";
    },
  }),
}));

const mockReadSettings = readDailyNoteSettings as jest.MockedFunction<typeof readDailyNoteSettings>;
const settings = { folder: "Journal", format: "YYYY-MM-DD", template: undefined };

function file(path: string): TFile {
  return { path } as TFile;
}

function folder(path: string): TFolder {
  return { path } as TFolder;
}

describe("DailyNoteService", () => {
  let app: App;
  let service: DailyNoteService;

  beforeEach(() => {
    jest.clearAllMocks();
    app = new App();
    service = new DailyNoteService(app);
    mockReadSettings.mockReturnValue(settings);
    (app.vault.getFileByPath as jest.Mock).mockReturnValue(null);
    (app.vault.getFolderByPath as jest.Mock).mockReturnValue(null);
    (app.vault.create as jest.Mock).mockImplementation(async (path: string) => file(path));
    (app.vault.read as jest.Mock).mockResolvedValue("# Daily template");
  });

  describe("getDailyNoteSettings", () => {
    it("delegates provider compatibility to the ecosystem adapter", () => {
      expect(service.getDailyNoteSettings()).toEqual(settings);
      expect(mockReadSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe("getTodayNotePath", () => {
    it("returns null when daily notes are unavailable", () => {
      mockReadSettings.mockReturnValue(null);

      expect(service.getTodayNotePath()).toBeNull();
    });

    it("returns the configured folder and format", () => {
      mockReadSettings.mockReturnValue({ ...settings, format: "YYYY/MM/DD" });

      expect(service.getTodayNotePath()).toBe("Journal/2026/01/19.md");
    });

    it("supports daily notes at the vault root", () => {
      mockReadSettings.mockReturnValue({ ...settings, folder: "" });

      expect(service.getTodayNotePath()).toBe("2026-01-19.md");
    });
  });

  describe("ensureDailyNoteExists", () => {
    it("returns null when daily notes are unavailable", async () => {
      mockReadSettings.mockReturnValue(null);

      await expect(service.ensureDailyNoteExists(0)).resolves.toBeNull();
      expect(app.vault.create).not.toHaveBeenCalled();
    });

    it("returns an existing daily note", async () => {
      const existing = file("Journal/2026-01-19.md");
      (app.vault.getFileByPath as jest.Mock).mockReturnValue(existing);

      await expect(service.ensureDailyNoteExists(0)).resolves.toBe(existing);
      expect(app.vault.create).not.toHaveBeenCalled();
    });

    it("creates a missing daily note and parent folder through public Vault APIs", async () => {
      const created = await service.ensureDailyNoteExists(0);

      expect(app.vault.getFolderByPath).toHaveBeenCalledWith("Journal");
      expect(app.vault.createFolder).toHaveBeenCalledWith("Journal");
      expect(app.vault.create).toHaveBeenCalledWith("Journal/2026-01-19.md", "");
      expect(created?.path).toBe("Journal/2026-01-19.md");
    });

    it("does not recreate an existing parent folder", async () => {
      (app.vault.getFolderByPath as jest.Mock).mockReturnValue(folder("Journal"));

      await service.ensureDailyNoteExists(0);

      expect(app.vault.createFolder).not.toHaveBeenCalled();
    });

    it("loads a configured template through the typed file lookup", async () => {
      const template = file("Templates/Daily.md");
      mockReadSettings.mockReturnValue({ ...settings, template: template.path });
      (app.vault.getFileByPath as jest.Mock).mockImplementation((path: string) => (path === template.path ? template : null));

      await service.ensureDailyNoteExists(0);

      expect(app.vault.read).toHaveBeenCalledWith(template);
      expect(app.vault.create).toHaveBeenCalledWith("Journal/2026-01-19.md", "# Daily template");
    });

    it("creates root daily notes without creating folders", async () => {
      mockReadSettings.mockReturnValue({ ...settings, folder: "" });

      await service.ensureDailyNoteExists(0);

      expect(app.vault.createFolder).not.toHaveBeenCalled();
      expect(app.vault.create).toHaveBeenCalledWith("2026-01-19.md", "");
    });

    it("honors the configured Templater delay", async () => {
      const started = Date.now();

      await service.ensureDailyNoteExists(1);

      expect(Date.now() - started).toBeGreaterThanOrEqual(1);
    });
  });
});
