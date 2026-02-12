import { App } from "obsidian";

import * as React from "react";

import { useIconRef } from "./hooks";
import { PlanningSettings } from "./planning-settings";

export interface PlanningSettingsComponentProps {
  setPlanningSettings: (settings: PlanningSettings) => void;
  planningSettings: PlanningSettings;
  showIgnored: boolean;
  setShowIgnored: (value: boolean) => void;
  totalTasks?: number;
  completedToday?: number;
  app?: App;
  onRefresh?: () => void;
  onOpenReport?: () => void;
  onQuickAdd?: () => void;
}

export function PlanningSettingsComponent({ setPlanningSettings, planningSettings, showIgnored, setShowIgnored, totalTasks, completedToday, app, onRefresh, onOpenReport, onQuickAdd }: PlanningSettingsComponentProps): React.ReactElement {
  const { hideEmpty, hideDone, searchParameters, viewMode } = planningSettings;
  const { searchPhrase } = searchParameters;

  function toggleHideEmpty(): void {
    setPlanningSettings({ ...planningSettings, hideEmpty: !hideEmpty });
  }

  function toggleHideDone(): void {
    setPlanningSettings({ ...planningSettings, hideDone: !hideDone });
  }

  function toggleShowIgnored(): void {
    setShowIgnored(!showIgnored);
  }

  function toggleTodayFocus(): void {
    setPlanningSettings({ ...planningSettings, viewMode: viewMode === "today" ? "default" : "today" });
  }

  function toggleFutureFocus(): void {
    setPlanningSettings({ ...planningSettings, viewMode: viewMode === "future" ? "default" : "future" });
  }

  function onSearchChange(ev: React.ChangeEvent<HTMLInputElement>): void {
    setPlanningSettings({
      ...planningSettings,
      searchParameters: { ...searchParameters, searchPhrase: ev.target.value },
    });
  }

  function onOpenSettings(): void {
    if (app) {
      const appWithSettings = app as unknown as { setting: { open: () => void; openTabById: (id: string) => void } };
      appWithSettings.setting.open();
      appWithSettings.setting.openTabById("task-planner");
    }
  }

  const settingsIconRef = useIconRef("settings");
  const refreshIconRef = useIconRef("refresh-cw");
  const reportIconRef = useIconRef("list-checks");
  const quickAddIconRef = useIconRef("plus");
  const hideEmptyIconRef = useIconRef("columns-3");
  const hideDoneIconRef = useIconRef("circle-check-big");
  const showIgnoredIconRef = useIconRef("eye-off");
  const todayFocusIconRef = useIconRef("sun");
  const futureFocusIconRef = useIconRef("calendar-range");

  const completionPercent = totalTasks && totalTasks > 0 ? Math.round(((completedToday || 0) / totalTasks) * 100) : 0;

  return (
    <div className="header">
      <div className="title">
        <h1>Task Planner</h1>
        {((totalTasks && totalTasks > 0) || (completedToday && completedToday > 0)) && (
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
        <span className="spacer"></span>
        {onQuickAdd && <button ref={quickAddIconRef} className="settings-btn" onClick={onQuickAdd} aria-label="Quick add task" title="Quick add task" />}
        <button className={`toggle-btn ${hideEmpty ? "active" : ""}`} onClick={toggleHideEmpty} aria-label="Hide empty horizons" title="Hide empty horizons">
          <span ref={hideEmptyIconRef} className="icon" />
          <span className="led" />
        </button>
        <button className={`toggle-btn ${hideDone ? "active" : ""}`} onClick={toggleHideDone} aria-label="Hide completed tasks" title="Hide completed tasks">
          <span ref={hideDoneIconRef} className="icon" />
          <span className="led" />
        </button>
        <button className={`toggle-btn ${showIgnored ? "active" : ""}`} onClick={toggleShowIgnored} aria-label="View ignored tasks only" title="View ignored tasks only">
          <span ref={showIgnoredIconRef} className="icon" />
          <span className="led" />
        </button>
        <span className="spacer"></span>
        <button className={`toggle-btn ${viewMode === "today" ? "active" : ""}`} onClick={toggleTodayFocus} aria-label="Today focus" title="Today focus">
          <span ref={todayFocusIconRef} className="icon" />
          <span className="led" />
        </button>
        <button className={`toggle-btn ${viewMode === "future" ? "active" : ""}`} onClick={toggleFutureFocus} aria-label="Future focus" title="Future focus">
          <span ref={futureFocusIconRef} className="icon" />
          <span className="led" />
        </button>
        <span className="spacer"></span>
        {onOpenReport && <button ref={reportIconRef} className="settings-btn" onClick={onOpenReport} aria-label="Open report" title="Open report" />}
        {onRefresh && <button ref={refreshIconRef} className="settings-btn" onClick={onRefresh} aria-label="Refresh" title="Refresh" />}
        <button ref={settingsIconRef} className="settings-btn" onClick={onOpenSettings} aria-label="Settings" title="Settings" />
      </div>
    </div>
  );
}
