import { App, Modal, TFile, normalizePath, setIcon } from "obsidian";

import { TaskPlannerSettings } from "../settings/types";
import { moment } from "../utils/moment";

type OnboardingScreen = "welcome" | "concept" | "examples";

export class OnboardingModal extends Modal {
  private currentScreen: OnboardingScreen = "welcome";
  private settings: TaskPlannerSettings;
  private onComplete: (addedExamples: boolean) => void;

  constructor(app: App, settings: TaskPlannerSettings, onComplete: (addedExamples: boolean) => void) {
    super(app);
    this.settings = settings;
    this.onComplete = onComplete;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("onboarding-modal");
    this.renderCurrentScreen();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderCurrentScreen(): void {
    const { contentEl } = this;
    contentEl.empty();

    switch (this.currentScreen) {
      case "welcome":
        this.renderWelcomeScreen();
        break;
      case "concept":
        this.renderConceptScreen();
        break;
      case "examples":
        this.renderExamplesScreen();
        break;
    }
  }

  private renderWelcomeScreen(): void {
    const { contentEl } = this;

    // Icon
    const iconContainer = contentEl.createDiv({ cls: "onboarding-icon" });
    setIcon(iconContainer, "calendar-check");

    // Title
    contentEl.createEl("h2", {
      cls: "onboarding-title",
      text: "Welcome",
    });

    // Description
    contentEl.createEl("p", {
      cls: "onboarding-description",
      text: "Plan your work across time horizons - from today to next year.",
    });

    // Buttons
    const buttonContainer = contentEl.createDiv({ cls: "onboarding-buttons" });

    const primaryBtn = buttonContainer.createEl("button", {
      cls: "mod-cta",
      text: "Get started",
    });
    primaryBtn.addEventListener("click", () => {
      this.currentScreen = "concept";
      this.renderCurrentScreen();
    });

    const secondaryBtn = buttonContainer.createEl("button", {
      cls: "onboarding-secondary-btn",
      text: "Skip",
    });
    secondaryBtn.addEventListener("click", () => {
      this.onComplete(false);
      this.close();
    });
  }

  private renderConceptScreen(): void {
    const { contentEl } = this;

    // Title
    contentEl.createEl("h2", {
      cls: "onboarding-title",
      text: "How it works",
    });

    // Steps
    const stepsContainer = contentEl.createDiv({ cls: "onboarding-steps" });

    const steps = [
      {
        number: "1",
        icon: "pencil",
        text: "Write tasks anywhere in Obsidian",
      },
      {
        number: "2",
        icon: "clock",
        text: "Add @today or @tomorrow to schedule them",
      },
      {
        number: "3",
        icon: "move",
        text: "Drag tasks between columns to reschedule",
      },
    ];

    for (const step of steps) {
      const stepEl = stepsContainer.createDiv({ cls: "onboarding-step" });

      const numberEl = stepEl.createDiv({ cls: "onboarding-step-number" });
      numberEl.setText(step.number);

      const iconEl = stepEl.createDiv({ cls: "onboarding-step-icon" });
      setIcon(iconEl, step.icon);

      const textEl = stepEl.createDiv({ cls: "onboarding-step-text" });
      textEl.setText(step.text);
    }

    // Note
    const noteEl = contentEl.createDiv({ cls: "onboarding-note" });
    noteEl.setText("Your tasks automatically appear here.");

    // Buttons
    const buttonContainer = contentEl.createDiv({ cls: "onboarding-buttons" });

    const primaryBtn = buttonContainer.createEl("button", {
      cls: "mod-cta",
      text: "Show me how",
    });
    primaryBtn.addEventListener("click", () => {
      this.currentScreen = "examples";
      this.renderCurrentScreen();
    });

    const secondaryBtn = buttonContainer.createEl("button", {
      cls: "onboarding-secondary-btn",
      text: "Back",
    });
    secondaryBtn.addEventListener("click", () => {
      this.currentScreen = "welcome";
      this.renderCurrentScreen();
    });
  }

  private renderExamplesScreen(): void {
    const { contentEl } = this;

    // Icon
    const iconContainer = contentEl.createDiv({ cls: "onboarding-icon" });
    setIcon(iconContainer, "file-plus");

    // Title
    contentEl.createEl("h2", {
      cls: "onboarding-title",
      text: "Would you like some example tasks?",
    });

    // Description
    const descEl = contentEl.createDiv({ cls: "onboarding-description" });
    descEl.createEl("p", {
      text: "This will create a few sample tasks so you can see how the planning board works.",
    });

    // Preview of example tasks
    const previewEl = contentEl.createDiv({ cls: "onboarding-preview" });
    const previewItems = [
      { text: "Review project goals", tag: "@today" },
      { text: "Schedule team meeting", tag: "@tomorrow" },
      { text: "Important deadline", tag: "@high" },
      { text: "Research new features", tag: "backlog" },
    ];

    for (const item of previewItems) {
      const itemEl = previewEl.createDiv({ cls: "onboarding-preview-item" });
      const checkbox = itemEl.createSpan({ cls: "onboarding-preview-checkbox" });
      setIcon(checkbox, "square");
      itemEl.createSpan({ cls: "onboarding-preview-text", text: item.text });
      itemEl.createSpan({ cls: "onboarding-preview-tag", text: item.tag });
    }

    // Buttons
    const buttonContainer = contentEl.createDiv({ cls: "onboarding-buttons" });

    const primaryBtn = buttonContainer.createEl("button", {
      cls: "mod-cta",
      text: "Yes, add examples",
    });
    primaryBtn.addEventListener("click", () => {
      void this.addExampleTasks().then(() => {
        this.onComplete(true);
        this.close();
      });
    });

    const secondaryBtn = buttonContainer.createEl("button", {
      cls: "onboarding-secondary-btn",
      text: "No thanks, start fresh",
    });
    secondaryBtn.addEventListener("click", () => {
      this.onComplete(false);
      this.close();
    });
  }

  private async addExampleTasks(): Promise<void> {
    const today = moment().format("YYYY-MM-DD");
    const tomorrow = moment().add(1, "day").format("YYYY-MM-DD");

    const exampleTasks = [
      `- [ ] Review project goals and priorities [${this.settings.dueDateAttribute}:: ${today}]`,
      `- [ ] Schedule team meeting for next week [${this.settings.dueDateAttribute}:: ${tomorrow}]`,
      `- [ ] Important deadline - prepare presentation [${this.settings.dueDateAttribute}:: ${today}] [priority:: high]`,
      `- [ ] Research new features for the project`,
    ];

    const content = `# Task Planner Examples

These are example tasks to help you get started with Task Planner.
Feel free to complete, modify, or delete them!

${exampleTasks.join("\n")}
`;

    const filePath = normalizePath("Task Planner Examples.md");

    // Check if file already exists
    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    if (existingFile instanceof TFile) {
      // Append to existing file
      const existingContent = await this.app.vault.read(existingFile);
      await this.app.vault.modify(existingFile, existingContent + "\n\n" + content);
    } else {
      // Create new file
      await this.app.vault.create(filePath, content);
    }
  }
}
