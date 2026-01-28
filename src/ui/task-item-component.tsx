import { MarkdownView, Menu, TFile, setIcon } from "obsidian";

import * as React from "react";

import { MarkdownText } from "./markdown-text";
import { ColumnType } from "./planning-task-column";
import { StandardDependencies } from "./standard-dependencies";
import { TodoStatusComponent } from "./task-status-component";
import { TodoSubtasksContainer } from "./task-subtasks-container";
import { FileOperations } from "../core/operations/file-operations";
import { FollowUpCreator } from "../core/services/follow-up-creator";
import { showSuccessNotice, showErrorNotice } from "../lib/user-notice";
import { Consts } from "../types/constants";
import { TaskItem, TaskStatus, getTaskId } from "../types/task";
import { getFileDisplayName, setFrontmatterProperty, removeFrontmatterProperty } from "../utils/file-utils";
import { moment, Moment } from "../utils/moment";
import { findTaskDate } from "../utils/task-utils";

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

function PinnedBadge(): React.ReactElement {
  const iconRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (iconRef.current) {
      iconRef.current.replaceChildren();
      setIcon(iconRef.current, "pin");
    }
  }, []);

  return (
    <span className="badge pinned">
      <span ref={iconRef} className="icon"></span>
    </span>
  );
}

function IgnoredBadge({ type }: { type: "task" | "file" }): React.ReactElement {
  const iconRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (iconRef.current) {
      iconRef.current.replaceChildren();
      setIcon(iconRef.current, type === "file" ? "file-x" : "eye-off");
    }
  }, [type]);

  return (
    <span className="badge ignored" title={type === "file" ? "Note ignored" : "Task ignored"}>
      <span ref={iconRef} className="icon"></span>
    </span>
  );
}

interface DueDateBadgeProps {
  dueDate: Moment;
}

function getDueDateInfo(dueDate: Moment): { label: string; variant: "overdue" | "today" | "tomorrow" | "future" } {
  const today = moment().startOf("day");
  const tomorrow = today.clone().add(1, "day");

  if (dueDate.isBefore(today)) {
    return { label: "Overdue", variant: "overdue" };
  }
  if (dueDate.isSame(today, "day")) {
    return { label: "Due: Today", variant: "today" };
  }
  if (dueDate.isSame(tomorrow, "day")) {
    return { label: "Due: Tomorrow", variant: "tomorrow" };
  }
  return { label: `Due: ${dueDate.format("MMM D")}`, variant: "future" };
}

function DueDateBadge({ dueDate }: DueDateBadgeProps): React.ReactElement {
  const iconRef = React.useRef<HTMLSpanElement>(null);
  const { label, variant } = getDueDateInfo(dueDate);

  React.useEffect(() => {
    if (iconRef.current) {
      iconRef.current.replaceChildren();
      setIcon(iconRef.current, variant === "overdue" ? "alert-triangle" : "calendar");
    }
  }, [variant]);

  return (
    <span className={`badge due-date ${variant}`} title={`Due: ${dueDate.format("YYYY-MM-DD")}`}>
      <span ref={iconRef} className="icon"></span>
      {label}
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
  todo: TaskItem<TFile>;
  dontCrossCompleted?: boolean;
  deps: StandardDependencies;
  hideFileRef?: boolean;
  /** Column type for context-specific rendering (e.g., due date badges in in-progress) */
  columnType?: ColumnType;
}

export function TodoItemComponent({ todo, deps, dontCrossCompleted, hideFileRef, columnType }: TodoItemComponentProps): React.ReactElement {
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

  function onAuxClickContainer(evt: React.MouseEvent): void {
    if (evt.defaultPrevented) return;

    const menu = new Menu();
    (menu as Menu & { dom: HTMLElement }).dom.addClass("task-planner-menu");
    const isCompleted = todo.status === TaskStatus.Complete || todo.status === TaskStatus.Canceled;
    const isPinned = !!todo.attributes?.[settings.selectedAttribute];
    const currentPriority = todo.attributes?.["priority"];

    // Helper to create submenu using Obsidian's internal API (not public but widely used)
    const addSubmenu = (item: unknown): Menu => (item as { setSubmenu: () => Menu }).setSubmenu();

    // === Status options (inline) ===
    const statuses = [
      { status: TaskStatus.Todo, label: "Todo", icon: "circle" },
      { status: TaskStatus.InProgress, label: "In progress", icon: "clock" },
      { status: TaskStatus.Complete, label: "Complete", icon: "check-circle" },
      { status: TaskStatus.AttentionRequired, label: "Needs attention", icon: "alert-circle" },
      { status: TaskStatus.Delegated, label: "Delegated", icon: "users" },
      { status: TaskStatus.Canceled, label: "Cancelled", icon: "x-circle" },
    ];
    for (const s of statuses) {
      if (s.status !== todo.status) {
        menu.addItem((item) => {
          item.setTitle(s.label);
          item.setIcon(s.icon);
          item.onClick(() => {
            const updatedTodo = { ...todo, status: s.status };
            void fileOperations.updateTaskStatus(updatedTodo, settings.completedDateAttribute);
          });
        });
      }
    }

    menu.addSeparator();

    menu.addItem((item) => {
      item.setTitle(isPinned ? "Unpin" : "Pin to top");
      item.setIcon("pin");
      item.onClick(() => {
        void fileOperations.updateAttribute(todo, settings.selectedAttribute, !isPinned);
      });
    });

    // === Priority options (inline) ===
    if (!isCompleted) {
      menu.addSeparator();
      const priorities = [
        { name: "critical", label: "Critical", icon: "zap" },
        { name: "high", label: "High", icon: "chevron-up" },
        { name: "medium", label: "Medium", icon: "minus" },
        { name: "low", label: "Low", icon: "chevron-down" },
        { name: "lowest", label: "Lowest", icon: "chevrons-down" },
      ];
      for (const p of priorities) {
        if (p.name !== currentPriority) {
          menu.addItem((item) => {
            item.setTitle(p.label);
            item.setIcon(p.icon);
            item.onClick(() => void fileOperations.updateAttribute(todo, "priority", p.name));
          });
        }
      }
      if (currentPriority) {
        menu.addItem((item) => {
          item.setTitle("Clear priority");
          item.setIcon("x");
          item.onClick(() => void fileOperations.removeAttribute(todo, "priority"));
        });
      }
    }

    // === Reschedule Submenu ===
    menu.addSeparator();
    menu.addItem((item) => {
      item.setTitle("Reschedule");
      item.setIcon("calendar");
      const sub = addSubmenu(item);
      sub.addItem((i) => {
        i.setTitle("Today");
        i.setIcon("calendar-check");
        i.onClick(() => void fileOperations.updateAttribute(todo, settings.dueDateAttribute, moment().format("YYYY-MM-DD")));
      });
      sub.addItem((i) => {
        i.setTitle("Tomorrow");
        i.setIcon("calendar-plus");
        i.onClick(() => void fileOperations.updateAttribute(todo, settings.dueDateAttribute, moment().add(1, "day").format("YYYY-MM-DD")));
      });
      sub.addItem((i) => {
        i.setTitle("Next week");
        i.setIcon("calendar-range");
        i.onClick(() => void fileOperations.updateAttribute(todo, settings.dueDateAttribute, moment().add(1, "week").format("YYYY-MM-DD")));
      });
      sub.addItem((i) => {
        i.setTitle("Next month");
        i.setIcon("calendar-days");
        i.onClick(() => void fileOperations.updateAttribute(todo, settings.dueDateAttribute, moment().add(1, "month").format("YYYY-MM-DD")));
      });
      sub.addSeparator();
      sub.addItem((i) => {
        i.setTitle("Backlog (remove date)");
        i.setIcon("calendar-off");
        i.onClick(() => void fileOperations.removeAttribute(todo, settings.dueDateAttribute));
      });
    });

    // === Follow-up Submenu ===
    const followUpCreator = new FollowUpCreator<TFile>(settings);
    const createFollowUp = async (dueDate: string | null) => {
      try {
        await followUpCreator.createFollowUp(todo, dueDate);
        showSuccessNotice("Follow-up created");
      } catch (error) {
        showErrorNotice(error instanceof Error ? error : new Error(String(error)));
      }
    };

    menu.addItem((item) => {
      item.setTitle("Follow-up");
      item.setIcon("copy-plus");
      const sub = addSubmenu(item);
      sub.addItem((i) => {
        i.setTitle("Today");
        i.setIcon("calendar-check");
        i.onClick(() => void createFollowUp(moment().format("YYYY-MM-DD")));
      });
      sub.addItem((i) => {
        i.setTitle("Tomorrow");
        i.setIcon("calendar-plus");
        i.onClick(() => void createFollowUp(moment().add(1, "day").format("YYYY-MM-DD")));
      });
      sub.addItem((i) => {
        i.setTitle("Next week");
        i.setIcon("calendar-range");
        i.onClick(() => void createFollowUp(moment().add(1, "week").format("YYYY-MM-DD")));
      });
      sub.addItem((i) => {
        i.setTitle("Next month");
        i.setIcon("calendar-days");
        i.onClick(() => void createFollowUp(moment().add(1, "month").format("YYYY-MM-DD")));
      });
      sub.addSeparator();
      sub.addItem((i) => {
        i.setTitle("Backlog (no date)");
        i.setIcon("calendar-off");
        i.onClick(() => void createFollowUp(null));
      });
    });

    // === Tags ===
    if (todo.tags && todo.tags.length > 0) {
      menu.addSeparator();
      for (const tag of todo.tags) {
        menu.addItem((item) => {
          item.setTitle(`Remove #${tag}`);
          item.setIcon("cross");
          item.onClick(() => void fileOperations.removeTag(todo, tag));
        });
      }
    }

    // === Ignore options ===
    // Show only relevant options based on current ignore state
    const isTaskIgnored = todo.attributes?.["ignore"] === true || todo.attributes?.["ignore"] === "true";
    const isFileIgnored = todo.file.shouldIgnore?.() === true;

    menu.addSeparator();

    if (isFileIgnored) {
      // File is ignored - only show option to un-ignore the note
      menu.addItem((item) => {
        item.setTitle("Stop ignoring this note");
        item.setIcon("file-check");
        item.onClick(async () => {
          await removeFrontmatterProperty(app, todo.file.file, "task-planner-ignore");
          showSuccessNotice("Note will now appear in planning views");
        });
      });
    } else if (isTaskIgnored) {
      // Task is ignored - only show option to un-ignore the task
      menu.addItem((item) => {
        item.setTitle("Stop ignoring task");
        item.setIcon("eye");
        item.onClick(() => {
          void fileOperations.removeAttribute(todo, "ignore");
          showSuccessNotice("Task will now appear in planning views");
        });
      });
    } else {
      // Nothing is ignored - show both ignore options
      menu.addItem((item) => {
        item.setTitle("Ignore task");
        item.setIcon("eye-off");
        item.onClick(() => {
          void fileOperations.updateAttribute(todo, "ignore", true);
          showSuccessNotice("Task ignored");
        });
      });
      menu.addItem((item) => {
        item.setTitle("Ignore this note");
        item.setIcon("file-x");
        item.onClick(async () => {
          await setFrontmatterProperty(app, todo.file.file, "task-planner-ignore", true);
          showSuccessNotice("Note ignored");
        });
      });
    }

    menu.showAtMouseEvent(evt.nativeEvent);
  }

  function onDragStart(ev: React.DragEvent): void {
    // Stop propagation to prevent parent cards from overwriting drag data
    ev.stopPropagation();
    const id = getTaskId(todo);
    ev.dataTransfer.setData(Consts.TaskItemDragType, id);
  }

  const isSelected = !!todo.attributes?.[settings.selectedAttribute];
  const priority = getPriority(todo.attributes);
  const isCompleted = todo.status === TaskStatus.Complete || todo.status === TaskStatus.Canceled;
  const isTaskIgnored = todo.attributes?.["ignore"] === true || todo.attributes?.["ignore"] === "true";
  const isFileIgnored = todo.file.shouldIgnore?.() === true;
  const cardClasses = ["card", isCompleted && "completed"].filter(Boolean).join(" ");
  const textClasses = ["text", !dontCrossCompleted && isCompleted && "completed"].filter(Boolean).join(" ");

  // Show due date badge in the in-progress column
  const showDueDateBadge = columnType === "today-in-progress";
  const dueDate = showDueDateBadge ? findTaskDate(todo, settings.dueDateAttribute) : null;

  function onKeyDown(ev: React.KeyboardEvent<HTMLDivElement>): void {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      void openFileAsync(todo.file.file, todo.line || 0, ev.altKey || ev.ctrlKey || ev.metaKey);
    }
  }

  return (
    <div className={cardClasses} draggable="true" onDragStart={onDragStart} onClick={onClickContainer} onAuxClick={onAuxClickContainer} onKeyDown={onKeyDown} tabIndex={0} role="button" aria-label={`Task: ${todo.text}`}>
      <div className="content">
        <TodoStatusComponent todo={todo} deps={{ logger: deps.logger, app: app }} settings={settings} />
        <div className="body">
          <MarkdownText text={todo.text} app={app} sourcePath={todo.file.file.path} className={textClasses} />
          {!hideFileRef && <div className="file-ref">{fileDisplayName}</div>}
          {(priority || isSelected || isFileIgnored || isTaskIgnored || dueDate) && (
            <div className="meta">
              {isSelected && <PinnedBadge />}
              {dueDate && <DueDateBadge dueDate={dueDate} />}
              {isFileIgnored && <IgnoredBadge type="file" />}
              {isTaskIgnored && <IgnoredBadge type="task" />}
              {priority && <PriorityBadge priority={priority} />}
            </div>
          )}
          <TodoSubtasksContainer subtasks={todo.subtasks} deps={deps} key={"Subtasks-" + todo.text} dontCrossCompleted={true} />
        </div>
      </div>
    </div>
  );
}
