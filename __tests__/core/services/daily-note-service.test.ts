import { App, TFile } from "obsidian";

import { DailyNoteService } from "../../../src/core/services/daily-note-service";

// Mock moment to return consistent dates
jest.mock("../../../src/utils/moment", () => ({
  moment: () => ({
    format: (fmt: string) => {
      if (fmt === "YYYY-MM-DD") return "2026-01-19";
      if (fmt === "YYYY/MM/DD") return "2026/01/19";
      return "2026-01-19";
    },
  }),
}));

describe("DailyNoteService", () => {
  let mockApp: App;
  let service: DailyNoteService;

  beforeEach(() => {
    mockApp = new App();
    service = new DailyNoteService(mockApp);
  });

  describe("getDailyNoteSettings", () => {
    it("should return null when no daily notes plugins are configured", () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = { plugins: {} };
      (mockApp as unknown as { internalPlugins: { plugins: Record<string, unknown> } }).internalPlugins = { plugins: {} };

      const result = service.getDailyNoteSettings();

      expect(result).toBeNull();
    });

    it("should return periodic notes settings when available", () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = {
        plugins: {
          "periodic-notes": {
            settings: {
              daily: {
                enabled: true,
                folder: "Journal",
                format: "YYYY-MM-DD",
                template: "templates/daily.md",
              },
            },
          },
        },
      };

      const result = service.getDailyNoteSettings();

      expect(result).toEqual({
        folder: "Journal",
        format: "YYYY-MM-DD",
        template: "templates/daily.md",
      });
    });

    it("should use default format when periodic notes has no format", () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = {
        plugins: {
          "periodic-notes": {
            settings: {
              daily: {
                enabled: true,
                folder: "Journal",
              },
            },
          },
        },
      };

      const result = service.getDailyNoteSettings();

      expect(result?.format).toBe("YYYY-MM-DD");
    });

    it("should return null when periodic notes daily is disabled", () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = {
        plugins: {
          "periodic-notes": {
            settings: {
              daily: {
                enabled: false,
              },
            },
          },
        },
      };
      (mockApp as unknown as { internalPlugins: { plugins: Record<string, unknown> } }).internalPlugins = { plugins: {} };

      const result = service.getDailyNoteSettings();

      expect(result).toBeNull();
    });

    it("should fall back to core daily notes when periodic notes not available", () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = { plugins: {} };
      (mockApp as unknown as { internalPlugins: { plugins: Record<string, { enabled: boolean; instance?: { options?: unknown } }> } }).internalPlugins = {
        plugins: {
          "daily-notes": {
            enabled: true,
            instance: {
              options: {
                folder: "Daily",
                format: "YYYY/MM/DD",
              },
            },
          },
        },
      };

      const result = service.getDailyNoteSettings();

      expect(result).toEqual({
        folder: "Daily",
        format: "YYYY/MM/DD",
        template: undefined,
      });
    });

    it("should return null when core daily notes is disabled", () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = { plugins: {} };
      (mockApp as unknown as { internalPlugins: { plugins: Record<string, { enabled: boolean }> } }).internalPlugins = {
        plugins: {
          "daily-notes": {
            enabled: false,
          },
        },
      };

      const result = service.getDailyNoteSettings();

      expect(result).toBeNull();
    });
  });

  describe("getTodayNotePath", () => {
    it("should return null when no daily notes configured", () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = { plugins: {} };
      (mockApp as unknown as { internalPlugins: { plugins: Record<string, unknown> } }).internalPlugins = { plugins: {} };

      const result = service.getTodayNotePath();

      expect(result).toBeNull();
    });

    it("should return correct path with folder", () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = {
        plugins: {
          "periodic-notes": {
            settings: {
              daily: {
                enabled: true,
                folder: "Journal",
                format: "YYYY-MM-DD",
              },
            },
          },
        },
      };

      const result = service.getTodayNotePath();

      expect(result).toBe("Journal/2026-01-19.md");
    });

    it("should return correct path without folder", () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = {
        plugins: {
          "periodic-notes": {
            settings: {
              daily: {
                enabled: true,
                folder: "",
                format: "YYYY-MM-DD",
              },
            },
          },
        },
      };

      const result = service.getTodayNotePath();

      expect(result).toBe("2026-01-19.md");
    });
  });

  describe("ensureDailyNoteExists", () => {
    beforeEach(() => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = {
        plugins: {
          "periodic-notes": {
            settings: {
              daily: {
                enabled: true,
                folder: "Journal",
                format: "YYYY-MM-DD",
              },
            },
          },
        },
      };
    });

    it("should return null when no daily notes configured", async () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = { plugins: {} };
      (mockApp as unknown as { internalPlugins: { plugins: Record<string, unknown> } }).internalPlugins = { plugins: {} };

      const result = await service.ensureDailyNoteExists(0);

      expect(result).toBeNull();
    });

    it("should return existing file if it exists", async () => {
      const existingFile = new TFile("Journal/2026-01-19.md");
      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(existingFile);

      const result = await service.ensureDailyNoteExists(0);

      expect(result).toBe(existingFile);
    });

    it("should create new file if it does not exist", async () => {
      const newFile = new TFile("Journal/2026-01-19.md");
      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);
      mockApp.vault.create = jest.fn().mockResolvedValue(newFile);
      mockApp.vault.createFolder = jest.fn().mockResolvedValue(undefined);

      const result = await service.ensureDailyNoteExists(0);

      expect(mockApp.vault.create).toHaveBeenCalledWith("Journal/2026-01-19.md", "");
      expect(result).toBe(newFile);
    });

    it("should create parent folders if needed", async () => {
      const newFile = new TFile("Journal/2026-01-19.md");
      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);
      mockApp.vault.create = jest.fn().mockResolvedValue(newFile);
      mockApp.vault.createFolder = jest.fn().mockResolvedValue(undefined);

      await service.ensureDailyNoteExists(0);

      expect(mockApp.vault.createFolder).toHaveBeenCalledWith("Journal");
    });

    it("should load template content if template exists", async () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = {
        plugins: {
          "periodic-notes": {
            settings: {
              daily: {
                enabled: true,
                folder: "Journal",
                format: "YYYY-MM-DD",
                template: "templates/daily.md",
              },
            },
          },
        },
      };

      const templateFile = new TFile("templates/daily.md");
      const newFile = new TFile("Journal/2026-01-19.md");

      mockApp.vault.getAbstractFileByPath = jest.fn().mockImplementation((path: string) => {
        if (path === "templates/daily.md") return templateFile;
        return null;
      });
      mockApp.vault.read = jest.fn().mockResolvedValue("# Daily Note\n\n## Tasks\n");
      mockApp.vault.create = jest.fn().mockResolvedValue(newFile);
      mockApp.vault.createFolder = jest.fn().mockResolvedValue(undefined);

      await service.ensureDailyNoteExists(0);

      expect(mockApp.vault.read).toHaveBeenCalledWith(templateFile);
      expect(mockApp.vault.create).toHaveBeenCalledWith("Journal/2026-01-19.md", "# Daily Note\n\n## Tasks\n");
    });

    it("should wait for templater delay", async () => {
      const newFile = new TFile("Journal/2026-01-19.md");
      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);
      mockApp.vault.create = jest.fn().mockResolvedValue(newFile);
      mockApp.vault.createFolder = jest.fn().mockResolvedValue(undefined);

      const startTime = Date.now();
      await service.ensureDailyNoteExists(50);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
    });
  });
});
