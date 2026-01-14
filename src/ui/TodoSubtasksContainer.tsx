import * as React from "react";
import { TodoItemComponent } from "./TodoItemComponent";
import { TodoItem } from "../types/todo";
import { App, TFile } from "obsidian";
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

  function toggleSubElement() {
    setIsFolded(!isFolded);
  }

  function onClickFoldButton(evt: React.MouseEvent) {
    if (evt.defaultPrevented) {
      return;
    }
    evt.preventDefault();
    toggleSubElement();
  }

  // Don't render anything if no subtasks
  if (!subtasks || subtasks.length === 0) {
    return null;
  }

  return (
    <>
      <span className="th-subtasks-toggle" onClick={onClickFoldButton}>
        {isFolded ? " ▶" : " ▼"}
      </span>
      {isFolded ? (
        ""
      ) : (
        <div className="th-subtasks-container">
          {subtasks.map((task) => (
            <TodoItemComponent key={task.text} todo={task} deps={deps} dontCrossCompleted={dontCrossCompleted} />
          ))}
        </div>
      )}
    </>
  );
}
