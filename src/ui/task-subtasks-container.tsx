import { TFile, setIcon } from "obsidian";

import * as React from "react";

import { StandardDependencies } from "./standard-dependencies";
import { TodoItemComponent } from "./task-item-component";
import { TaskItem, TaskStatus, getTaskId } from "../types/task";

export interface TodoSubtasksContainerProps {
  subtasks?: TaskItem<TFile>[];
  deps: StandardDependencies;
  dontCrossCompleted?: boolean;
}

function countCompleted<T>(subtasks: TaskItem<T>[]): number {
  return subtasks.filter((t) => t.status === TaskStatus.Complete || t.status === TaskStatus.Canceled).length;
}

export function TodoSubtasksContainer({ subtasks, deps, dontCrossCompleted }: TodoSubtasksContainerProps) {
  const [isFolded, setIsFolded] = React.useState(true);

  // Filter out subtasks that have been promoted (have their own due dates)
  const visibleSubtasks = React.useMemo(() => {
    if (!subtasks) return [];
    const promoted = deps.promotedSubtaskIds;
    if (!promoted || promoted.size === 0) return subtasks;
    return subtasks.filter((t) => !promoted.has(getTaskId(t)));
  }, [subtasks, deps.promotedSubtaskIds]);

  // Use callback ref for chevron icon
  const setChevronRef = React.useCallback(
    (node: HTMLSpanElement | null) => {
      if (node) {
        node.replaceChildren();
        setIcon(node, isFolded ? "chevron-right" : "chevron-down");
      }
    },
    [isFolded]
  );

  function onClickToggle(evt: React.MouseEvent) {
    if (evt.defaultPrevented) return;
    evt.preventDefault();
    evt.stopPropagation();
    setIsFolded(!isFolded);
  }

  if (visibleSubtasks.length === 0) {
    return null;
  }

  const completed = countCompleted(visibleSubtasks);
  const total = visibleSubtasks.length;
  const allDone = completed === total;
  const progressPercent = (completed / total) * 100;

  return (
    <div className={`subtasks-container ${isFolded ? "folded" : "expanded"} ${allDone ? "all-done" : ""}`}>
      <button className="subtasks-toggle" onClick={onClickToggle} aria-expanded={!isFolded}>
        <span ref={setChevronRef} className="chevron"></span>
        <span className="progress">
          <span className="bar" style={{ width: `${progressPercent}%` }}></span>
        </span>
        <span className="count">
          {completed}/{total}
        </span>
      </button>
      {!isFolded && (
        <div className="subtasks">
          {visibleSubtasks.map((task) => (
            <TodoItemComponent key={task.text} todo={task} deps={deps} dontCrossCompleted={dontCrossCompleted} hideFileRef={true} />
          ))}
        </div>
      )}
    </div>
  );
}
