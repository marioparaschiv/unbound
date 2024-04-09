import { settingSections, apply, remove } from '@core/patches/settings';
import type { ImageSourcePropType } from 'react-native';

type SectionType = {
	label: string;
	entries: AnyProps<{
		title: string,
		id: string,
		icon?: ImageSourcePropType,
		keywords?: string[],
		screen: (...args) => JSX.Element,
		mappable?: boolean;
	}>[];
};

function validateSection(section: SectionType) {
	// Ensure the label is a string
	if (typeof section.label !== 'string') {
		console.error(`Section label ${section.label} is not a string!`);
		return false;
	}

	return section.entries.every(entry => {
		// Ensure the title and id exist on the section and are strings
		if (typeof entry.title !== 'string'
			|| typeof entry.id !== 'string') {
			console.error(`This entry's id (${entry.id}) or title (${entry.title}) is not a string!`);
			return false;
		}

		// If there are keywords passed, ensure they are an array of strings
		if (entry.keywords && (!Array.isArray(entry.keywords) || !entry.keywords.every(keyword => typeof keyword === 'string'))) {
			console.error(`Keywords ${entry.keywords} are not a valid array of strings!`);
			return false;
		}

		// Ensure the screen is a function
		if (typeof entry.screen !== 'function') {
			console.error(`Screen ${entry.screen} is not a function (it is ${typeof entry.screen})!`);
			return false;
		}

		if (entry.mappable && typeof entry.mappable !== 'boolean') {
			console.error(`Entry ${entry.id} has mappable and it is not a boolean (it is ${entry.mappable})!`);
			return false;
		}

		return true;
	});
}

export function registerSettings(...sections: SectionType[]) {
	remove();
	settingSections.push(...sections.filter(validateSection));
	apply();
};