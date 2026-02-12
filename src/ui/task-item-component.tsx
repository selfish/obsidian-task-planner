import { MarkdownView, Menu, TFile, setIcon } from "obsidian";

import * as React from "react";

import { useFileDisplayName, useIconRef } from "./hooks";
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
import { getAllDateOptions } from "../utils/date-utils";
import { getDueDateInfo } from "../utils/due-date-utils";
import { setFrontmatterProperty, removeFrontmatterProperty } from "../utils/file-utils";
import { Moment } from "../utils/moment";
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
  const iconRef = useIconRef(PRIORITY_ICON_MAP[priority] ?? "minus");
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);

  return (
    <span className={`badge priority ${priority}`}>
      <span ref={iconRef} className="icon"></span>
      {label}
    </span>
  );
}

function PinnedBadge(): React.ReactElement {
  const iconRef = useIconRef("pin");

  return (
    <span className="badge pinned">
      <span ref={iconRef} className="icon"></span>
    </span>
  );
}

function IgnoredBadge({ type }: { type: "task" | "file" }): React.ReactElement {
  const iconRef = useIconRef(type === "file" ? "file-x" : "eye-off");

  return (
    <span className="badge ignored" title={type === "file" ? "Note ignored" : "Task ignored"}>
      <span ref={iconRef} className="icon"></span>
    </span>
  );
}

interface DueDateBadgeProps {
  dueDate: Moment;
}

function DueDateBadge({ dueDate }: DueDateBadgeProps): React.ReactElement {
  const { label, variant } = getDueDateInfo(dueDate);
  const iconRef = useIconRef(variant === "overdue" ? "alert-triangle" : "calendar");

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
  const { app, settings } = deps;
  const fileOperations = new FileOperations(settings);
  const fileDisplayName = useFileDisplayName(todo.file.file, app);

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
    const dateOptions = getAllDateOptions();

    const addDateOptionsToMenu = (sub: Menu, onSelect: (date: string | null) => void) => {
      // Immediate options (Today, Tomorrow)
      for (const opt of dateOptions.immediate) {
        sub.addItem((i) => {
          i.setTitle(opt.label);
          i.setIcon(opt.icon);
          i.onClick(() => onSelect(opt.getDate(settings.firstWeekday)));
        });
      }

      sub.addSeparator();

      // Week options (Next week, In a week)
      for (const opt of dateOptions.week) {
        sub.addItem((i) => {
          i.setTitle(opt.label);
          i.setIcon(opt.icon);
          i.onClick(() => onSelect(opt.getDate(settings.firstWeekday)));
        });
      }

      sub.addSeparator();

      // Month options (Next month, In a month)
      for (const opt of dateOptions.month) {
        sub.addItem((i) => {
          i.setTitle(opt.label);
          i.setIcon(opt.icon);
          i.onClick(() => onSelect(opt.getDate(settings.firstWeekday)));
        });
      }

      sub.addSeparator();

      // Backlog option
      sub.addItem((i) => {
        i.setTitle(dateOptions.backlog.label);
        i.setIcon(dateOptions.backlog.icon);
        i.onClick(() => onSelect(null));
      });
    };

    menu.addSeparator();
    menu.addItem((item) => {
      item.setTitle("Reschedule");
      item.setIcon("calendar");
      const sub = addSubmenu(item);
      addDateOptionsToMenu(sub, (date) => {
        if (date === null) {
          void fileOperations.removeAttribute(todo, settings.dueDateAttribute);
        } else {
          void fileOperations.updateAttribute(todo, settings.dueDateAttribute, date);
        }
      });
    });

    // === Follow-up Submenu ===
    const followUpCreator = new FollowUpCreator<TFile>(settings);
    const createFollowUp = async (dueDate: string | null, completeOriginal?: boolean) => {
      try {
        await followUpCreator.createFollowUp(todo, dueDate, { completeOriginal });
        if (completeOriginal) {
          showSuccessNotice("Task completed with follow-up reminder");
        } else {
          showSuccessNotice("Follow-up created");
        }
      } catch (error) {
        showErrorNotice(error instanceof Error ? error : new Error(String(error)));
      }
    };

    menu.addItem((item) => {
      item.setTitle("Follow-up");
      item.setIcon("copy-plus");
      const sub = addSubmenu(item);
      addDateOptionsToMenu(sub, (date) => void createFollowUp(date, false));
    });

    menu.addItem((item) => {
      item.setTitle("Complete & follow-up");
      item.setIcon("check-circle");
      const sub = addSubmenu(item);
      addDateOptionsToMenu(sub, (date) => void createFollowUp(date, true));
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
