import * as React from "react";
import { TodoItem, TodoStatus, getTodoId } from "../types/todo";
import { App, MarkdownView, Menu, TFile, setIcon } from "obsidian";
import { TodoSubtasksContainer } from "./TodoSubtasksContainer";
import { TodoStatusComponent } from "./TodoStatusComponent";
import { Consts } from "../types/constants";
import { FileOperations } from "../core/operations/file-operations";
import { StandardDependencies } from "./StandardDependencies";

interface PriorityBadgeProps {
  priority: string;
}

const PRIORITY_ICON_MAP: Record<string, string> = {
  critical: "zap",
  highest: "zap",
  high: "arrow-up",
  medium: "minus",
  low: "arrow-down",
  lowest: "arrow-down-circle",
};

function PriorityBadge({ priority }: PriorityBadgeProps): React.ReactElement {
  const iconRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (iconRef.current && PRIORITY_ICON_MAP[priority]) {
      iconRef.current.replaceChildren();
      setIcon(iconRef.current, PRIORITY_ICON_MAP[priority]);
    }
  }, [priority]);

  const label = priority.charAt(0).toUpperCase() + priority.slice(1);

  return (
    <span className={`th-badge th-badge--priority-${priority}`}>
      <span ref={iconRef} className="th-badge-icon"></span>
      {label}
    </span>
  );
}

function SelectedBadge(): React.ReactElement {
  const iconRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (iconRef.current) {
      iconRef.current.replaceChildren();
      setIcon(iconRef.current, "pin");
    }
  }, []);

  return (
    <span className="th-badge th-badge--selected">
      <span ref={iconRef} className="th-badge-icon"></span>
      Pinned
    </span>
  );
}

function getPriority(attributes: Record<string, string | boolean> | undefined): string | null {
  if (!attributes) return null;

  const priorityAttr = attributes["priority"] || attributes["importance"];
  if (typeof priorityAttr === "string") {
    const normalized = priorityAttr.toLowerCase();
    if (["critical", "highest", "high", "medium", "low", "lowest"].includes(normalized)) {
      return normalized;
    }
  }
  return null;
}

function cleanWikiLinks(text: string): string {
  return text.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, page, bar, alias) => {
    return alias || page;
  });
}

function cleanFileName(fileName: string): string {
  const name = fileName.replace(/\.md$/, "");
  const cleaned = name.replace(/^[\d- ]+/, "").trim();
  return cleaned || name;
}

function getDisplayName(file: TFile, app: App): string {
  const cache = app.metadataCache.getFileCache(file);
  const frontmatterTitle = cache?.frontmatter?.title;

  if (frontmatterTitle && typeof frontmatterTitle === "string") {
    return frontmatterTitle;
  }

  return cleanFileName(file.name);
}

export interface TodoItemComponentProps {
  todo: TodoItem<TFile>;
  dontCrossCompleted?: boolean;
  deps: StandardDependencies;
  hideFileRef?: boolean;
}

export function TodoItemComponent({ todo, deps, dontCrossCompleted, hideFileRef }: TodoItemComponentProps): React.ReactElement {
  const app = deps.app;
  const settings = deps.settings;
  const fileOperations = new FileOperations(settings);

  async function openFileAsync(file: TFile, line: number, inOtherLeaf: boolean): Promise<void> {
    let leaf = app.workspace.getLeaf();
    if (inOtherLeaf) {
      leaf = app.workspace.getLeaf(true);
    } else if (leaf.getViewState().pinned) {
      leaf = app.workspace.getLeaf(false);
    }
    await leaf.openFile(file);
    const view = app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;

    const lineContent = view.editor.getLine(line);
    view.editor.setSelection({ ch: 0, line }, { ch: lineContent.length, line });
    view.editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: lineContent.length } }, true);
  }

  function onClickContainer(ev: React.MouseEvent<HTMLDivElement, MouseEvent>): void {
    if (ev.defaultPrevented) return;
    openFileAsync(todo.file.file, todo.line || 0, ev.altKey || ev.ctrlKey || ev.metaKey);
  }

  function addChangePriorityMenuItem(menu: Menu, name: string, icon: string, label: string): void {
    if (name === todo.attributes?.["priority"]) return;

    menu.addItem((item) => {
      item.setTitle(`Change priority to ${label}`);
      item.setIcon(icon);
      item.onClick(() => {
        fileOperations.updateAttributeAsync(todo, "priority", name);
      });
    });
  }

  function onAuxClickContainer(evt: React.MouseEvent): void {
    if (evt.defaultPrevented) return;

    const menu = new Menu();
    menu.setNoIcon();
    addChangePriorityMenuItem(menu, "critical", "zap", "Critical");
    addChangePriorityMenuItem(menu, "high", "arrow-up", "High");
    addChangePriorityMenuItem(menu, "medium", "minus", "Medium");
    addChangePriorityMenuItem(menu, "low", "arrow-down", "Low");
    addChangePriorityMenuItem(menu, "lowest", "arrow-down-circle", "Lowest");
    menu.addItem((item) => {
      item.setTitle("Reset priority");
      item.setIcon("reset");
      item.onClick(() => fileOperations.removeAttributeAsync(todo, "priority"));
    });
    menu.addSeparator();
    menu.addItem((item) => {
      item.setTitle("Toggle pinned");
      item.setIcon("pin");
      item.onClick(() => {
        fileOperations.updateAttributeAsync(todo, settings.selectedAttribute, !todo.attributes?.[settings.selectedAttribute]);
      });
    });
    menu.showAtMouseEvent(evt.nativeEvent);
  }

  function onDragStart(ev: React.DragEvent): void {
    const id = getTodoId(todo);
    ev.dataTransfer.setData(Consts.TodoItemDragType, id);
  }

  const isSelected = !!todo.attributes?.[settings.selectedAttribute];
  const priority = getPriority(todo.attributes);
  const isCompleted = todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled;
  const cardClassName = `th-task-card ${isCompleted ? "th-task-card--completed" : ""}`;
  const textClassName = `th-task-text ${!dontCrossCompleted && isCompleted ? "th-task-text--completed" : ""}`;

  return (
    <div className={cardClassName} draggable="true" onDragStart={onDragStart} onClick={onClickContainer} onAuxClick={onAuxClickContainer}>
      <div className="th-task-content">
        <TodoStatusComponent todo={todo} deps={{ logger: deps.logger, app: app }} settings={settings} />
        <div className="th-task-body">
          <div className={textClassName}>{cleanWikiLinks(todo.text)}</div>
          {!hideFileRef && <div className="th-task-file-ref">{getDisplayName(todo.file.file, app)}</div>}
          {(priority || isSelected) && (
            <div className="th-task-metadata">
              {priority && <PriorityBadge priority={priority} />}
              {isSelected && <SelectedBadge />}
            </div>
          )}
          <TodoSubtasksContainer subtasks={todo.subtasks} deps={deps} key={"Subtasks-" + todo.text} dontCrossCompleted={true} />
        </div>
      </div>
    </div>
  );
}
