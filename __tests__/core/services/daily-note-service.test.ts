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

    it("should return null when plugins property is undefined", () => {
      // Tests line 43: this.app.plugins?.plugins branch when plugins is undefined
      (mockApp as unknown as { plugins: undefined }).plugins = undefined;
      (mockApp as unknown as { internalPlugins: { plugins: Record<string, unknown> } }).internalPlugins = { plugins: {} };

      const result = service.getDailyNoteSettings();

      expect(result).toBeNull();
    });

    it("should return null when internalPlugins property is undefined", () => {
      // Tests line 66: this.app.internalPlugins?.plugins branch when internalPlugins is undefined
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = { plugins: {} };
      (mockApp as unknown as { internalPlugins: undefined }).internalPlugins = undefined;

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

    it("should handle periodic notes plugin with no settings", () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = {
        plugins: {
          "periodic-notes": {
            // No settings property
          },
        },
      };

      const result = service.getDailyNoteSettings();

      // Should return default values when settings is undefined
      expect(result).toEqual({
        folder: "",
        format: "YYYY-MM-DD",
        template: undefined,
      });
    });

    it("should handle periodic notes plugin with empty settings", () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = {
        plugins: {
          "periodic-notes": {
            settings: {},
          },
        },
      };

      const result = service.getDailyNoteSettings();

      // Should return default values
      expect(result).toEqual({
        folder: "",
        format: "YYYY-MM-DD",
        template: undefined,
      });
    });

    it("should handle core daily notes with no instance options", () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = { plugins: {} };
      (mockApp as unknown as { internalPlugins: { plugins: Record<string, { enabled: boolean; instance?: { options?: unknown } }> } }).internalPlugins = {
        plugins: {
          "daily-notes": {
            enabled: true,
            instance: {},
          },
        },
      };

      const result = service.getDailyNoteSettings();

      expect(result).toEqual({
        folder: "",
        format: "YYYY-MM-DD",
        template: undefined,
      });
    });

    it("should handle core daily notes with no instance", () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = { plugins: {} };
      (mockApp as unknown as { internalPlugins: { plugins: Record<string, { enabled: boolean }> } }).internalPlugins = {
        plugins: {
          "daily-notes": {
            enabled: true,
          },
        },
      };

      const result = service.getDailyNoteSettings();

      expect(result).toEqual({
        folder: "",
        format: "YYYY-MM-DD",
        template: undefined,
      });
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

    it("should skip delay when templaterDelay is 0", async () => {
      const newFile = new TFile("Journal/2026-01-19.md");
      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);
      mockApp.vault.create = jest.fn().mockResolvedValue(newFile);
      mockApp.vault.createFolder = jest.fn().mockResolvedValue(undefined);

      const startTime = Date.now();
      await service.ensureDailyNoteExists(0);
      const elapsed = Date.now() - startTime;

      // Should complete almost immediately
      expect(elapsed).toBeLessThan(20);
    });

    it("should handle template path that is not a file", async () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = {
        plugins: {
          "periodic-notes": {
            settings: {
              daily: {
                enabled: true,
                folder: "Journal",
                format: "YYYY-MM-DD",
                template: "templates/daily",
              },
            },
          },
        },
      };

      const newFile = new TFile("Journal/2026-01-19.md");

      // Return a non-TFile for template path (like a folder)
      mockApp.vault.getAbstractFileByPath = jest.fn().mockImplementation((path: string) => {
        if (path === "templates/daily") return { path: "templates/daily" }; // Not a TFile
        return null;
      });
      mockApp.vault.create = jest.fn().mockResolvedValue(newFile);
      mockApp.vault.createFolder = jest.fn().mockResolvedValue(undefined);

      await service.ensureDailyNoteExists(0);

      // Should create with empty content since template wasn't a valid file
      expect(mockApp.vault.create).toHaveBeenCalledWith("Journal/2026-01-19.md", "");
    });

    it("should create file at root without creating folders", async () => {
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

      const newFile = new TFile("2026-01-19.md");
      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);
      mockApp.vault.create = jest.fn().mockResolvedValue(newFile);
      mockApp.vault.createFolder = jest.fn();

      await service.ensureDailyNoteExists(0);

      // Should not create any folders
      expect(mockApp.vault.createFolder).not.toHaveBeenCalled();
      expect(mockApp.vault.create).toHaveBeenCalledWith("2026-01-19.md", "");
    });

    it("should not create folder if it already exists", async () => {
      const newFile = new TFile("Journal/2026-01-19.md");
      mockApp.vault.getAbstractFileByPath = jest.fn().mockImplementation((path: string) => {
        if (path === "Journal") return { path: "Journal" }; // Folder exists
        return null; // File doesn't exist
      });
      mockApp.vault.create = jest.fn().mockResolvedValue(newFile);
      mockApp.vault.createFolder = jest.fn();

      await service.ensureDailyNoteExists(0);

      // Should not try to create existing folder
      expect(mockApp.vault.createFolder).not.toHaveBeenCalled();
    });

    it("should handle settings becoming null after path resolution", async () => {
      // Tests line 112: settings?.template where settings is null
      // First call to getDailyNoteSettings (via getTodayNotePath) returns valid settings
      // Second call to getDailyNoteSettings (at line 108) returns null
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

      const newFile = new TFile("Journal/2026-01-19.md");
      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);
      mockApp.vault.create = jest.fn().mockResolvedValue(newFile);
      mockApp.vault.createFolder = jest.fn().mockResolvedValue(undefined);

      // Spy on getDailyNoteSettings to return null on second call
      let callCount = 0;
      jest.spyOn(service, "getDailyNoteSettings").mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            folder: "Journal",
            format: "YYYY-MM-DD",
            template: undefined,
          };
        }
        // Second call returns null to test settings?.template branch
        return null;
      });

      await service.ensureDailyNoteExists(0);

      // Should create file with empty content since settings is null on second call
      expect(mockApp.vault.create).toHaveBeenCalledWith("Journal/2026-01-19.md", "");
    });
  });

  describe("error handling", () => {
    it("should handle exception in periodic notes settings gracefully", () => {
      // Set up plugins to throw when accessed
      Object.defineProperty(mockApp, "plugins", {
        get: () => {
          throw new Error("Plugin access error");
        },
        configurable: true,
      });
      (mockApp as unknown as { internalPlugins: { plugins: Record<string, unknown> } }).internalPlugins = { plugins: {} };

      const result = service.getDailyNoteSettings();

      expect(result).toBeNull();
    });

    it("should handle exception in core daily notes settings gracefully", () => {
      (mockApp as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins = { plugins: {} };
      Object.defineProperty(mockApp, "internalPlugins", {
        get: () => {
          throw new Error("Internal plugin access error");
        },
        configurable: true,
      });

      const result = service.getDailyNoteSettings();

      expect(result).toBeNull();
    });
  });
});
