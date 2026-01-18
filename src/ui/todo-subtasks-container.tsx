import * as React from "react";
import { TodoItemComponent } from "./todo-item-component";
import { TodoItem } from "../types/todo";
import { App, TFile, setIcon } from "obsidian";
import { TaskPlannerSettings } from "../settings/types";
import { Logger } from "../types/logger";

export interface TodoSubtasksContainerDeps {
  logger: Logger;
  app: App;
  settings: TaskPlannerSettings;
}

export interface TodoSubtasksContainerProps {
  subtasks?: TodoItem<TFile>[];
  deps: TodoSubtasksContainerDeps;
  dontCrossCompleted?: boolean;
}

export function TodoSubtasksContainer({ subtasks, deps, dontCrossCompleted }: TodoSubtasksContainerProps) {
  const [isFolded, setIsFolded] = React.useState(false);
  const iconRef = React.useRef<HTMLSpanElement>(null);

  // Set icon on mount and when fold state changes
  React.useEffect(() => {
    if (iconRef.current) {
      iconRef.current.replaceChildren();
      setIcon(iconRef.current, isFolded ? "chevron-right" : "chevron-down");
    }
  }, [isFolded]);

  // Also set icon immediately after first render
  React.useLayoutEffect(() => {
    if (iconRef.current) {
      iconRef.current.replaceChildren();
      setIcon(iconRef.current, "chevron-down");
    }
  }, []);

  function onClickFoldButton(evt: React.MouseEvent) {
    if (evt.defaultPrevented) {
      return;
    }
    evt.preventDefault();
    setIsFolded(!isFolded);
  }

  // Don't render anything if no subtasks
  if (!subtasks || subtasks.length === 0) {
    return null;
  }

  return (
    <div className="subtasks-container">
      <button className="subtasks-toggle" onClick={onClickFoldButton}>
        <span ref={iconRef} className="icon"></span>
        <span className="count">
          {subtasks.length} subtask{subtasks.length !== 1 ? "s" : ""}
        </span>
      </button>
      {!isFolded && (
        <div className="subtasks">
          {subtasks.map((task) => (
            <TodoItemComponent key={task.text} todo={task} deps={deps} dontCrossCompleted={dontCrossCompleted} hideFileRef={true} />
          ))}
        </div>
      )}
    </div>
  );
}
