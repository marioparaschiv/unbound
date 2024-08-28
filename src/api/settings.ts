import { settingSections, apply, remove } from '@core/patches/settings';
import type { SectionType } from '@typings/api/settings';
import { createLogger } from '@structures/logger';

export type * from '@typings/api/settings';


const Logger = createLogger('Settings');

export const settings = settingSections;

function validateSection(section: SectionType) {
	// Ensure the label is a string
	if (typeof section.label !== 'string') {
		Logger.error(`Section label ${section.label} is not a string!`);
		return false;
	}

	return section.entries.every(entry => {
		// Ensure the title and id exist on the section and are strings
		if (typeof entry.title !== 'string' || typeof entry.id !== 'string') {
			Logger.error(`This entry's id (${entry.id}) or title (${entry.title}) is not a string!`);
			return false;
		}

		// If there are keywords passed, ensure they are an array of strings
		if (entry.keywords && (!Array.isArray(entry.keywords) || !entry.keywords.every(keyword => typeof keyword === 'string'))) {
			Logger.error(`Keywords ${entry.keywords} are not a valid array of strings!`);
			return false;
		}

		// Ensure the screen is a function
		if (typeof entry.screen !== 'function') {
			Logger.error(`Screen ${entry.screen} is not a function (it is ${typeof entry.screen})!`);
			return false;
		}

		if (entry.mappable && typeof entry.mappable !== 'boolean') {
			Logger.error(`Entry ${entry.id} has mappable and it is not a boolean (it is ${entry.mappable})!`);
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