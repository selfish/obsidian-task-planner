import * as React from "react";
import { TodoItem, TodoStatus, getTodoId } from "../types/todo";
import { MarkdownView, Menu, TFile, setIcon } from "obsidian";
import { TodoSubtasksContainer } from "./todo-subtasks-container";
import { TodoStatusComponent } from "./todo-status-component";
import { Consts } from "../types/constants";
import { FileOperations } from "../core/operations/file-operations";
import { StandardDependencies } from "./standard-dependencies";
import { getFileDisplayName } from "../utils/file-utils";

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

function cleanWikiLinks(text: string): string {
  return text.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, page, bar, alias) => {
    return alias || page;
  });
}

function InlineTag({ tag }: { tag: string }): React.ReactElement {
  const iconRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (iconRef.current) {
      iconRef.current.replaceChildren();
      setIcon(iconRef.current, "hash");
    }
  }, []);

  return (
    <span className="tag">
      <span ref={iconRef} className="icon"></span>
      <span className="tag-text">{tag}</span>
    </span>
  );
}

function renderTextWithTags(text: string): React.ReactNode[] {
  const cleanedText = cleanWikiLinks(text);
  const parts: React.ReactNode[] = [];
  const regex = /#([a-zA-Z][a-zA-Z0-9_-]*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(cleanedText)) !== null) {
    // Add text before the tag
    if (match.index > lastIndex) {
      parts.push(cleanedText.slice(lastIndex, match.index));
    }
    // Add the styled tag with icon
    parts.push(<InlineTag key={match.index} tag={match[1]} />);
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last tag
  if (lastIndex < cleanedText.length) {
    parts.push(cleanedText.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [cleanedText];
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
    menu.addItem((item) => {
      item.setTitle("Toggle pinned");
      item.setIcon("pin");
      item.onClick(() => {
        void fileOperations.updateAttribute(todo, settings.selectedAttribute, !todo.attributes?.[settings.selectedAttribute]);
      });
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

  return (
    <div className={cardClasses} draggable="true" onDragStart={onDragStart} onClick={onClickContainer} onAuxClick={onAuxClickContainer}>
      <div className="content">
        <TodoStatusComponent todo={todo} deps={{ logger: deps.logger, app: app }} settings={settings} />
        <div className="body">
          <div className={textClasses}>{renderTextWithTags(todo.text)}</div>
          {!hideFileRef && <div className="file-ref">{getFileDisplayName(todo.file.file, app)}</div>}
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
