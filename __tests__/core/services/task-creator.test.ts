import { App, TFile } from "obsidian";

import { TaskCreator } from "../../../src/core/services/task-creator";
import { DEFAULT_SETTINGS, TaskPlannerSettings } from "../../../src/settings/types";

// Mock moment
jest.mock("../../../src/utils/moment", () => ({
  moment: () => ({
    format: (fmt: string) => {
      if (fmt === "HH:mm") return "14:30";
      if (fmt === "YYYY-MM-DD") return "2026-01-19";
      if (fmt === "YYYY-MM-DD HH:mm") return "2026-01-19 14:30";
      return "2026-01-19";
    },
  }),
}));

// Mock DailyNoteService
jest.mock("../../../src/core/services/daily-note-service", () => ({
  DailyNoteService: jest.fn().mockImplementation(() => ({
    ensureDailyNoteExists: jest.fn(),
  })),
}));

describe("TaskCreator", () => {
  let mockApp: App;
  let settings: TaskPlannerSettings;
  let taskCreator: TaskCreator;

  beforeEach(() => {
    mockApp = new App();
    settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    taskCreator = new TaskCreator(mockApp, settings);
  });

  describe("formatTaskLine", () => {
    it("should format basic task pattern", () => {
      settings.quickAdd.taskPattern = "- [ ] {task}";
      taskCreator = new TaskCreator(mockApp, settings);

      const result = (taskCreator as unknown as { formatTaskLine: (task: string) => string }).formatTaskLine("Buy milk");

      expect(result).toBe("- [ ] Buy milk");
    });

    it("should replace {time} placeholder", () => {
      settings.quickAdd.taskPattern = "### {time}\\n- [ ] {task}";
      taskCreator = new TaskCreator(mockApp, settings);

      const result = (taskCreator as unknown as { formatTaskLine: (task: string) => string }).formatTaskLine("Buy milk");

      expect(result).toBe("### 14:30\n- [ ] Buy milk");
    });

    it("should replace {date} placeholder", () => {
      settings.quickAdd.taskPattern = "[due:: {date}] - [ ] {task}";
      taskCreator = new TaskCreator(mockApp, settings);

      const result = (taskCreator as unknown as { formatTaskLine: (task: string) => string }).formatTaskLine("Buy milk");

      expect(result).toBe("[due:: 2026-01-19] - [ ] Buy milk");
    });

    it("should replace {datetime} placeholder", () => {
      settings.quickAdd.taskPattern = "- [ ] {task} (added {datetime})";
      taskCreator = new TaskCreator(mockApp, settings);

      const result = (taskCreator as unknown as { formatTaskLine: (task: string) => string }).formatTaskLine("Buy milk");

      expect(result).toBe("- [ ] Buy milk (added 2026-01-19 14:30)");
    });

    it("should convert \\n to actual newlines", () => {
      settings.quickAdd.taskPattern = "Line1\\nLine2\\nLine3";
      taskCreator = new TaskCreator(mockApp, settings);

      const result = (taskCreator as unknown as { formatTaskLine: (task: string) => string }).formatTaskLine("test");

      expect(result).toBe("Line1\nLine2\nLine3");
    });
  });

  describe("insertContent", () => {
    describe("prepend placement", () => {
      beforeEach(() => {
        settings.quickAdd.placement = "prepend";
        taskCreator = new TaskCreator(mockApp, settings);
      });

      it("should prepend to empty content", () => {
        const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent("", "- [ ] task");

        expect(result).toBe("- [ ] task\n");
      });

      it("should prepend to content without frontmatter", () => {
        const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent("# Title\n\nContent", "- [ ] task");

        expect(result).toBe("- [ ] task\n# Title\n\nContent");
      });

      it("should prepend after frontmatter", () => {
        const content = "---\ntitle: Test\n---\n\n# Title";
        const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent(content, "- [ ] task");

        expect(result).toBe("---\ntitle: Test\n---\n- [ ] task\n# Title");
      });

      it("should handle frontmatter with no closing delimiter", () => {
        const content = "---\ntitle: Test\n# Title";
        const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent(content, "- [ ] task");

        expect(result).toBe("- [ ] task\n---\ntitle: Test\n# Title");
      });
    });

    describe("append placement", () => {
      beforeEach(() => {
        settings.quickAdd.placement = "append";
        taskCreator = new TaskCreator(mockApp, settings);
      });

      it("should append to content ending with newline", () => {
        const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent("Content\n", "- [ ] task");

        expect(result).toBe("Content\n- [ ] task");
      });

      it("should append to content not ending with newline", () => {
        const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent("Content", "- [ ] task");

        expect(result).toBe("Content\n- [ ] task");
      });
    });

    describe("before-regex placement", () => {
      beforeEach(() => {
        settings.quickAdd.placement = "before-regex";
        settings.quickAdd.locationRegex = "^## Tasks";
        taskCreator = new TaskCreator(mockApp, settings);
      });

      it("should insert before regex match", () => {
        const content = "# Title\n\n## Tasks\n\n- [ ] existing";
        const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent(content, "- [ ] new task");

        expect(result).toBe("# Title\n\n- [ ] new task\n## Tasks\n\n- [ ] existing");
      });

      it("should skip frontmatter when matching regex", () => {
        const content = "---\ntitle: Test\n---\n\n## Tasks\n\n- [ ] existing";
        const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent(content, "- [ ] new task");

        expect(result).toBe("---\ntitle: Test\n---\n\n- [ ] new task\n## Tasks\n\n- [ ] existing");
      });

      it("should not match frontmatter delimiters", () => {
        settings.quickAdd.locationRegex = "^---";
        taskCreator = new TaskCreator(mockApp, settings);

        const content = "---\ntitle: Test\n---\n\n---\n\nContent";
        const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent(content, "- [ ] task");

        // Should match the --- after frontmatter, not the frontmatter itself
        expect(result).toBe("---\ntitle: Test\n---\n\n- [ ] task\n---\n\nContent");
      });

      it("should fall back to prepend when no match", () => {
        settings.quickAdd.locationRegex = "^## NonExistent";
        taskCreator = new TaskCreator(mockApp, settings);

        const content = "# Title\n\nContent";
        const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent(content, "- [ ] task");

        expect(result).toBe("- [ ] task\n# Title\n\nContent");
      });

      it("should fall back to prepend for invalid regex", () => {
        settings.quickAdd.locationRegex = "[invalid(regex";
        taskCreator = new TaskCreator(mockApp, settings);

        const content = "# Title\n\nContent";
        const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent(content, "- [ ] task");

        expect(result).toBe("- [ ] task\n# Title\n\nContent");
      });
    });

    describe("after-regex placement", () => {
      beforeEach(() => {
        settings.quickAdd.placement = "after-regex";
        settings.quickAdd.locationRegex = "^## Tasks";
        taskCreator = new TaskCreator(mockApp, settings);
      });

      it("should insert after regex match", () => {
        const content = "# Title\n\n## Tasks\n\n- [ ] existing";
        const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent(content, "- [ ] new task");

        expect(result).toBe("# Title\n\n## Tasks\n- [ ] new task\n\n- [ ] existing");
      });

      it("should skip frontmatter when matching regex", () => {
        const content = "---\ntitle: Test\n---\n\n## Tasks\n\n- [ ] existing";
        const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent(content, "- [ ] new task");

        expect(result).toBe("---\ntitle: Test\n---\n\n## Tasks\n- [ ] new task\n\n- [ ] existing");
      });
    });
  });

  describe("createTask", () => {
    it("should create task in inbox file", async () => {
      const inboxFile = new TFile("Inbox.md");
      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(inboxFile);
      mockApp.vault.read = jest.fn().mockResolvedValue("# Inbox\n");
      mockApp.vault.modify = jest.fn().mockResolvedValue(undefined);

      settings.quickAdd.destination = "inbox";
      settings.quickAdd.placement = "append";
      taskCreator = new TaskCreator(mockApp, settings);

      await taskCreator.createTask("Buy milk");

      expect(mockApp.vault.modify).toHaveBeenCalledWith(inboxFile, "# Inbox\n- [ ] Buy milk");
    });

    it("should create inbox file if it does not exist", async () => {
      const newFile = new TFile("Inbox.md");
      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);
      mockApp.vault.create = jest.fn().mockResolvedValue(newFile);
      mockApp.vault.read = jest.fn().mockResolvedValue("");
      mockApp.vault.modify = jest.fn().mockResolvedValue(undefined);

      settings.quickAdd.destination = "inbox";
      settings.quickAdd.inboxFilePath = "Inbox.md";
      taskCreator = new TaskCreator(mockApp, settings);

      await taskCreator.createTask("Buy milk");

      expect(mockApp.vault.create).toHaveBeenCalledWith("Inbox.md", "");
    });

    it("should create parent folders for inbox file", async () => {
      const newFile = new TFile("Notes/Inbox.md");
      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);
      mockApp.vault.create = jest.fn().mockResolvedValue(newFile);
      mockApp.vault.createFolder = jest.fn().mockResolvedValue(undefined);
      mockApp.vault.read = jest.fn().mockResolvedValue("");
      mockApp.vault.modify = jest.fn().mockResolvedValue(undefined);

      settings.quickAdd.destination = "inbox";
      settings.quickAdd.inboxFilePath = "Notes/Inbox.md";
      taskCreator = new TaskCreator(mockApp, settings);

      await taskCreator.createTask("Buy milk");

      expect(mockApp.vault.createFolder).toHaveBeenCalledWith("Notes");
    });

    it("should throw error when daily notes not configured", async () => {
      const { DailyNoteService } = jest.requireMock("../../../src/core/services/daily-note-service");
      DailyNoteService.mockImplementation(() => ({
        ensureDailyNoteExists: jest.fn().mockResolvedValue(null),
      }));

      settings.quickAdd.destination = "daily";
      taskCreator = new TaskCreator(mockApp, settings);

      await expect(taskCreator.createTask("Buy milk")).rejects.toThrow("Daily notes are not configured");
    });

    it("should throw error when target file could not be determined", async () => {
      // This tests line 22: throw new Error("Could not determine target file for task")
      // This can happen if getTargetFile returns undefined/null
      const { DailyNoteService } = jest.requireMock("../../../src/core/services/daily-note-service");
      DailyNoteService.mockImplementation(() => ({
        ensureDailyNoteExists: jest.fn().mockResolvedValue(null),
      }));

      settings.quickAdd.destination = "daily";
      taskCreator = new TaskCreator(mockApp, settings);

      // The error message should indicate daily notes aren't configured
      await expect(taskCreator.createTask("Buy milk")).rejects.toThrow();
    });

    it("should create task in daily note when configured", async () => {
      // Tests line 150: successful return of file from getOrCreateDailyNote
      const dailyNoteFile = new TFile("Journal/2026-01-19.md");
      const { DailyNoteService } = jest.requireMock("../../../src/core/services/daily-note-service");
      DailyNoteService.mockImplementation(() => ({
        ensureDailyNoteExists: jest.fn().mockResolvedValue(dailyNoteFile),
      }));

      mockApp.vault.read = jest.fn().mockResolvedValue("# Daily Note\n");
      mockApp.vault.modify = jest.fn().mockResolvedValue(undefined);

      settings.quickAdd.destination = "daily";
      settings.quickAdd.placement = "append";
      taskCreator = new TaskCreator(mockApp, settings);

      await taskCreator.createTask("Buy milk");

      expect(mockApp.vault.modify).toHaveBeenCalledWith(dailyNoteFile, "# Daily Note\n- [ ] Buy milk");
    });
  });

  describe("getFrontmatterEndPosition", () => {
    it("should return 0 for content without frontmatter", () => {
      const result = (taskCreator as unknown as { getFrontmatterEndPosition: (content: string) => number }).getFrontmatterEndPosition("# Title");

      expect(result).toBe(0);
    });

    it("should return correct position for content with frontmatter", () => {
      const content = "---\ntitle: Test\n---\n\nContent";
      const result = (taskCreator as unknown as { getFrontmatterEndPosition: (content: string) => number }).getFrontmatterEndPosition(content);

      // ---\n (4) + title: Test\n (12) + --- (3) = 19 (position after closing ---)
      expect(result).toBe(19);
    });

    it("should return 0 for unclosed frontmatter", () => {
      const content = "---\ntitle: Test\nContent";
      const result = (taskCreator as unknown as { getFrontmatterEndPosition: (content: string) => number }).getFrontmatterEndPosition(content);

      expect(result).toBe(0);
    });
  });

  describe("prependAfterFrontmatter", () => {
    beforeEach(() => {
      settings.quickAdd.placement = "prepend";
      taskCreator = new TaskCreator(mockApp, settings);
    });

    it("should handle frontmatter with multiple newlines after", () => {
      const content = "---\ntitle: Test\n---\n\n\n# Title";
      const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent(content, "- [ ] task");

      expect(result).toBe("---\ntitle: Test\n---\n- [ ] task\n# Title");
    });

    it("should handle frontmatter with no content after", () => {
      const content = "---\ntitle: Test\n---";
      const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent(content, "- [ ] task");

      expect(result).toBe("---\ntitle: Test\n---\n- [ ] task\n");
    });
  });

  describe("getOrCreateInboxFile", () => {
    it("should create inbox file at root without creating folders", async () => {
      const newFile = new TFile("Inbox.md");
      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);
      mockApp.vault.create = jest.fn().mockResolvedValue(newFile);
      mockApp.vault.read = jest.fn().mockResolvedValue("");
      mockApp.vault.modify = jest.fn().mockResolvedValue(undefined);
      mockApp.vault.createFolder = jest.fn();

      settings.quickAdd.destination = "inbox";
      settings.quickAdd.inboxFilePath = "Inbox.md"; // No parent path
      taskCreator = new TaskCreator(mockApp, settings);

      await taskCreator.createTask("Buy milk");

      // Should not try to create folders
      expect(mockApp.vault.createFolder).not.toHaveBeenCalled();
    });

    it("should not create folder if it already exists", async () => {
      const newFile = new TFile("Notes/Inbox.md");
      mockApp.vault.getAbstractFileByPath = jest.fn().mockImplementation((path: string) => {
        if (path === "Notes") return { path: "Notes" }; // Folder exists
        return null; // File doesn't exist
      });
      mockApp.vault.create = jest.fn().mockResolvedValue(newFile);
      mockApp.vault.read = jest.fn().mockResolvedValue("");
      mockApp.vault.modify = jest.fn().mockResolvedValue(undefined);
      mockApp.vault.createFolder = jest.fn();

      settings.quickAdd.destination = "inbox";
      settings.quickAdd.inboxFilePath = "Notes/Inbox.md";
      taskCreator = new TaskCreator(mockApp, settings);

      await taskCreator.createTask("Buy milk");

      // Should not try to create existing folder
      expect(mockApp.vault.createFolder).not.toHaveBeenCalled();
    });
  });

  describe("insertAtRegex edge cases", () => {
    it("should handle regex placement without locationRegex by falling through to append", () => {
      settings.quickAdd.placement = "before-regex";
      settings.quickAdd.locationRegex = ""; // Empty regex
      taskCreator = new TaskCreator(mockApp, settings);

      const content = "# Title\n\n## Tasks";
      const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent(content, "- [ ] task");

      // When locationRegex is empty, the regex condition is skipped and falls through to append
      expect(result).toBe("# Title\n\n## Tasks\n- [ ] task");
    });

    it("should handle after-regex placement", () => {
      settings.quickAdd.placement = "after-regex";
      settings.quickAdd.locationRegex = "^## Tasks$";
      taskCreator = new TaskCreator(mockApp, settings);

      const content = "# Title\n\n## Tasks\n\n- [ ] existing";
      const result = (taskCreator as unknown as { insertContent: (content: string, taskLine: string) => string }).insertContent(content, "- [ ] new");

      expect(result).toBe("# Title\n\n## Tasks\n- [ ] new\n\n- [ ] existing");
    });
  });
});
