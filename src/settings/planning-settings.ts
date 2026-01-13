export interface SearchParameters {
	searchPhrase: string;
	fuzzySearch: boolean;
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
			fuzzySearch: false,
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
