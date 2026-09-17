import { App, Modal } from "obsidian";

export class DueDateModal extends Modal {
  constructor(
    app: App,
    private initialDate: string,
    private onSubmit: (date: string) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.addClass("task-planner-date-modal");
    this.contentEl.createEl("h2", { text: "Set due date" });

    const input = this.contentEl.createEl("input", {
      type: "date",
      value: this.initialDate,
      attr: { "aria-label": "Due date" },
    });

    const buttons = this.contentEl.createDiv({ cls: "task-planner-date-modal-buttons" });
    buttons.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    const save = buttons.createEl("button", { text: "Set date", cls: "mod-cta" });

    const submit = (): void => {
      if (!input.value) return;
      this.onSubmit(input.value);
      this.close();
    };
    save.addEventListener("click", submit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submit();
    });
    input.win.setTimeout(() => input.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
