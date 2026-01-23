import { OnboardingModal } from "../../src/ui/onboarding-modal";
import { TaskPlannerSettings, DEFAULT_SETTINGS } from "../../src/settings/types";
import { TFile } from "obsidian";

// Helper to add Obsidian extensions to an element
const addExtensions = (el: HTMLElement) => {
  const extEl = el as HTMLElement & {
    addClass: (cls: string) => void;
    removeClass: (cls: string) => void;
    createDiv: (options?: { cls?: string; text?: string; attr?: Record<string, string> }) => HTMLElement;
    createEl: (tag: string, options?: { cls?: string; text?: string; attr?: Record<string, string> }) => HTMLElement;
    createSpan: (options?: { cls?: string; text?: string }) => HTMLElement;
    empty: () => void;
    setText: (text: string) => void;
  };

  extEl.addClass = function (cls: string) {
    this.classList.add(cls);
  };
  extEl.removeClass = function (cls: string) {
    this.classList.remove(cls);
  };
  extEl.empty = function () {
    while (this.firstChild) this.removeChild(this.firstChild);
  };
  extEl.setText = function (text: string) {
    this.textContent = text;
  };

  extEl.createDiv = function (options?: { cls?: string; text?: string; attr?: Record<string, string> }) {
    const div = document.createElement("div");
    addExtensions(div);
    if (options?.cls) div.className = options.cls;
    if (options?.text) div.textContent = options.text;
    if (options?.attr) Object.entries(options.attr).forEach(([k, v]) => div.setAttribute(k, v));
    this.appendChild(div);
    return div;
  };

  extEl.createEl = function (tag: string, options?: { cls?: string; text?: string; attr?: Record<string, string> }) {
    const element = document.createElement(tag);
    addExtensions(element);
    if (options?.cls) element.className = options.cls;
    if (options?.text) element.textContent = options.text;
    if (options?.attr) Object.entries(options.attr).forEach(([k, v]) => element.setAttribute(k, v));
    this.appendChild(element);
    return element;
  };

  extEl.createSpan = function (options?: { cls?: string; text?: string }) {
    const span = document.createElement("span");
    addExtensions(span);
    if (options?.cls) span.className = options.cls;
    if (options?.text) span.textContent = options.text;
    this.appendChild(span);
    return span;
  };

  return extEl;
};

// Mock setIcon from Obsidian
const mockSetIcon = jest.fn();

// Mock vault methods
const mockVaultRead = jest.fn();
const mockVaultModify = jest.fn();
const mockVaultCreate = jest.fn();
const mockGetAbstractFileByPath = jest.fn();

// Mock Obsidian
jest.mock("obsidian", () => ({
  Modal: class MockModal {
    app: unknown;
    contentEl: HTMLDivElement;

    constructor(app: unknown) {
      this.app = app;
      this.contentEl = document.createElement("div");
    }

    open(): void {}
    close(): void {}
  },
  TFile: class MockTFile {
    path: string;
    constructor(path: string = "test.md") {
      this.path = path;
    }
  },
  normalizePath: (path: string) => path.replace(/\\/g, "/").replace(/\/+/g, "/"),
  setIcon: (...args: unknown[]) => mockSetIcon(...args),
}));

// Mock moment
jest.mock("../../src/utils/moment", () => ({
  moment: () => ({
    format: jest.fn().mockReturnValue("2024-01-15"),
    add: jest.fn().mockReturnValue({
      format: jest.fn().mockReturnValue("2024-01-16"),
    }),
  }),
}));

describe("OnboardingModal", () => {
  let mockApp: {
    vault: {
      read: jest.Mock;
      modify: jest.Mock;
      create: jest.Mock;
      getAbstractFileByPath: jest.Mock;
    };
  };
  let settings: TaskPlannerSettings;
  let onCompleteMock: jest.Mock;

  beforeEach(() => {
    mockApp = {
      vault: {
        read: mockVaultRead,
        modify: mockVaultModify,
        create: mockVaultCreate,
        getAbstractFileByPath: mockGetAbstractFileByPath,
      },
    };
    settings = { ...DEFAULT_SETTINGS };
    onCompleteMock = jest.fn();

    // Reset mocks
    mockSetIcon.mockClear();
    mockVaultRead.mockReset();
    mockVaultModify.mockReset();
    mockVaultCreate.mockReset();
    mockGetAbstractFileByPath.mockReset();

    mockVaultRead.mockResolvedValue("");
    mockVaultModify.mockResolvedValue(undefined);
    mockVaultCreate.mockResolvedValue(undefined);
    mockGetAbstractFileByPath.mockReturnValue(null);
  });

  // Helper to create modal with extended contentEl
  const createModal = () => {
    const modal = new OnboardingModal(mockApp as never, settings, onCompleteMock);
    addExtensions(modal.contentEl);
    return modal;
  };

  describe("constructor", () => {
    it("should create a modal instance", () => {
      const modal = createModal();
      expect(modal).toBeInstanceOf(OnboardingModal);
    });

    it("should store settings and onComplete callback", () => {
      const modal = createModal();
      expect((modal as unknown as { settings: TaskPlannerSettings }).settings).toBe(settings);
      expect((modal as unknown as { onComplete: (addedExamples: boolean) => void }).onComplete).toBe(onCompleteMock);
    });
  });

  describe("onOpen", () => {
    it("should add onboarding-modal class to contentEl", () => {
      const modal = createModal();
      modal.onOpen();

      expect(modal.contentEl.classList.contains("onboarding-modal")).toBe(true);
    });

    it("should render the welcome screen by default", () => {
      const modal = createModal();
      modal.onOpen();

      const title = modal.contentEl.querySelector(".onboarding-title");
      expect(title?.textContent).toBe("Welcome");
    });
  });

  describe("onClose", () => {
    it("should empty the content element", () => {
      const modal = createModal();
      modal.onOpen();
      modal.onClose();

      expect(modal.contentEl.children.length).toBe(0);
    });
  });

  describe("Welcome Screen", () => {
    it("should render welcome icon", () => {
      const modal = createModal();
      modal.onOpen();

      const iconContainer = modal.contentEl.querySelector(".onboarding-icon");
      expect(iconContainer).toBeTruthy();
      expect(mockSetIcon).toHaveBeenCalledWith(iconContainer, "calendar-check");
    });

    it("should render welcome title", () => {
      const modal = createModal();
      modal.onOpen();

      const title = modal.contentEl.querySelector(".onboarding-title");
      expect(title).toBeTruthy();
      expect(title?.textContent).toBe("Welcome");
    });

    it("should render welcome description", () => {
      const modal = createModal();
      modal.onOpen();

      const description = modal.contentEl.querySelector(".onboarding-description");
      expect(description).toBeTruthy();
      expect(description?.textContent).toContain("Plan your work across time horizons");
    });

    it("should render Get started button", () => {
      const modal = createModal();
      modal.onOpen();

      const buttons = modal.contentEl.querySelectorAll("button");
      const primaryBtn = Array.from(buttons).find((btn) => btn.classList.contains("mod-cta"));
      expect(primaryBtn).toBeTruthy();
      expect(primaryBtn?.textContent).toBe("Get started");
    });

    it("should render Skip button", () => {
      const modal = createModal();
      modal.onOpen();

      const buttons = modal.contentEl.querySelectorAll("button");
      const secondaryBtn = Array.from(buttons).find((btn) => btn.classList.contains("onboarding-secondary-btn"));
      expect(secondaryBtn).toBeTruthy();
      expect(secondaryBtn?.textContent).toBe("Skip");
    });

    it("should navigate to concept screen when Get started is clicked", () => {
      const modal = createModal();
      modal.onOpen();

      const primaryBtn = modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement;
      primaryBtn.click();

      const title = modal.contentEl.querySelector(".onboarding-title");
      expect(title?.textContent).toBe("How it works");
    });

    it("should call onComplete with false and close when Skip is clicked", () => {
      const modal = createModal();
      const closeSpy = jest.spyOn(modal, "close");
      modal.onOpen();

      const secondaryBtn = modal.contentEl.querySelector(".onboarding-secondary-btn") as HTMLButtonElement;
      secondaryBtn.click();

      expect(onCompleteMock).toHaveBeenCalledWith(false);
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe("Concept Screen", () => {
    const navigateToConcept = (modal: OnboardingModal) => {
      modal.onOpen();
      const primaryBtn = modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement;
      primaryBtn.click();
    };

    it("should render concept title", () => {
      const modal = createModal();
      navigateToConcept(modal);

      const title = modal.contentEl.querySelector(".onboarding-title");
      expect(title?.textContent).toBe("How it works");
    });

    it("should render three steps", () => {
      const modal = createModal();
      navigateToConcept(modal);

      const steps = modal.contentEl.querySelectorAll(".onboarding-step");
      expect(steps.length).toBe(3);
    });

    it("should render step numbers 1, 2, 3", () => {
      const modal = createModal();
      navigateToConcept(modal);

      const stepNumbers = modal.contentEl.querySelectorAll(".onboarding-step-number");
      expect(stepNumbers[0].textContent).toBe("1");
      expect(stepNumbers[1].textContent).toBe("2");
      expect(stepNumbers[2].textContent).toBe("3");
    });

    it("should set icons for each step", () => {
      const modal = createModal();
      navigateToConcept(modal);

      const stepIcons = modal.contentEl.querySelectorAll(".onboarding-step-icon");
      expect(mockSetIcon).toHaveBeenCalledWith(stepIcons[0], "pencil");
      expect(mockSetIcon).toHaveBeenCalledWith(stepIcons[1], "clock");
      expect(mockSetIcon).toHaveBeenCalledWith(stepIcons[2], "move");
    });

    it("should render step texts", () => {
      const modal = createModal();
      navigateToConcept(modal);

      const stepTexts = modal.contentEl.querySelectorAll(".onboarding-step-text");
      expect(stepTexts[0].textContent).toContain("Write tasks anywhere");
      expect(stepTexts[1].textContent).toContain("@today or @tomorrow");
      expect(stepTexts[2].textContent).toContain("Drag tasks between columns");
    });

    it("should render note element", () => {
      const modal = createModal();
      navigateToConcept(modal);

      const note = modal.contentEl.querySelector(".onboarding-note");
      expect(note).toBeTruthy();
      expect(note?.textContent).toContain("automatically appear here");
    });

    it("should render Show me how button", () => {
      const modal = createModal();
      navigateToConcept(modal);

      const primaryBtn = modal.contentEl.querySelector("button.mod-cta");
      expect(primaryBtn?.textContent).toBe("Show me how");
    });

    it("should render Back button", () => {
      const modal = createModal();
      navigateToConcept(modal);

      const secondaryBtn = modal.contentEl.querySelector(".onboarding-secondary-btn");
      expect(secondaryBtn?.textContent).toBe("Back");
    });

    it("should navigate to examples screen when Show me how is clicked", () => {
      const modal = createModal();
      navigateToConcept(modal);

      const primaryBtn = modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement;
      primaryBtn.click();

      const title = modal.contentEl.querySelector(".onboarding-title");
      expect(title?.textContent).toBe("Would you like some example tasks?");
    });

    it("should navigate back to welcome screen when Back is clicked", () => {
      const modal = createModal();
      navigateToConcept(modal);

      const secondaryBtn = modal.contentEl.querySelector(".onboarding-secondary-btn") as HTMLButtonElement;
      secondaryBtn.click();

      const title = modal.contentEl.querySelector(".onboarding-title");
      expect(title?.textContent).toBe("Welcome");
    });
  });

  describe("Examples Screen", () => {
    const navigateToExamples = (modal: OnboardingModal) => {
      modal.onOpen();
      // Welcome -> Concept
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();
      // Concept -> Examples
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();
    };

    it("should render file-plus icon", () => {
      const modal = createModal();
      navigateToExamples(modal);

      const iconContainer = modal.contentEl.querySelector(".onboarding-icon");
      expect(iconContainer).toBeTruthy();
      expect(mockSetIcon).toHaveBeenCalledWith(iconContainer, "file-plus");
    });

    it("should render examples title", () => {
      const modal = createModal();
      navigateToExamples(modal);

      const title = modal.contentEl.querySelector(".onboarding-title");
      expect(title?.textContent).toBe("Would you like some example tasks?");
    });

    it("should render description paragraph", () => {
      const modal = createModal();
      navigateToExamples(modal);

      const description = modal.contentEl.querySelector(".onboarding-description p");
      expect(description).toBeTruthy();
      expect(description?.textContent).toContain("sample tasks");
    });

    it("should render preview items", () => {
      const modal = createModal();
      navigateToExamples(modal);

      const previewItems = modal.contentEl.querySelectorAll(".onboarding-preview-item");
      expect(previewItems.length).toBe(4);
    });

    it("should render preview item with checkbox icon", () => {
      const modal = createModal();
      navigateToExamples(modal);

      const checkboxes = modal.contentEl.querySelectorAll(".onboarding-preview-checkbox");
      expect(checkboxes.length).toBe(4);
      expect(mockSetIcon).toHaveBeenCalledWith(checkboxes[0], "square");
    });

    it("should render preview item texts", () => {
      const modal = createModal();
      navigateToExamples(modal);

      const previewTexts = modal.contentEl.querySelectorAll(".onboarding-preview-text");
      expect(previewTexts[0].textContent).toBe("Review project goals");
      expect(previewTexts[1].textContent).toBe("Schedule team meeting");
      expect(previewTexts[2].textContent).toBe("Important deadline");
      expect(previewTexts[3].textContent).toBe("Research new features");
    });

    it("should render preview item tags", () => {
      const modal = createModal();
      navigateToExamples(modal);

      const previewTags = modal.contentEl.querySelectorAll(".onboarding-preview-tag");
      expect(previewTags[0].textContent).toBe("@today");
      expect(previewTags[1].textContent).toBe("@tomorrow");
      expect(previewTags[2].textContent).toBe("@high");
      expect(previewTags[3].textContent).toBe("backlog");
    });

    it("should render Yes, add examples button", () => {
      const modal = createModal();
      navigateToExamples(modal);

      const primaryBtn = modal.contentEl.querySelector("button.mod-cta");
      expect(primaryBtn?.textContent).toBe("Yes, add examples");
    });

    it("should render No thanks button", () => {
      const modal = createModal();
      navigateToExamples(modal);

      const secondaryBtn = modal.contentEl.querySelector(".onboarding-secondary-btn");
      expect(secondaryBtn?.textContent).toBe("No thanks, start fresh");
    });

    it("should call onComplete with false and close when No thanks is clicked", () => {
      const modal = createModal();
      const closeSpy = jest.spyOn(modal, "close");
      navigateToExamples(modal);

      const secondaryBtn = modal.contentEl.querySelector(".onboarding-secondary-btn") as HTMLButtonElement;
      secondaryBtn.click();

      expect(onCompleteMock).toHaveBeenCalledWith(false);
      expect(closeSpy).toHaveBeenCalled();
    });

    it("should call onComplete with true and close when Yes, add examples is clicked", async () => {
      const modal = createModal();
      const closeSpy = jest.spyOn(modal, "close");
      navigateToExamples(modal);

      const primaryBtn = modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement;
      primaryBtn.click();

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onCompleteMock).toHaveBeenCalledWith(true);
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe("addExampleTasks", () => {
    const navigateToExamples = (modal: OnboardingModal) => {
      modal.onOpen();
      // Welcome -> Concept
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();
      // Concept -> Examples
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();
    };

    it("should create new file when file does not exist", async () => {
      mockGetAbstractFileByPath.mockReturnValue(null);

      const modal = createModal();
      navigateToExamples(modal);

      const primaryBtn = modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement;
      primaryBtn.click();

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockVaultCreate).toHaveBeenCalled();
      expect(mockVaultCreate.mock.calls[0][0]).toBe("Task Planner Examples.md");
      expect(mockVaultCreate.mock.calls[0][1]).toContain("# Task Planner Examples");
    });

    it("should append to existing file when file exists", async () => {
      const mockFile = new TFile("Task Planner Examples.md");
      mockGetAbstractFileByPath.mockReturnValue(mockFile);
      mockVaultRead.mockResolvedValue("# Existing content\n\nSome tasks...");

      const modal = createModal();
      navigateToExamples(modal);

      const primaryBtn = modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement;
      primaryBtn.click();

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockVaultRead).toHaveBeenCalledWith(mockFile);
      expect(mockVaultModify).toHaveBeenCalled();
      expect(mockVaultModify.mock.calls[0][1]).toContain("# Existing content");
      expect(mockVaultModify.mock.calls[0][1]).toContain("# Task Planner Examples");
    });

    it("should create example tasks with correct due date attribute", async () => {
      settings.dueDateAttribute = "scheduled";
      mockGetAbstractFileByPath.mockReturnValue(null);

      const modal = createModal();
      navigateToExamples(modal);

      const primaryBtn = modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement;
      primaryBtn.click();

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      const createdContent = mockVaultCreate.mock.calls[0][1];
      expect(createdContent).toContain("[scheduled::");
    });

    it("should create example tasks with today and tomorrow dates", async () => {
      mockGetAbstractFileByPath.mockReturnValue(null);

      const modal = createModal();
      navigateToExamples(modal);

      const primaryBtn = modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement;
      primaryBtn.click();

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      const createdContent = mockVaultCreate.mock.calls[0][1];
      // Based on our mock, today is 2024-01-15 and tomorrow is 2024-01-16
      expect(createdContent).toContain("2024-01-15");
      expect(createdContent).toContain("2024-01-16");
    });

    it("should create task with high priority", async () => {
      mockGetAbstractFileByPath.mockReturnValue(null);

      const modal = createModal();
      navigateToExamples(modal);

      const primaryBtn = modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement;
      primaryBtn.click();

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      const createdContent = mockVaultCreate.mock.calls[0][1];
      expect(createdContent).toContain("[priority:: high]");
    });

    it("should create task without due date for backlog item", async () => {
      mockGetAbstractFileByPath.mockReturnValue(null);

      const modal = createModal();
      navigateToExamples(modal);

      const primaryBtn = modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement;
      primaryBtn.click();

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      const createdContent = mockVaultCreate.mock.calls[0][1];
      // The "Research new features" task should not have a due date
      expect(createdContent).toContain("- [ ] Research new features for the project\n");
    });
  });

  describe("Screen Navigation State", () => {
    it("should maintain current screen state across re-renders", () => {
      const modal = createModal();
      modal.onOpen();

      // Navigate to concept screen
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();
      expect(modal.contentEl.querySelector(".onboarding-title")?.textContent).toBe("How it works");

      // Navigate to examples screen
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();
      expect(modal.contentEl.querySelector(".onboarding-title")?.textContent).toBe(
        "Would you like some example tasks?"
      );
    });

    it("should clear content when navigating between screens", () => {
      const modal = createModal();
      modal.onOpen();

      // Initial welcome screen
      const welcomeTitle = modal.contentEl.querySelector(".onboarding-title");
      expect(welcomeTitle).toBeTruthy();

      // Navigate to concept
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();

      // Should not have duplicate titles
      const titles = modal.contentEl.querySelectorAll(".onboarding-title");
      expect(titles.length).toBe(1);
      expect(titles[0].textContent).toBe("How it works");
    });

    it("should be able to navigate back and forth", () => {
      const modal = createModal();
      modal.onOpen();

      // Welcome -> Concept
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();
      expect(modal.contentEl.querySelector(".onboarding-title")?.textContent).toBe("How it works");

      // Concept -> Welcome (Back)
      (modal.contentEl.querySelector(".onboarding-secondary-btn") as HTMLButtonElement).click();
      expect(modal.contentEl.querySelector(".onboarding-title")?.textContent).toBe("Welcome");

      // Welcome -> Concept again
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();
      expect(modal.contentEl.querySelector(".onboarding-title")?.textContent).toBe("How it works");

      // Concept -> Examples
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();
      expect(modal.contentEl.querySelector(".onboarding-title")?.textContent).toBe(
        "Would you like some example tasks?"
      );
    });
  });

  describe("Button Containers", () => {
    it("should have button container on welcome screen", () => {
      const modal = createModal();
      modal.onOpen();

      const buttonContainer = modal.contentEl.querySelector(".onboarding-buttons");
      expect(buttonContainer).toBeTruthy();
      expect(buttonContainer?.querySelectorAll("button").length).toBe(2);
    });

    it("should have button container on concept screen", () => {
      const modal = createModal();
      modal.onOpen();
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();

      const buttonContainer = modal.contentEl.querySelector(".onboarding-buttons");
      expect(buttonContainer).toBeTruthy();
      expect(buttonContainer?.querySelectorAll("button").length).toBe(2);
    });

    it("should have button container on examples screen", () => {
      const modal = createModal();
      modal.onOpen();
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();

      const buttonContainer = modal.contentEl.querySelector(".onboarding-buttons");
      expect(buttonContainer).toBeTruthy();
      expect(buttonContainer?.querySelectorAll("button").length).toBe(2);
    });
  });

  describe("Completion Callback", () => {
    it("should call onComplete exactly once when skipping from welcome", () => {
      const modal = createModal();
      const closeSpy = jest.spyOn(modal, "close");
      modal.onOpen();

      const secondaryBtn = modal.contentEl.querySelector(".onboarding-secondary-btn") as HTMLButtonElement;
      secondaryBtn.click();

      expect(onCompleteMock).toHaveBeenCalledTimes(1);
      expect(onCompleteMock).toHaveBeenCalledWith(false);
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it("should call onComplete exactly once when declining examples", () => {
      const modal = createModal();
      const closeSpy = jest.spyOn(modal, "close");
      modal.onOpen();

      // Navigate to examples
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();

      const secondaryBtn = modal.contentEl.querySelector(".onboarding-secondary-btn") as HTMLButtonElement;
      secondaryBtn.click();

      expect(onCompleteMock).toHaveBeenCalledTimes(1);
      expect(onCompleteMock).toHaveBeenCalledWith(false);
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it("should call onComplete exactly once when accepting examples", async () => {
      const modal = createModal();
      const closeSpy = jest.spyOn(modal, "close");
      modal.onOpen();

      // Navigate to examples
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();
      (modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement).click();

      const primaryBtn = modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement;
      primaryBtn.click();

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onCompleteMock).toHaveBeenCalledTimes(1);
      expect(onCompleteMock).toHaveBeenCalledWith(true);
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });
});
