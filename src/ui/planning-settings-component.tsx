import * as React from "react";
import { PlanningSettings } from "./planning-settings";
import { App, setIcon } from "obsidian";

export interface PlanningSettingsComponentProps {
  setPlanningSettings: (settings: PlanningSettings) => void;
  planningSettings: PlanningSettings;
  totalTasks?: number;
  completedToday?: number;
  app?: App;
  onRefresh?: () => void;
  onOpenReport?: () => void;
}

export function PlanningSettingsComponent({ setPlanningSettings, planningSettings, totalTasks, completedToday, app, onRefresh, onOpenReport }: PlanningSettingsComponentProps) {
  const { hideEmpty, hideDone, searchParameters, viewMode } = planningSettings;
  const { searchPhrase } = searchParameters;

  function toggleHideEmpty() {
    setPlanningSettings({
      ...planningSettings,
      hideEmpty: !hideEmpty,
    });
  }

  function toggleHideDone() {
    setPlanningSettings({
      ...planningSettings,
      hideDone: !hideDone,
    });
  }

  function toggleTodayFocus() {
    setPlanningSettings({
      ...planningSettings,
      viewMode: viewMode === "today" ? "default" : "today",
    });
  }

  function toggleFutureFocus() {
    setPlanningSettings({
      ...planningSettings,
      viewMode: viewMode === "future" ? "default" : "future",
    });
  }

  function onSearchChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setPlanningSettings({
      ...planningSettings,
      searchParameters: {
        ...searchParameters,
        searchPhrase: ev.target.value,
      },
    });
  }

  function onOpenSettings() {
    if (app) {
      // Access internal Obsidian API for settings
      const appWithSettings = app as unknown as { setting: { open: () => void; openTabById: (id: string) => void } };
      appWithSettings.setting.open();
      appWithSettings.setting.openTabById("task-planner");
    }
  }

  const settingsIconRef = React.useRef<HTMLButtonElement>(null);
  const refreshIconRef = React.useRef<HTMLButtonElement>(null);
  const reportIconRef = React.useRef<HTMLButtonElement>(null);
  const hideEmptyIconRef = React.useRef<HTMLSpanElement>(null);
  const hideDoneIconRef = React.useRef<HTMLSpanElement>(null);
  const todayFocusIconRef = React.useRef<HTMLSpanElement>(null);
  const futureFocusIconRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (settingsIconRef.current && app) {
      settingsIconRef.current.replaceChildren();
      setIcon(settingsIconRef.current, "settings");
    }
    if (refreshIconRef.current && app) {
      refreshIconRef.current.replaceChildren();
      setIcon(refreshIconRef.current, "refresh-cw");
    }
    if (reportIconRef.current && app) {
      reportIconRef.current.replaceChildren();
      setIcon(reportIconRef.current, "list-checks");
    }
    if (hideEmptyIconRef.current) {
      hideEmptyIconRef.current.replaceChildren();
      setIcon(hideEmptyIconRef.current, "columns-3");
    }
    if (hideDoneIconRef.current) {
      hideDoneIconRef.current.replaceChildren();
      setIcon(hideDoneIconRef.current, "circle-check-big");
    }
    if (todayFocusIconRef.current) {
      todayFocusIconRef.current.replaceChildren();
      setIcon(todayFocusIconRef.current, "sun");
    }
    if (futureFocusIconRef.current) {
      futureFocusIconRef.current.replaceChildren();
      setIcon(futureFocusIconRef.current, "calendar-range");
    }
  }, [app]);

  const completionPercent = totalTasks > 0 ? Math.round(((completedToday || 0) / totalTasks) * 100) : 0;

  return (
    <div className="header">
      <div className="title">
        <h1>Task Planner</h1>
        {(totalTasks > 0 || completedToday > 0) && (
          <div className="stats">
            <span className="stat">{completedToday || 0} done</span>
            <span className="stat separator">•</span>
            <span className="stat">{totalTasks || 0} active</span>
            <div className="progress">
              <div className="fill" style={{ "--progress-width": `${completionPercent}%` } as React.CSSProperties}></div>
            </div>
          </div>
        )}
      </div>
      <div className="controls">
        <input type="text" className="search" placeholder="Filter tasks..." onChange={onSearchChange} value={searchPhrase} />
        <span className={"spacer"}></span>
        <button className={`toggle-btn ${hideEmpty ? "active" : ""}`} onClick={toggleHideEmpty} aria-label="Hide empty horizons">
          <span ref={hideEmptyIconRef} className="icon" />
          <span className="led" />
        </button>
        <button className={`toggle-btn ${hideDone ? "active" : ""}`} onClick={toggleHideDone} aria-label="Hide completed tasks">
          <span ref={hideDoneIconRef} className="icon" />
          <span className="led" />
        </button>
        <span className={"spacer"}></span>
        <button className={`toggle-btn ${viewMode === "today" ? "active" : ""}`} onClick={toggleTodayFocus} aria-label="Today focus">
          <span ref={todayFocusIconRef} className="icon" />
          <span className="led" />
        </button>
        <button className={`toggle-btn ${viewMode === "future" ? "active" : ""}`} onClick={toggleFutureFocus} aria-label="Future focus">
          <span ref={futureFocusIconRef} className="icon" />
          <span className="led" />
        </button>
        <span className={"spacer"}></span>
        {onOpenReport && <button ref={reportIconRef} className="settings-btn" onClick={onOpenReport} aria-label="Open report" />}
        {onRefresh && <button ref={refreshIconRef} className="settings-btn" onClick={onRefresh} aria-label="Refresh planning board" />}
        <button ref={settingsIconRef} className="settings-btn" onClick={onOpenSettings} aria-label="Open plugin settings" />
      </div>
    </div>
  );
}
