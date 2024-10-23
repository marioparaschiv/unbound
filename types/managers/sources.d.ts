export interface Source {
	id: string;
	url: string;
	tags: string[];
}

export interface SourceAddon {
	descriptionURL: string;
	changelogURL: string;
	manifestURL: string;

	addonSuggestions: string[];
}