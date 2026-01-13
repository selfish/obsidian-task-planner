import * as React from "react";

import { TodoItem, TodoStatus, getTodoId } from "../domain/TodoItem"
import { MarkdownView, Menu, TFile, setIcon } from "obsidian"
import { IDictionary } from "../domain/IDictionary"
import { TodoSubtasksContainer } from "./TodoSubtasksContainer";
import { TodoStatusComponent } from "./TodoStatusComponent"
import { Consts } from "../domain/Consts"
import { TodoFilter } from "../events/TodoListEvents"
import { FileOperations } from "../domain/FileOperations"
import { StandardDependencies } from "./StandardDependencies";
import { PwEvent } from "src/events/PwEvent";
import { Sound } from "./SoundPlayer";


function PriorityBadge({ priority }: { priority: string }) {
  const iconRef = React.useRef<HTMLSpanElement>(null);

  const iconMap: Record<string, string> = {
    'critical': 'zap',
    'highest': 'zap',
    'high': 'arrow-up',
    'medium': 'minus',
    'low': 'arrow-down',
    'lowest': 'arrow-down-circle',
  };

  React.useEffect(() => {
    if (iconRef.current && iconMap[priority]) {
      iconRef.current.innerHTML = '';
      setIcon(iconRef.current, iconMap[priority]);
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

function SelectedBadge() {
  const iconRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (iconRef.current) {
      iconRef.current.innerHTML = '';
      setIcon(iconRef.current, 'pin');
    }
  }, []);

  return (
    <span className="th-badge th-badge--selected">
      <span ref={iconRef} className="th-badge-icon"></span>
      Pinned
    </span>
  );
}

function getPriority(attributes: IDictionary<string | boolean> | undefined): string | null {
  if (!attributes) return null;

  const priorityAttr = attributes['priority'] || attributes['importance'];
  if (typeof priorityAttr === 'string') {
    const normalized = priorityAttr.toLowerCase();
    if (['critical', 'highest', 'high', 'medium', 'low', 'lowest'].includes(normalized)) {
      return normalized;
    }
  }
  return null;
}

function cleanWikiLinks(text: string): string {
  // Replace [[page]] with page, and [[page|alias]] with alias
  return text.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, page, bar, alias) => {
    return alias || page;
  });
}

function cleanFileName(fileName: string): string {
  // Remove .md extension
  let name = fileName.replace(/\.md$/, '');

  // Remove leading numbers, symbols, and whitespace (e.g., "2024-01-12 Note" -> "Note")
  const cleaned = name.replace(/^[\d- ]+/, '').trim();

  // If we removed everything, return the original (without extension)
  return cleaned || name;
}

function getDisplayName(file: TFile, app: App): string {
  // Try to get title from frontmatter
  const cache = app.metadataCache.getFileCache(file);
  const frontmatterTitle = cache?.frontmatter?.title;

  if (frontmatterTitle && typeof frontmatterTitle === 'string') {
    return frontmatterTitle;
  }

  // Fall back to cleaned filename
  return cleanFileName(file.name);
}

export interface TodoItemComponentProps {
  todo: TodoItem<TFile>,
  playSound?: PwEvent<Sound>,
  dontCrossCompleted?: boolean,
  deps: StandardDependencies,
  hideFileRef?: boolean,
}

export function TodoItemComponent({todo, deps, playSound, dontCrossCompleted, hideFileRef}: TodoItemComponentProps) {
  const app = deps.app;
  const settings = deps.settings;
	const fileOperations = new FileOperations(settings);

  async function openFileAsync(file: TFile, line: number, inOtherLeaf: boolean) {
    let leaf = app.workspace.getLeaf();
    if (inOtherLeaf) {
      leaf = app.workspace.getLeaf(true);
    } else if (leaf.getViewState().pinned) {
      leaf = app.workspace.getLeaf(false);
    }
    await leaf.openFile(file)
    let view = app.workspace.getActiveViewOfType(MarkdownView)
    const lineContent = await view.editor.getLine(line)
    view.editor.setSelection({ ch: 0, line }, { ch: lineContent.length, line })

    // Scroll to center the line in the viewport
    view.editor.scrollIntoView({
      from: { line, ch: 0 },
      to: { line, ch: lineContent.length }
    }, true)
  }

  function onClickContainer(ev: React.MouseEvent<HTMLDivElement, MouseEvent>) {
      if (ev.defaultPrevented) {
        return
      }
      openFileAsync(
        todo.file.file,
        todo.line || 0,
        ev.altKey || ev.ctrlKey || ev.metaKey,
      );
  }

  const addChangePriorityMenuItem = (menu: Menu, name: string, icon: string, label: string) => {
    if (name === todo.attributes?.["priority"]) {
      return
    }
    menu.addItem((item) => {
      item.setTitle(`Change priority to ${label}`)
      item.setIcon(icon)
      item.onClick((evt) => {
				fileOperations.updateAttributeAsync(todo, "priority", name).then()
      })
    })
  }

  function onAuxClickContainer(evt: any){
    if (evt.defaultPrevented) {
      return
    }
    const menu = new Menu();
    menu.setNoIcon()
    addChangePriorityMenuItem(menu, "critical", "zap", "Critical")
    addChangePriorityMenuItem(menu, "high", "arrow-up", "High")
    addChangePriorityMenuItem(menu, "medium", "minus", "Medium")
    addChangePriorityMenuItem(menu, "low", "arrow-down", "Low")
    addChangePriorityMenuItem(menu, "lowest", "arrow-down-circle", "Lowest")
    menu.addItem((item) => {
      item.setTitle("Reset priority")
      item.setIcon("reset")
      item.onClick((evt) => fileOperations.removeAttributeAsync(todo, "priority").then())
    })
    menu.addSeparator()
    menu.addItem((item) => {
      item.setTitle("Toggle pinned")
      item.setIcon("pin")
      item.onClick((evt) => {
				fileOperations.updateAttributeAsync(todo, settings.selectedAttribute, !todo.attributes?.[settings.selectedAttribute])
      })
    })
    menu.showAtMouseEvent(evt)
  }

  function onDragStart(ev: any) {
    const id = getTodoId(todo)
    ev.dataTransfer.setData(Consts.TodoItemDragType, id)
  }

  const isSelected = !!todo.attributes?.[settings.selectedAttribute];
  const priority = getPriority(todo.attributes);
  const isCompleted = todo.status === TodoStatus.Complete || todo.status === TodoStatus.Canceled;
  const cardClassName = `th-task-card ${isCompleted ? 'th-task-card--completed' : ''}`;
  const textClassName = `th-task-text ${!dontCrossCompleted && isCompleted ? 'th-task-text--completed' : ''}`;

  return (
    <div className={cardClassName} draggable="true" onDragStart={onDragStart} onClick={onClickContainer} onAuxClick={onAuxClickContainer}>
      <div className="th-task-content">
        <TodoStatusComponent
          todo={todo}
          deps={{ logger: deps.logger, app: app }}
          settings={settings}
          playSound={playSound}
        />
        <div className="th-task-body">
          <div className={textClassName}>
            {cleanWikiLinks(todo.text)}
          </div>
          {!hideFileRef && (
            <div className="th-task-file-ref">
              {getDisplayName(todo.file.file, app)}
            </div>
          )}
          {(priority || isSelected) && (
            <div className="th-task-metadata">
              {priority && <PriorityBadge priority={priority} />}
              {isSelected && <SelectedBadge />}
            </div>
          )}
          <TodoSubtasksContainer
            subtasks={todo.subtasks}
            deps={deps}
            key={"Subtasks-" + todo.text}
            dontCrossCompleted={true}
          />
        </div>
      </div>
    </div>
  );
}
