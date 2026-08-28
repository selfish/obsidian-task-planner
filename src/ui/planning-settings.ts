export type ViewMode = "default" | "today" | "future";
export type PriorityFilter = "all" | "critical" | "high" | "medium" | "low" | "lowest";

export interface SearchParameters {
  searchPhrase: string;
}

export interface PlanningSettings {
  searchParameters: SearchParameters;
  hideEmpty: boolean;
  hideDone: boolean;
  viewMode: ViewMode;
  showLoadColors: boolean;
  priorityFilter: PriorityFilter;
}

export function getDefaultSettings(): PlanningSettings {
  return {
    searchParameters: {
      searchPhrase: "",
    },
    hideEmpty: true,
    hideDone: false,
    viewMode: "default",
    showLoadColors: false,
    priorityFilter: "all",
  };
}
