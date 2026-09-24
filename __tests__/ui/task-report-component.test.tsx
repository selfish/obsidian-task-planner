import * as React from "react";

import { fireEvent, render, within } from "@testing-library/react";
import { App, TFile } from "obsidian";

import { DEFAULT_SETTINGS } from "../../src/settings/types";
import { TaskReportComponent, TaskReportComponentDeps } from "../../src/ui/task-report-component";
import { TaskItem, TaskStatus } from "../../src/types/task";

jest.mock("../../src/ui/task-list-component", () => ({
  TaskListComponent: ({ todos }: { todos: TaskItem<TFile>[] }) => (
    <ul>
      {todos.map((todo) => (
        <li key={`${todo.file.id}-${todo.line}`}>{todo.text}</li>
      ))}
    </ul>
  ),
}));

function task(text: string, status: TaskStatus, line: number, attributes: Record<string, string> = {}): TaskItem<TFile> {
  const path = `Tasks/${line}.md`;
  return {
    text,
    status,
    line,
    attributes,
    file: { id: path, file: new TFile(path) },
  };
}

function setup(tasks: TaskItem<TFile>[]) {
  const deps: TaskReportComponentDeps = {
    app: new App(),
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    settings: DEFAULT_SETTINGS,
    taskIndex: {
      tasks,
      onUpdateEvent: { listen: jest.fn(() => jest.fn()) },
    } as unknown as TaskReportComponentDeps["taskIndex"],
  };
  return render(<TaskReportComponent deps={deps} />);
}

function sectionByTitle(container: HTMLElement, title: string): HTMLElement {
  const section = Array.from(container.querySelectorAll<HTMLElement>(".report-section")).find((candidate) => candidate.querySelector(".section-title")?.textContent === title);
  if (!section) throw new Error(`Missing report section: ${title}`);
  return section;
}

describe("completed-task report grouping", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-24T12:00:00"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows every matching task exactly once without treating due dates as completion dates", () => {
    const tasks = [
      task("Completed today", TaskStatus.Complete, 1, { completed: "2026-09-24" }),
      task("Future completion", TaskStatus.Complete, 2, { completed: "2026-09-25" }),
      task("Future due only", TaskStatus.Complete, 3, { due: "2099-01-01" }),
      task("Invalid completion", TaskStatus.Complete, 4, { completed: "2026-13-40", due: "2026-09-01" }),
      task("Canceled earlier", TaskStatus.Canceled, 5, { completed: "2026-08-10" }),
      task("Still open", TaskStatus.Todo, 6, { due: "2026-09-24" }),
    ];

    const { container } = setup(tasks);

    expect(container).toHaveTextContent("5 total");
    expect(container).toHaveTextContent("4 completed");
    expect(container).toHaveTextContent("1 canceled");
    expect(container.querySelector(".result-count")).toHaveTextContent("5 tasks in 4 periods");

    expect(within(sectionByTitle(container, "Future completion date")).getByText("Future completion")).toBeInTheDocument();
    const noDate = sectionByTitle(container, "No completion date");
    expect(within(noDate).getByText("Future due only")).toBeInTheDocument();
    expect(within(noDate).getByText("Invalid completion")).toBeInTheDocument();
    expect(within(noDate).queryByText("Canceled earlier")).not.toBeInTheDocument();

    for (const text of ["Completed today", "Future completion", "Future due only", "Invalid completion", "Canceled earlier"]) {
      expect(within(container.querySelector(".report-content") as HTMLElement).getAllByText(text)).toHaveLength(1);
    }
    expect(container).not.toHaveTextContent("Still open");
  });

  it("keeps search, status filters, and displayed counts aligned with the grouped tasks", () => {
    const { container } = setup([
      task("Alpha completed", TaskStatus.Complete, 1, { completed: "2026-09-24" }),
      task("Beta future", TaskStatus.Complete, 2, { completed: "2026-09-25" }),
      task("Gamma canceled", TaskStatus.Canceled, 3),
    ]);
    const search = container.querySelector<HTMLInputElement>(".search") as HTMLInputElement;
    const status = container.querySelector<HTMLSelectElement>(".status-filter") as HTMLSelectElement;

    fireEvent.change(search, { target: { value: "Beta" } });
    expect(container.querySelector(".result-count")).toHaveTextContent("1 task in 1 period");
    expect(within(sectionByTitle(container, "Future completion date")).getByText("Beta future")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "" } });
    fireEvent.change(status, { target: { value: "canceled" } });
    expect(container.querySelector(".result-count")).toHaveTextContent("1 task in 1 period");
    expect(within(sectionByTitle(container, "No completion date")).getByText("Gamma canceled")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "missing" } });
    expect(container.querySelector(".result-count")).toHaveTextContent("0 tasks in 0 periods");
    expect(container).toHaveTextContent("No canceled tasks found");
  });

  it("places completion dates on week and month boundaries in one period each", () => {
    const tasks = [
      task("Current week start", TaskStatus.Complete, 1, { completed: "2026-09-21" }),
      task("Previous week end", TaskStatus.Complete, 2, { completed: "2026-09-20" }),
      task("Previous week start", TaskStatus.Complete, 3, { completed: "2026-09-14" }),
      task("Earlier week end", TaskStatus.Complete, 4, { completed: "2026-09-13" }),
      task("Weekly range start", TaskStatus.Complete, 5, { completed: "2026-08-31" }),
      task("August end", TaskStatus.Complete, 6, { completed: "2026-08-30" }),
      task("August start", TaskStatus.Complete, 7, { completed: "2026-08-01" }),
      task("July end", TaskStatus.Complete, 8, { completed: "2026-07-31" }),
    ];

    const { container } = setup(tasks);

    expect(within(sectionByTitle(container, "Sep 21 - Sep 24")).getByText("Current week start")).toBeInTheDocument();
    const previousWeek = sectionByTitle(container, "Sep 14 - Sep 20");
    expect(within(previousWeek).getByText("Previous week end")).toBeInTheDocument();
    expect(within(previousWeek).getByText("Previous week start")).toBeInTheDocument();
    expect(within(sectionByTitle(container, "Sep 7 - Sep 13")).getByText("Earlier week end")).toBeInTheDocument();
    expect(within(sectionByTitle(container, "Aug 31 - Sep 6")).getByText("Weekly range start")).toBeInTheDocument();
    const august = sectionByTitle(container, "August 2026");
    expect(within(august).getByText("August end")).toBeInTheDocument();
    expect(within(august).getByText("August start")).toBeInTheDocument();
    expect(within(sectionByTitle(container, "July 2026")).getByText("July end")).toBeInTheDocument();

    const reportContent = container.querySelector(".report-content") as HTMLElement;
    for (const todo of tasks) {
      expect(within(reportContent).getAllByText(todo.text)).toHaveLength(1);
    }
  });
});
