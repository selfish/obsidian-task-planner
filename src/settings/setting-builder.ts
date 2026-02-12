import { App, SearchComponent, Setting, setIcon } from "obsidian";

import TaskPlannerPlugin from "../main";
import { FileSuggest } from "../ui/file-suggest";
import { FolderSuggest } from "../ui/folder-suggest";

// Setting definition types
export type SettingType = "toggle" | "text" | "dropdown" | "search-file" | "search-folder";

export interface DropdownOption {
  value: string;
  label: string;
}

export interface SettingDef {
  type: SettingType;
  name: string;
  desc: string;
  getValue: (plugin: TaskPlannerPlugin) => unknown;
  setValue: (plugin: TaskPlannerPlugin, value: unknown) => Promise<void>;
  options?: DropdownOption[];
  placeholder?: string;
  validate?: (value: string) => boolean;
  visible?: (plugin: TaskPlannerPlugin) => boolean;
  tooltip?: string;
  refreshViews?: boolean;
  refreshDisplay?: boolean;
}

export interface SubsectionDef {
  label: string;
  settings: SettingDef[];
}

export interface SectionDef {
  heading: string;
  subsections: SubsectionDef[];
}

export function createSubsection(containerEl: HTMLElement, title: string): HTMLElement {
  const subsection = containerEl.createDiv({ cls: "th-subsection" });
  subsection.createDiv({ cls: "th-subsection-label", text: title });
  return subsection;
}

export function createCollapsibleSection(
  containerEl: HTMLElement,
  title: string,
  collapsed: boolean,
  onToggle: (collapsed: boolean) => void
): HTMLElement {
  const sectionEl = containerEl.createDiv({ cls: "th-collapsible" });

  const headerEl = sectionEl.createDiv({
    cls: `th-collapsible-header ${collapsed ? "is-collapsed" : ""}`,
  });

  const chevronEl = headerEl.createSpan({ cls: "th-collapsible-chevron" });
  setIcon(chevronEl, "chevron-down");
  headerEl.createSpan({ cls: "th-collapsible-title", text: title });

  const contentEl = sectionEl.createDiv({
    cls: `th-collapsible-content ${collapsed ? "is-collapsed" : ""}`,
  });

  const toggle = () => {
    const isCollapsed = headerEl.hasClass("is-collapsed");
    headerEl.toggleClass("is-collapsed", !isCollapsed);
    contentEl.toggleClass("is-collapsed", !isCollapsed);
    onToggle(!isCollapsed);
  };

  headerEl.addEventListener("click", toggle);
  headerEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });

  return contentEl;
}

export function renderSetting(
  containerEl: HTMLElement,
  def: SettingDef,
  plugin: TaskPlannerPlugin,
  app: App,
  onRefresh?: () => void
): Setting | null {
  if (def.visible && !def.visible(plugin)) {
    return null;
  }

  const setting = new Setting(containerEl).setName(def.name).setDesc(def.desc);

  const handleChange = async (value: unknown) => {
    await def.setValue(plugin, value);
    await plugin.saveSettings();
    if (def.refreshViews) {
      plugin.refreshPlanningViews();
    }
    if (def.refreshDisplay && onRefresh) {
      onRefresh();
    }
  };

  switch (def.type) {
    case "toggle":
      setting.addToggle((toggle) => toggle.setValue(def.getValue(plugin) as boolean).onChange(handleChange));
      break;

    case "text":
      setting.addText((text) => {
        text.setPlaceholder(def.placeholder ?? "").setValue(def.getValue(plugin) as string);
        text.onChange(async (value) => {
          if (!def.validate || def.validate(value)) {
            await handleChange(value);
          }
        });
      });
      break;

    case "dropdown":
      setting.addDropdown((dropdown) => {
        for (const opt of def.options ?? []) {
          dropdown.addOption(opt.value, opt.label);
        }
        dropdown.setValue(def.getValue(plugin) as string);
        dropdown.onChange(handleChange);
      });
      break;

    case "search-file":
      setting.addSearch((search) => {
        new FileSuggest(search.inputEl, app);
        search.setPlaceholder(def.placeholder ?? "");
        search.setValue(def.getValue(plugin) as string);
        search.onChange(handleChange);
      });
      break;

    case "search-folder":
      setting.addSearch((search) => {
        new FolderSuggest(search.inputEl, app);
        search.setPlaceholder(def.placeholder ?? "");
        search.setValue(def.getValue(plugin) as string);
        search.onChange(handleChange);
      });
      break;
  }

  if (def.tooltip) {
    const tooltipIcon = setting.nameEl.createSpan({ cls: "th-tooltip-icon" });
    tooltipIcon.setAttribute("aria-label", def.tooltip);
    setIcon(tooltipIcon, "help-circle");
  }

  return setting;
}

export function renderSubsection(
  containerEl: HTMLElement,
  subsection: SubsectionDef,
  plugin: TaskPlannerPlugin,
  app: App,
  onRefresh?: () => void
): void {
  const subsectionEl = createSubsection(containerEl, subsection.label);
  for (const settingDef of subsection.settings) {
    renderSetting(subsectionEl, settingDef, plugin, app, onRefresh);
  }
}

export function renderSection(
  containerEl: HTMLElement,
  section: SectionDef,
  plugin: TaskPlannerPlugin,
  app: App,
  onRefresh?: () => void
): void {
  new Setting(containerEl).setName(section.heading).setHeading();

  for (const subsection of section.subsections) {
    renderSubsection(containerEl, subsection, plugin, app, onRefresh);
  }
}

export function renderFolderList(
  containerEl: HTMLElement,
  plugin: TaskPlannerPlugin,
  app: App,
  onRefresh: () => void
): void {
  let folderSearchInput: SearchComponent | undefined;

  new Setting(containerEl)
    .setName("Ignored folders")
    .setDesc("Folders to exclude from indexing")
    .addSearch((search) => {
      folderSearchInput = search;
      new FolderSuggest(search.inputEl, app);
      search.setPlaceholder("Example: archive");
    })
    .addButton((button) => {
      button.setIcon("plus");
      button.setTooltip("Add folder");
      button.onClick(async () => {
        if (!folderSearchInput) return;
        const newFolder = folderSearchInput.getValue();
        if (!newFolder) return;

        const folder = app.vault.getAbstractFileByPath(newFolder);
        if (!folder) {
          showError(containerEl, `Folder doesn't exist: ${newFolder}`);
          return;
        }

        if (!plugin.settings.ignoredFolders.includes(newFolder)) {
          plugin.settings.ignoredFolders.push(newFolder);
          await plugin.saveSettings();
          folderSearchInput.setValue("");
          onRefresh();
        }
      });
    });

  for (const folder of plugin.settings.ignoredFolders) {
    new Setting(containerEl).setName(folder).addButton((button) =>
      button.setButtonText("Remove").onClick(async () => {
        plugin.settings.ignoredFolders = plugin.settings.ignoredFolders.filter((f) => f !== folder);
        await plugin.saveSettings();
        onRefresh();
      })
    );
  }
}

function showError(containerEl: HTMLElement, message: string): void {
  const errorSpan = containerEl.createEl("span", { text: message, cls: "th-error" });
  setTimeout(() => errorSpan.remove(), 3000);
}
