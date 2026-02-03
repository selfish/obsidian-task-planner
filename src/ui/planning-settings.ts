export type ViewMode = "default" | "today" | "future";

export interface SearchParameters {
  searchPhrase: string;
}

export interface PlanningSettings {
  searchParameters: SearchParameters;
  hideEmpty: boolean;
  hideDone: boolean;
  viewMode: ViewMode;
}

export function getDefaultSettings(): PlanningSettings {
  return {
    searchParameters: {
      searchPhrase: "",
    },
    hideEmpty: true,
    hideDone: false,
    viewMode: "default",
  };
}
