export interface SearchParameters {
  searchPhrase: string;
}

export interface WipLimit {
  dailyLimit: number;
  isLimited: boolean;
}

export interface PlanningSettings {
  searchParameters: SearchParameters;
  hideEmpty: boolean;
  hideDone: boolean;
  wipLimit: WipLimit;
}

export function getDefaultSettings(): PlanningSettings {
  return {
    searchParameters: {
      searchPhrase: "",
    },
    hideEmpty: true,
    hideDone: false,
    wipLimit: {
      dailyLimit: 5,
      isLimited: false,
    },
  };
}
