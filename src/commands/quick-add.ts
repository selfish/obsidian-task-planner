import { Command } from "obsidian";

export class QuickAddCommand implements Command {
  id = "quick-add-task";
  name = "Quick add task";
  icon = "plus";

  constructor(private openModal: () => void) {}

  callback(): void {
    this.openModal();
  }
}
