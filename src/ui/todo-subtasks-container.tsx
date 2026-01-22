import { App, TFile, setIcon } from "obsidian";

import * as React from "react";

import { TodoItemComponent } from "./todo-item-component";
import { TaskPlannerSettings } from "../settings/types";
import { Logger } from "../types/logger";
import { TodoItem } from "../types/todo";

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

  // Use callback ref to ensure icon renders on mount and updates on fold change
  const setIconRef = React.useCallback(
    (node: HTMLSpanElement | null) => {
      if (node) {
        node.replaceChildren();
        setIcon(node, isFolded ? "chevron-right" : "chevron-down");
      }
    },
    [isFolded]
  );

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
        <span ref={setIconRef} className="icon"></span>
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
