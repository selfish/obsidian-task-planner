import { DueDateModal } from "../../src/ui/due-date-modal";

const addExtensions = (element: HTMLElement): void => {
  const extended = element as HTMLElement & {
    win: Window;
    addClass: (name: string) => void;
    createEl: (tag: string, options?: { cls?: string; text?: string; type?: string; value?: string; attr?: Record<string, string> }) => HTMLElement;
    createDiv: (options?: { cls?: string }) => HTMLElement;
    empty: () => void;
  };
  Object.defineProperty(extended, "win", { get: () => window, configurable: true });
  extended.addClass = (name) => extended.classList.add(name);
  extended.empty = () => extended.replaceChildren();
  extended.createEl = (tag, options) => {
    const child = document.createElement(tag);
    addExtensions(child);
    if (options?.cls) child.className = options.cls;
    if (options?.text) child.textContent = options.text;
    if (options?.type) (child as HTMLInputElement).type = options.type;
    if (options?.value) (child as HTMLInputElement).value = options.value;
    for (const [name, value] of Object.entries(options?.attr ?? {})) child.setAttribute(name, value);
    extended.appendChild(child);
    return child;
  };
  extended.createDiv = (options) => extended.createEl("div", options);
};

const createModal = (initialDate: string, onSubmit: (date: string) => void): DueDateModal => {
  const modal = new DueDateModal({} as never, initialDate, onSubmit);
  addExtensions(modal.contentEl);
  return modal;
};

describe("DueDateModal", () => {
  it("prefills and submits the native date input", () => {
    const onSubmit = jest.fn();
    const modal = createModal("2026-09-18", onSubmit);
    const close = jest.spyOn(modal, "close");

    modal.onOpen();
    const input = modal.contentEl.querySelector<HTMLInputElement>('input[type="date"]')!;
    expect(input.value).toBe("2026-09-18");
    expect(input.getAttribute("aria-label")).toBe("Due date");

    input.value = "2026-09-21";
    [...modal.contentEl.querySelectorAll("button")].find((button) => button.textContent === "Set date")!.click();

    expect(onSubmit).toHaveBeenCalledWith("2026-09-21");
    expect(close).toHaveBeenCalled();
  });

  it("submits with Enter and ignores an empty value", () => {
    const onSubmit = jest.fn();
    const modal = createModal("", onSubmit);
    modal.onOpen();
    const input = modal.contentEl.querySelector<HTMLInputElement>("input")!;

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onSubmit).not.toHaveBeenCalled();

    input.value = "2026-09-21";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onSubmit).toHaveBeenCalledWith("2026-09-21");
  });

  it("cancels and clears its content on close", () => {
    const modal = createModal("", jest.fn());
    const close = jest.spyOn(modal, "close");
    modal.onOpen();

    [...modal.contentEl.querySelectorAll("button")].find((button) => button.textContent === "Cancel")!.click();
    expect(close).toHaveBeenCalled();

    modal.onClose();
    expect(modal.contentEl.childElementCount).toBe(0);
  });
});
