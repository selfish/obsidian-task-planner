import { QuickAddModal } from "../../src/ui/quick-add-modal";
import { TaskPlannerSettings, DEFAULT_SETTINGS } from "../../src/settings/types";
import { TaskCreator } from "../../src/core/services/task-creator";

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

// Mock Obsidian
jest.mock("obsidian", () => ({
  Modal: class MockModal {
    app: unknown;
    contentEl: HTMLDivElement;

    constructor(app: unknown) {
      this.app = app;
      // Use a simple div, extensions added in beforeEach
      this.contentEl = document.createElement("div");
    }

    open(): void {}
    close(): void {}
  },
  AbstractInputSuggest: class MockAbstractInputSuggest {
    constructor(_app: unknown, _inputEl: HTMLElement) {}
    close(): void {}
  },
}));

// Mock WikilinkSuggest (excluded from coverage)
// Capture the onLinkInserted callback for testing
let capturedOnLinkInserted: (() => void) | null = null;
jest.mock("../../src/ui/wikilink-suggest", () => ({
  WikilinkSuggest: jest.fn().mockImplementation((_app: unknown, _inputEl: unknown, onLinkInserted: () => void) => {
    capturedOnLinkInserted = onLinkInserted;
    return {
      close: jest.fn(),
    };
  }),
}));

// Mock TaskCreator
const mockCreateTask = jest.fn().mockResolvedValue(undefined);
jest.mock("../../src/core/services/task-creator", () => ({
  TaskCreator: jest.fn().mockImplementation(() => ({
    createTask: mockCreateTask,
  })),
}));

// Mock StatusOperations
jest.mock("../../src/core/operations/status-operations", () => ({
  StatusOperations: jest.fn().mockImplementation(() => ({
    convertAttributes: jest.fn((line: string) => line),
  })),
}));

describe("QuickAddModal", () => {
  let mockApp: { vault: { getMarkdownFiles: jest.Mock } };
  let settings: TaskPlannerSettings;

  beforeEach(() => {
    mockApp = {
      vault: {
        getMarkdownFiles: jest.fn().mockReturnValue([]),
      },
    };
    settings = { ...DEFAULT_SETTINGS };
    mockCreateTask.mockClear();
    mockCreateTask.mockResolvedValue(undefined);
    capturedOnLinkInserted = null;
    jest.clearAllMocks();
  });

  // Helper to create modal with extended contentEl
  const createModal = () => {
    const modal = new QuickAddModal(mockApp as never, settings);
    // Add Obsidian extensions to contentEl
    addExtensions(modal.contentEl);
    return modal;
  };

  describe("constructor", () => {
    it("should create a modal instance", () => {
      const modal = createModal();
      expect(modal).toBeInstanceOf(QuickAddModal);
    });

    it("should initialize TaskCreator with app and settings", () => {
      createModal();
      expect(TaskCreator).toHaveBeenCalledWith(mockApp, settings);
    });
  });

  describe("onOpen", () => {
    it("should create the modal UI elements", () => {
      const modal = createModal();
      modal.onOpen();

      const contentEl = modal.contentEl;
      expect(contentEl.querySelector(".quick-add-title")).toBeTruthy();
      expect(contentEl.querySelector(".quick-add-editor")).toBeTruthy();
      expect(contentEl.querySelector(".quick-add-footer")).toBeTruthy();
      expect(contentEl.querySelector(".quick-add-hint")).toBeTruthy();
      expect(contentEl.querySelector(".quick-add-buttons")).toBeTruthy();
    });

    it("should display inbox file path when destination is inbox", () => {
      settings.quickAdd.destination = "inbox";
      settings.quickAdd.inboxFilePath = "Tasks/Inbox.md";

      const modal = createModal();
      modal.onOpen();

      const hint = modal.contentEl.querySelector(".quick-add-hint");
      expect(hint?.textContent).toContain("Tasks/Inbox.md");
    });

    it("should display daily note when destination is daily", () => {
      settings.quickAdd.destination = "daily";

      const modal = createModal();
      modal.onOpen();

      const hint = modal.contentEl.querySelector(".quick-add-hint");
      expect(hint?.textContent).toContain("daily note");
    });

    it("should create a contenteditable editor", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLElement;
      expect(editor?.getAttribute("contenteditable")).toBe("true");
    });

    it("should set placeholder attribute on editor", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLElement;
      expect(editor?.getAttribute("data-placeholder")).toBe("Add task... (use [[ for links, @today, @tomorrow, @week)");
    });

    it("should create cancel and submit buttons", () => {
      const modal = createModal();
      modal.onOpen();

      const buttons = modal.contentEl.querySelectorAll("button");
      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent).toBe("Cancel");
      expect(buttons[1].textContent).toBe("Add task");
    });

    it("should add mod-cta class to submit button", () => {
      const modal = createModal();
      modal.onOpen();

      const submitBtn = modal.contentEl.querySelectorAll("button")[1];
      expect(submitBtn.classList.contains("mod-cta")).toBe(true);
    });

    it("should close modal when cancel button is clicked", () => {
      const modal = createModal();
      modal.onOpen();

      const closeSpy = jest.spyOn(modal, "close");
      const cancelBtn = modal.contentEl.querySelectorAll("button")[0];
      cancelBtn.click();

      expect(closeSpy).toHaveBeenCalled();
    });

    it("should call submit when submit button is clicked", () => {
      const modal = createModal();
      modal.onOpen();

      const submitSpy = jest.spyOn(modal as unknown as { submit: () => Promise<void> }, "submit").mockResolvedValue();
      const submitBtn = modal.contentEl.querySelectorAll("button")[1];
      submitBtn.click();

      expect(submitSpy).toHaveBeenCalled();
    });

    it("should focus the editor after timeout", () => {
      jest.useFakeTimers();
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      const focusSpy = jest.spyOn(editor, "focus");

      // Advance timers to trigger the setTimeout
      jest.advanceTimersByTime(20);

      expect(focusSpy).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it("should pass onLinkInserted callback to WikilinkSuggest", () => {
      const modal = createModal();
      modal.onOpen();

      // The callback should have been captured by the mock
      expect(capturedOnLinkInserted).not.toBeNull();

      // Calling the callback should not throw (it's an empty function)
      expect(() => capturedOnLinkInserted!()).not.toThrow();
    });
  });

  describe("onClose", () => {
    it("should empty the content element", () => {
      const modal = createModal();
      modal.onOpen();
      modal.onClose();

      expect(modal.contentEl.children.length).toBe(0);
    });

    it("should handle onClose when suggest is null (onOpen never called)", () => {
      const modal = createModal();
      // Don't call onOpen, so suggest is null
      // This should not throw
      expect(() => modal.onClose()).not.toThrow();
    });
  });

  describe("setOnTaskCreated", () => {
    it("should store the callback", () => {
      const modal = createModal();
      const callback = jest.fn();

      modal.setOnTaskCreated(callback);

      expect((modal as unknown as { onTaskCreated: () => void }).onTaskCreated).toBe(callback);
    });
  });

  describe("getMarkdownContent", () => {
    it("should extract plain text content", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "Buy groceries";

      const content = (modal as unknown as { getMarkdownContent: () => string }).getMarkdownContent();
      expect(content).toBe("Buy groceries");
    });

    it("should convert wikilink spans to markdown", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.innerHTML = "";
      editor.appendChild(document.createTextNode("See "));

      const wikilink = document.createElement("span");
      wikilink.className = "quick-add-wikilink";
      wikilink.dataset.target = "MyNote";
      wikilink.textContent = "MyNote";
      editor.appendChild(wikilink);

      editor.appendChild(document.createTextNode(" for details"));

      const content = (modal as unknown as { getMarkdownContent: () => string }).getMarkdownContent();
      expect(content).toBe("See [[MyNote]] for details");
    });

    it("should use textContent when wikilink has no data-target", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.innerHTML = "";

      const wikilink = document.createElement("span");
      wikilink.className = "quick-add-wikilink";
      wikilink.textContent = "FallbackNote";
      editor.appendChild(wikilink);

      const content = (modal as unknown as { getMarkdownContent: () => string }).getMarkdownContent();
      expect(content).toBe("[[FallbackNote]]");
    });

    it("should convert external link spans to markdown", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.innerHTML = "";
      editor.appendChild(document.createTextNode("Check "));

      const link = document.createElement("span");
      link.className = "quick-add-link";
      link.dataset.url = "https://example.com";
      link.textContent = "this article";
      editor.appendChild(link);

      const content = (modal as unknown as { getMarkdownContent: () => string }).getMarkdownContent();
      expect(content).toBe("Check [this article](https://example.com)");
    });

    it("should handle external link with no url", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.innerHTML = "";

      const link = document.createElement("span");
      link.className = "quick-add-link";
      link.textContent = "broken link";
      editor.appendChild(link);

      const content = (modal as unknown as { getMarkdownContent: () => string }).getMarkdownContent();
      expect(content).toBe("[broken link]()");
    });

    it("should handle external link with no text", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.innerHTML = "";

      const link = document.createElement("span");
      link.className = "quick-add-link";
      link.dataset.url = "https://example.com";
      editor.appendChild(link);

      const content = (modal as unknown as { getMarkdownContent: () => string }).getMarkdownContent();
      expect(content).toBe("[](https://example.com)");
    });

    it("should handle mixed content with wikilinks and external links", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.innerHTML = "";

      editor.appendChild(document.createTextNode("Read "));

      const wikilink = document.createElement("span");
      wikilink.className = "quick-add-wikilink";
      wikilink.dataset.target = "Notes";
      wikilink.textContent = "Notes";
      editor.appendChild(wikilink);

      editor.appendChild(document.createTextNode(" and "));

      const link = document.createElement("span");
      link.className = "quick-add-link";
      link.dataset.url = "https://docs.com";
      link.textContent = "docs";
      editor.appendChild(link);

      const content = (modal as unknown as { getMarkdownContent: () => string }).getMarkdownContent();
      expect(content).toBe("Read [[Notes]] and [docs](https://docs.com)");
    });

    it("should return empty string for empty editor", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.innerHTML = "";

      const content = (modal as unknown as { getMarkdownContent: () => string }).getMarkdownContent();
      expect(content).toBe("");
    });

    it("should trim whitespace", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "  Task with spaces  ";

      const content = (modal as unknown as { getMarkdownContent: () => string }).getMarkdownContent();
      expect(content).toBe("Task with spaces");
    });

    it("should process nested elements recursively", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.innerHTML = "";

      const wrapper = document.createElement("div");
      wrapper.appendChild(document.createTextNode("Nested "));
      const inner = document.createElement("span");
      inner.textContent = "content";
      wrapper.appendChild(inner);
      editor.appendChild(wrapper);

      const content = (modal as unknown as { getMarkdownContent: () => string }).getMarkdownContent();
      expect(content).toBe("Nested content");
    });

    it("should handle wikilink with empty textContent", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.innerHTML = "";

      const wikilink = document.createElement("span");
      wikilink.className = "quick-add-wikilink";
      wikilink.dataset.target = "";
      wikilink.textContent = "";
      editor.appendChild(wikilink);

      const content = (modal as unknown as { getMarkdownContent: () => string }).getMarkdownContent();
      expect(content).toBe("[[]]");
    });

    it("should handle text node with null textContent", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.innerHTML = "";

      // Create a text node and force its textContent to null
      const textNode = document.createTextNode("test");
      Object.defineProperty(textNode, "textContent", { value: null });
      editor.appendChild(textNode);

      const content = (modal as unknown as { getMarkdownContent: () => string }).getMarkdownContent();
      expect(content).toBe("");
    });

    it("should ignore non-text and non-element nodes (like comments)", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.innerHTML = "";

      // Add a comment node (nodeType = 8, neither TEXT_NODE=3 nor ELEMENT_NODE=1)
      const comment = document.createComment("this is a comment");
      editor.appendChild(comment);
      editor.appendChild(document.createTextNode("visible text"));

      const content = (modal as unknown as { getMarkdownContent: () => string }).getMarkdownContent();
      expect(content).toBe("visible text");
    });
  });

  describe("handleKeyDown", () => {
    it("should call submit on Cmd+Enter", () => {
      const modal = createModal();
      modal.onOpen();

      const submitSpy = jest.spyOn(modal as unknown as { submit: () => Promise<void> }, "submit").mockResolvedValue();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        metaKey: true,
        bubbles: true,
      });

      editor.dispatchEvent(event);

      expect(submitSpy).toHaveBeenCalled();
    });

    it("should call submit on Ctrl+Enter", () => {
      const modal = createModal();
      modal.onOpen();

      const submitSpy = jest.spyOn(modal as unknown as { submit: () => Promise<void> }, "submit").mockResolvedValue();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        bubbles: true,
      });

      editor.dispatchEvent(event);

      expect(submitSpy).toHaveBeenCalled();
    });

    it("should not submit on plain Enter", () => {
      const modal = createModal();
      modal.onOpen();

      const submitSpy = jest.spyOn(modal as unknown as { submit: () => Promise<void> }, "submit").mockResolvedValue();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      });

      editor.dispatchEvent(event);

      expect(submitSpy).not.toHaveBeenCalled();
    });

    it("should prevent default on Cmd+Enter", () => {
      const modal = createModal();
      modal.onOpen();

      jest.spyOn(modal as unknown as { submit: () => Promise<void> }, "submit").mockResolvedValue();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = jest.spyOn(event, "preventDefault");
      editor.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("should close modal on Escape when no suggestion container", () => {
      jest.useFakeTimers();
      const modal = createModal();
      modal.onOpen();

      const closeSpy = jest.spyOn(modal, "close");

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
      });

      editor.dispatchEvent(event);
      jest.advanceTimersByTime(20);

      expect(closeSpy).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it("should not close modal on Escape when suggestion container exists", () => {
      jest.useFakeTimers();
      const modal = createModal();
      modal.onOpen();

      // Add a suggestion container to the document
      const suggestionContainer = document.createElement("div");
      suggestionContainer.className = "suggestion-container";
      document.body.appendChild(suggestionContainer);

      const closeSpy = jest.spyOn(modal, "close");

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
      });

      editor.dispatchEvent(event);
      jest.advanceTimersByTime(20);

      expect(closeSpy).not.toHaveBeenCalled();

      // Cleanup
      document.body.removeChild(suggestionContainer);
      jest.useRealTimers();
    });
  });

  describe("handlePaste", () => {
    it("should not intercept non-URL paste", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "some text";

      const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & {
        clipboardData: { getData: jest.Mock };
      };
      Object.defineProperty(event, "clipboardData", {
        value: {
          getData: jest.fn().mockReturnValue("plain text"),
        },
      });

      const preventDefaultSpy = jest.spyOn(event, "preventDefault");
      editor.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("should not intercept when clipboard is empty", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;

      const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & {
        clipboardData: { getData: jest.Mock } | null;
      };
      Object.defineProperty(event, "clipboardData", {
        value: null,
      });

      const preventDefaultSpy = jest.spyOn(event, "preventDefault");
      editor.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("should not intercept URL paste when no text is selected", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "some text";

      // Mock collapsed selection (no text selected)
      const mockSelection = {
        isCollapsed: true,
        toString: () => "",
        getRangeAt: jest.fn(),
        removeAllRanges: jest.fn(),
        addRange: jest.fn(),
      };
      jest.spyOn(window, "getSelection").mockReturnValue(mockSelection as unknown as Selection);

      const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & {
        clipboardData: { getData: jest.Mock };
      };
      Object.defineProperty(event, "clipboardData", {
        value: {
          getData: jest.fn().mockReturnValue("https://example.com"),
        },
      });

      const preventDefaultSpy = jest.spyOn(event, "preventDefault");
      editor.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("should not intercept URL paste when selection returns null", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;

      jest.spyOn(window, "getSelection").mockReturnValue(null);

      const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & {
        clipboardData: { getData: jest.Mock };
      };
      Object.defineProperty(event, "clipboardData", {
        value: {
          getData: jest.fn().mockReturnValue("https://example.com"),
        },
      });

      const preventDefaultSpy = jest.spyOn(event, "preventDefault");
      editor.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("should not intercept when selected text is empty after trim", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "   ";

      const mockSelection = {
        isCollapsed: false,
        toString: () => "   ",
        getRangeAt: jest.fn(),
        removeAllRanges: jest.fn(),
        addRange: jest.fn(),
      };
      jest.spyOn(window, "getSelection").mockReturnValue(mockSelection as unknown as Selection);

      const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & {
        clipboardData: { getData: jest.Mock };
      };
      Object.defineProperty(event, "clipboardData", {
        value: {
          getData: jest.fn().mockReturnValue("https://example.com"),
        },
      });

      const preventDefaultSpy = jest.spyOn(event, "preventDefault");
      editor.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("should create link span when pasting URL with selected text", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "Check this link here";

      // Create a real range for testing
      const textNode = editor.firstChild!;
      const range = document.createRange();
      range.setStart(textNode, 6);
      range.setEnd(textNode, 15);

      const mockSelection = {
        isCollapsed: false,
        toString: () => "this link",
        getRangeAt: () => range,
        removeAllRanges: jest.fn(),
        addRange: jest.fn(),
      };
      jest.spyOn(window, "getSelection").mockReturnValue(mockSelection as unknown as Selection);

      const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & {
        clipboardData: { getData: jest.Mock };
      };
      Object.defineProperty(event, "clipboardData", {
        value: {
          getData: jest.fn().mockReturnValue("https://example.com"),
        },
      });

      editor.dispatchEvent(event);

      // Check that a link span was created
      const linkSpan = editor.querySelector(".quick-add-link");
      expect(linkSpan).toBeTruthy();
      expect(linkSpan?.textContent).toBe("this link");
      expect((linkSpan as HTMLElement).dataset.url).toBe("https://example.com");
    });

    it("should not intercept URL that doesn't match pattern", () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "some text";

      const mockSelection = {
        isCollapsed: false,
        toString: () => "text",
        getRangeAt: jest.fn(),
        removeAllRanges: jest.fn(),
        addRange: jest.fn(),
      };
      jest.spyOn(window, "getSelection").mockReturnValue(mockSelection as unknown as Selection);

      const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & {
        clipboardData: { getData: jest.Mock };
      };
      Object.defineProperty(event, "clipboardData", {
        value: {
          getData: jest.fn().mockReturnValue("not-a-url"),
        },
      });

      const preventDefaultSpy = jest.spyOn(event, "preventDefault");
      editor.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe("submit", () => {
    it("should close modal when content is empty", async () => {
      const modal = createModal();
      modal.onOpen();

      const closeSpy = jest.spyOn(modal, "close");

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "";

      await (modal as unknown as { submit: () => Promise<void> }).submit();

      expect(closeSpy).toHaveBeenCalled();
    });

    it("should not call TaskCreator when content is empty", async () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "";

      await (modal as unknown as { submit: () => Promise<void> }).submit();

      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it("should call TaskCreator.createTask with content", async () => {
      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "New task";

      await (modal as unknown as { submit: () => Promise<void> }).submit();

      expect(mockCreateTask).toHaveBeenCalledWith("New task");
    });

    it("should call onTaskCreated callback after successful submission", async () => {
      const modal = createModal();
      const callback = jest.fn();
      modal.setOnTaskCreated(callback);
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "New task";

      await (modal as unknown as { submit: () => Promise<void> }).submit();

      expect(callback).toHaveBeenCalled();
    });

    it("should close modal after successful submission", async () => {
      const modal = createModal();
      modal.onOpen();

      const closeSpy = jest.spyOn(modal, "close");

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "New task";

      await (modal as unknown as { submit: () => Promise<void> }).submit();

      expect(closeSpy).toHaveBeenCalled();
    });

    it("should show error when TaskCreator throws", async () => {
      mockCreateTask.mockRejectedValue(new Error("Failed to save"));

      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "New task";

      await (modal as unknown as { submit: () => Promise<void> }).submit();

      const errorEl = modal.contentEl.querySelector(".quick-add-error");
      expect(errorEl).toBeTruthy();
      expect(errorEl?.textContent).toBe("Failed to save");
    });

    it("should show generic error message for non-Error throws", async () => {
      mockCreateTask.mockRejectedValue("string error");

      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "New task";

      await (modal as unknown as { submit: () => Promise<void> }).submit();

      const errorEl = modal.contentEl.querySelector(".quick-add-error");
      expect(errorEl).toBeTruthy();
      expect(errorEl?.textContent).toBe("Failed to create task");
    });

    it("should update existing error element on subsequent errors", async () => {
      mockCreateTask.mockRejectedValue(new Error("First error"));

      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "New task";

      // First error
      await (modal as unknown as { submit: () => Promise<void> }).submit();

      const errorEl = modal.contentEl.querySelector(".quick-add-error");
      expect(errorEl?.textContent).toBe("First error");

      // Second error - should update existing element
      mockCreateTask.mockRejectedValue(new Error("Second error"));
      await (modal as unknown as { submit: () => Promise<void> }).submit();

      const errorElements = modal.contentEl.querySelectorAll(".quick-add-error");
      expect(errorElements.length).toBe(1);
      expect(errorElements[0].textContent).toBe("Second error");
    });

    it("should update existing error element with generic message for non-Error", async () => {
      mockCreateTask.mockRejectedValue(new Error("First error"));

      const modal = createModal();
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "New task";

      // First error creates the error element
      await (modal as unknown as { submit: () => Promise<void> }).submit();

      // Second error with non-Error - should update existing element with generic message
      mockCreateTask.mockRejectedValue("string error");
      await (modal as unknown as { submit: () => Promise<void> }).submit();

      const errorElements = modal.contentEl.querySelectorAll(".quick-add-error");
      expect(errorElements.length).toBe(1);
      expect(errorElements[0].textContent).toBe("Failed to create task");
    });

    it("should not call callback when TaskCreator throws", async () => {
      mockCreateTask.mockRejectedValue(new Error("Failed to save"));

      const modal = createModal();
      const callback = jest.fn();
      modal.setOnTaskCreated(callback);
      modal.onOpen();

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "New task";

      await (modal as unknown as { submit: () => Promise<void> }).submit();

      expect(callback).not.toHaveBeenCalled();
    });

    it("should not close modal when TaskCreator throws", async () => {
      mockCreateTask.mockRejectedValue(new Error("Failed to save"));

      const modal = createModal();
      modal.onOpen();

      const closeSpy = jest.spyOn(modal, "close");

      const editor = modal.contentEl.querySelector(".quick-add-editor") as HTMLDivElement;
      editor.textContent = "New task";

      await (modal as unknown as { submit: () => Promise<void> }).submit();

      expect(closeSpy).not.toHaveBeenCalled();
    });
  });
});
