import type { PickedColor } from './token-matches';
import type { ColorGroup } from './token-groups';

import { COLOR_GROUPS, tokenGroup } from './token-groups';

/** A token that could draw a picked colour, with that colour as `#rrggbbaa`. */
export type PickedToken = {
	token: string;
	color: string;
};

/** The picked tokens of one {@link COLOR_GROUPS} group. */
export type PickedSection = {
	key: string;
	tokens: PickedToken[];
};

/** The sections of picked tokens, and the colours no token draws. */
type PickedSections = {
	sections: PickedSection[];
	unmatched: string[];
};

/**
 * @description Sorts the tokens of picked colours into All Colors groups by name prefix, so ten `BACKGROUND_` tokens share one section.
 * @param colors The picked colours, each with its matching tokens.
 * @returns The sections in the order their first token was picked, and the colours no token draws.
 */
export function sectionPicked(colors: readonly PickedColor[]): PickedSections {
	const sections = new Map<string, PickedSection>();
	const seen = new Set<string>();
	const unmatched: string[] = [];

	for (const { color, tokens } of colors) {
		if (!tokens.length) {
			unmatched.push(color);
		}

		for (const token of tokens) {
			if (seen.has(token)) {
				continue;
			}

			seen.add(token);

			const key = tokenGroup(token);
			const section = sections.get(key) ?? { key, tokens: [] };

			section.tokens.push({ token, color });
			sections.set(key, section);
		}
	}

	return { sections: [...sections.values()], unmatched };
}

/**
 * @description Finds the title of a section.
 * @param key The section's group key.
 * @returns The group's message key, if the group exists.
 */
export function sectionTitle(key: string): ColorGroup['title'] | undefined {
	return COLOR_GROUPS.find((group) => group.key === key)?.title;
}
