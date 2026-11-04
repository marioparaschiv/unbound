import type { SettingCondition } from '@unbound-app/types/settings';
import { createLogger } from '@unbound-app/logger';

import type { DefinedSettings, SettingsValues } from '~/storage/define';

/** A predicate the build lifted out of settings.ts: it reads every setting and returns whether its row shows or is enabled. */
export type SettingPredicate = (settings: SettingsValues) => boolean;

/** One setting's lifted predicates. */
export type SettingConditions = {
	/** Draws the row only while this returns true. */
	visibleWhen?: SettingPredicate;
	/** Draws the row disabled while this returns true. */
	disabledWhen?: SettingPredicate;
};

/** Each setting's lifted predicates, by its dot-separated key. */
export type SettingPredicates = Record<string, SettingConditions>;

/** Which condition of a row is read. */
export type ConditionOption = 'visibleWhen' | 'disabledWhen';

const logger = createLogger('UI', 'SchemaPanel');
const failed = new Set<string>();

/**
 * @description Reads one condition of a row against the current settings: a boolean setting's key, or its lifted predicate.
 * A predicate that throws is logged once and reads as `undefined`, which the row takes as shown and enabled.
 * @param settings The plugin's settings.
 * @param path The row's dot-separated key.
 * @param option Which condition.
 * @param condition The condition from the schema.
 * @param predicates The lifted predicates.
 * @returns Whether it holds, or `undefined` when the row has none or it failed.
 */
export function evaluateCondition(
	settings: DefinedSettings,
	path: string,
	option: ConditionOption,
	condition: SettingCondition | undefined,
	predicates: SettingPredicates,
): boolean | undefined {
	if (condition === undefined) return;

	if (typeof condition === 'string') {
		return settings.get(condition) === true;
	}

	try {
		const predicate = predicates[path]?.[option];

		return predicate ? Boolean(predicate(settings.values)) : undefined;
	} catch (error) {
		// Logged once per predicate: it runs on every settings change.
		if (!failed.has(`${path}.${option}`)) {
			failed.add(`${path}.${option}`);
			logger.error(`Failed to evaluate ${option} for ${path}:`, error);
		}

		return;
	}
}

export default { evaluateCondition };
