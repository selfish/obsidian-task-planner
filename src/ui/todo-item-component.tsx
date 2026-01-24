import { MarkdownView, Menu, TFile, setIcon } from "obsidian";

import * as React from "react";

import { MarkdownText } from "./markdown-text";
import { StandardDependencies } from "./standard-dependencies";
import { TodoStatusComponent } from "./todo-status-component";
import { TodoSubtasksContainer } from "./todo-subtasks-container";
import { FileOperations } from "../core/operations/file-operations";
import { FollowUpCreator } from "../core/services/follow-up-creator";
import { showSuccessNotice, showErrorNotice } from "../lib/user-notice";
import { Consts } from "../types/constants";
import { TodoItem, TodoStatus, getTodoId } from "../types/todo";
import { getFileDisplayName } from "../utils/file-utils";
import { moment } from "../utils/moment";

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
    <span className={`badge priority ${priority}`}>
      <span ref={iconRef} className="icon"></span>
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
    <span className="badge selected">
      <span ref={iconRef} className="icon"></span>
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

  // Use state for file display name to handle metadata cache updates
  const [fileDisplayName, setFileDisplayName] = React.useState(() => getFileDisplayName(todo.file.file, app));

  // Listen for metadata cache changes to update display name
  React.useEffect(() => {
    // Update immediately in case cache changed
    setFileDisplayName(getFileDisplayName(todo.file.file, app));

    // Listen for cache updates on this file
    const onCacheChanged = (changedFile: TFile) => {
      if (changedFile.path === todo.file.file.path) {
        setFileDisplayName(getFileDisplayName(todo.file.file, app));
      }
    };

    const ref = app.metadataCache.on("changed", onCacheChanged as () => void);
    return () => {
      app.metadataCache.offref(ref);
    };
  }, [todo.file.file, app]);

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
    void openFileAsync(todo.file.file, todo.line || 0, ev.altKey || ev.ctrlKey || ev.metaKey);
  }

  function addChangePriorityMenuItem(menu: Menu, name: string, icon: string, label: string): void {
    if (name === todo.attributes?.["priority"]) return;

    menu.addItem((item) => {
      item.setTitle(`Change priority to ${label}`);
      item.setIcon(icon);
      item.onClick(() => {
        void fileOperations.updateAttribute(todo, "priority", name);
      });
    });
  }

  function addChangeStatusMenuItem(menu: Menu, status: TodoStatus, label: string, icon: string): void {
    if (status === todo.status) return;

    menu.addItem((item) => {
      item.setTitle(label);
      item.setIcon(icon);
      item.onClick(() => {
        const updatedTodo = { ...todo, status };
        void fileOperations.updateTodoStatus(updatedTodo, settings.completedDateAttribute);
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
      item.onClick(() => void fileOperations.removeAttribute(todo, "priority"));
    });
    menu.addSeparator();

    // Status change options
    addChangeStatusMenuItem(menu, TodoStatus.Todo, "Set status: Todo", "circle");
    addChangeStatusMenuItem(menu, TodoStatus.InProgress, "Set status: In Progress", "clock");
    addChangeStatusMenuItem(menu, TodoStatus.Complete, "Set status: Complete", "check-circle");
    addChangeStatusMenuItem(menu, TodoStatus.AttentionRequired, "Set status: Attention Required", "alert-circle");
    addChangeStatusMenuItem(menu, TodoStatus.Delegated, "Set status: Delegated", "users");
    addChangeStatusMenuItem(menu, TodoStatus.Canceled, "Set status: Cancelled", "x-circle");
    menu.addSeparator();

    menu.addItem((item) => {
      item.setTitle("Toggle pinned");
      item.setIcon("pin");
      item.onClick(() => {
        void fileOperations.updateAttribute(todo, settings.selectedAttribute, !todo.attributes?.[settings.selectedAttribute]);
      });
    });

    // Follow-up tasks
    menu.addSeparator();

    const followUpCreator = new FollowUpCreator<TFile>(settings);
    const createFollowUp = async (dueDate: string | null) => {
      try {
        await followUpCreator.createFollowUp(todo, dueDate);
        showSuccessNotice("Follow-up task created");
      } catch (error) {
        showErrorNotice(error instanceof Error ? error : new Error(String(error)));
      }
    };

    menu.addItem((item) => {
      item.setTitle("Follow-up → today");
      item.setIcon("calendar-check");
      item.onClick(() => void createFollowUp(moment().format("YYYY-MM-DD")));
    });

    menu.addItem((item) => {
      item.setTitle("Follow-up → tomorrow");
      item.setIcon("calendar-plus");
      item.onClick(() => void createFollowUp(moment().add(1, "day").format("YYYY-MM-DD")));
    });

    menu.addItem((item) => {
      item.setTitle("Follow-up → next week");
      item.setIcon("calendar-range");
      item.onClick(() => void createFollowUp(moment().add(1, "week").format("YYYY-MM-DD")));
    });

    menu.addItem((item) => {
      item.setTitle("Follow-up → backlog");
      item.setIcon("inbox");
      item.onClick(() => void createFollowUp(null));
    });

    // Tag management
    if (todo.tags && todo.tags.length > 0) {
      menu.addSeparator();
      for (const tag of todo.tags) {
        menu.addItem((item) => {
          item.setTitle(`Remove #${tag}`);
          item.setIcon("x");
          item.onClick(() => {
            void fileOperations.removeTag(todo, tag);
          });
        });
      }
    }

    menu.showAtMouseEvent(evt.nativeEvent);
  }

  function onDragStart(ev: React.DragEvent): void {
    const id = getTodoId(todo);
    ev.dataTransfer.setData(Consts.TodoItemDragType, id);
  }

  const isSelected = !!todo.attributes?.[settings.selectedAttribute];
  const priority = getPriority(todo.attributes);
  const isCompleted = todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled;
  const cardClasses = ["card", isCompleted && "completed"].filter(Boolean).join(" ");
  const textClasses = ["text", !dontCrossCompleted && isCompleted && "completed"].filter(Boolean).join(" ");

  function onKeyDown(ev: React.KeyboardEvent<HTMLDivElement>): void {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      void openFileAsync(todo.file.file, todo.line || 0, ev.altKey || ev.ctrlKey || ev.metaKey);
    }
  }

  return (
    <div
      className={cardClasses}
      draggable="true"
      onDragStart={onDragStart}
      onClick={onClickContainer}
      onAuxClick={onAuxClickContainer}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Task: ${todo.text}`}
    >
      <div className="content">
        <TodoStatusComponent todo={todo} deps={{ logger: deps.logger, app: app }} settings={settings} />
        <div className="body">
          <MarkdownText text={todo.text} app={app} sourcePath={todo.file.file.path} className={textClasses} />
          {!hideFileRef && <div className="file-ref">{fileDisplayName}</div>}
          {(priority || isSelected) && (
            <div className="meta">
              {isSelected && <SelectedBadge />}
              {priority && <PriorityBadge priority={priority} />}
            </div>
          )}
          <TodoSubtasksContainer subtasks={todo.subtasks} deps={deps} key={"Subtasks-" + todo.text} dontCrossCompleted={true} />
        </div>
      </div>
    </div>
  );
}
