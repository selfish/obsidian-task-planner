import { App, TFile, setIcon } from "obsidian";
import * as React from "react";
import { Consts } from "src/domain/Consts";
import { TodoItem } from "src/domain/TodoItem";
import { TodoFilter } from "src/events/TodoListEvents";
import { ProletarianWizardSettings } from "src/domain/ProletarianWizardSettings";
import { ILogger } from "src/domain/ILogger";
import { TodoListComponent } from "./TodoListComponent";
import { PwEvent } from "src/events/PwEvent";
import { Sound } from "./SoundPlayer";

export interface PlanningTodoColumnDeps {
  app: App,
  settings: ProletarianWizardSettings,
  logger: ILogger,
}

export interface PlanningTodoColumnProps {
  icon: string,
  title: string,
  todos: TodoItem<TFile>[],
  onTodoDropped: ((todoId: string) => void) | null,
  onBatchTodoDropped?: ((todoIds: string[]) => Promise<void>) | null,
  hideIfEmpty: boolean,
  deps: PlanningTodoColumnDeps,
  substyle?: string,
  playSound?: PwEvent<Sound>,
}

const CLASSNAME_NORMAL = "";
const CLASSNAME_HOVER = "th-column-content--hover";

export function PlanningTodoColumn({icon, title, hideIfEmpty, onTodoDropped, onBatchTodoDropped, todos, deps, substyle, playSound}: PlanningTodoColumnProps) {

  const [hoverClassName, setHoverClassName] = React.useState(CLASSNAME_NORMAL);
  const iconRef = React.useRef<HTMLSpanElement>(null);

  // Set Obsidian icon on mount and when icon prop changes
  React.useEffect(() => {
    if (iconRef.current && icon) {
      iconRef.current.innerHTML = '';
      setIcon(iconRef.current, icon);
    }
  }, [icon]);

  function onDragOver(ev: any) {
    ev.preventDefault()
    ev.stopPropagation()
  }

  function onDragEnter(ev: any) {
    ev.stopPropagation()
    setHoverClassName(CLASSNAME_HOVER);
  }

  function onDragLeave(ev: any) {
    // Only clear hover if we're actually leaving the column
    if (ev.currentTarget.contains(ev.relatedTarget)) {
      return;
    }
    setHoverClassName(CLASSNAME_NORMAL);
  }

  async function onDrop(ev: any) {
    ev.preventDefault()
    ev.stopPropagation()
    setHoverClassName(CLASSNAME_NORMAL);

    // Check if it's a group drag
    const groupIds = ev.dataTransfer.getData(Consts.TodoGroupDragType);
    if (groupIds) {
      const todoIds = groupIds.split(',');

      // Use batch handler if available, otherwise fall back to individual updates
      if (onBatchTodoDropped) {
        await onBatchTodoDropped(todoIds);
      } else if (onTodoDropped) {
        // Fallback: process one by one (old behavior)
        const promises = todoIds.map((todoId, index) =>
          new Promise(resolve => {
            setTimeout(() => {
              onTodoDropped(todoId);
              resolve(undefined);
            }, index * 30);
          })
        );
        await Promise.all(promises);
      }
      return;
    }

    // Handle single todo drag
    const todoId = ev.dataTransfer.getData(Consts.TodoItemDragType)
    if (todoId && onTodoDropped) {
      onTodoDropped(todoId)
    }
  }

  if (hideIfEmpty && todos.length === 0) {
    return <></>
  }

  const isEmpty = todos.length === 0;
  const isToday = substyle && substyle.includes('today');
  const emptyClass = isEmpty && !isToday ? 'th-column--empty' : '';

  return <div className={`th-column ${substyle ? `th-column--${substyle}` : ""} ${emptyClass}`.trim()}>
    <div className="th-column-header">
      <span ref={iconRef} className="th-column-icon"></span>
      <span className="th-column-title">{title}</span>
    </div>
    <div
      className={`th-column-content
        ${substyle ? `th-column-content--${substyle}` : ""}
        ${hoverClassName}
        `}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      >
        <TodoListComponent
          deps={deps}
          todos={todos}
          playSound={playSound}
        />
    </div>
  </div>
}
