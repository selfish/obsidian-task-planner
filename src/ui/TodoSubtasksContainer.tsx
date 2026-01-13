import * as React from "react";
import { TodoItemComponent } from "./TodoItemComponent";
import { TodoItem } from "../domain/TodoItem";
import { App, TFile } from "obsidian";
import { TaskPlannerSettings } from "../domain/TaskPlannerSettings";
import { ILogger } from "../domain/ILogger";
import { TaskPlannerEvent } from "../events/TaskPlannerEvent";
import { Sound } from "./SoundPlayer";

export interface TodoSubtasksContainerDeps {
  logger: ILogger;
  app: App;
  settings: TaskPlannerSettings;
}

export interface TodoSubtasksContainerProps {
  subtasks?: TodoItem<TFile>[];
  deps: TodoSubtasksContainerDeps;
  playSound?: TaskPlannerEvent<Sound>;
  dontCrossCompleted?: boolean;
}

export function TodoSubtasksContainer({subtasks, deps, playSound, dontCrossCompleted}: TodoSubtasksContainerProps) {
  const [isFolded, setIsFolded] = React.useState(false);

  function toggleSubElement() {
    setIsFolded(!isFolded);
  }

  function onClickFoldButton(evt: any) {
    if (evt.defaultPrevented) {
      return
    }
    evt.preventDefault()
    toggleSubElement()
  }

  // Don't render anything if no subtasks
  if (!subtasks || subtasks.length === 0) {
    return null;
  }

  return <>
    <span className="th-subtasks-toggle" onClick={onClickFoldButton}>
      {isFolded ? " ▶" : " ▼"}
    </span>
    {
      isFolded
      ? ""
      : <div className="th-subtasks-container">
        {subtasks.map(task => <TodoItemComponent
          key={task.text} todo={task} deps={deps} playSound={playSound} dontCrossCompleted={dontCrossCompleted}/>)}
      </div>
    }
  </>;
}
