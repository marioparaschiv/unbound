import type { TargetSystem } from '~/lib/units';

const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

/**
 * @description Picks the system a reader in this locale expects, from its region.
 * @param locale A BCP 47 locale such as `en-US`.
 * @returns `imperial` for the United States, Liberia and Myanmar, `metric` otherwise.
 */
export function systemForLocale(locale: string | undefined): Exclude<TargetSystem, 'both'> {
	const region = locale?.split(/[-_]/)[1]?.toUpperCase();

	return region && IMPERIAL_REGIONS.has(region) ? 'imperial' : 'metric';
}

/**
 * @description Resolves the setting to the system conversions go into, reading the device's locale for `auto`.
 * @param setting The `system` setting.
 * @returns The target system.
 */
export function targetSystem(setting: TargetSystem | 'auto'): TargetSystem {
	if (setting !== 'auto') return setting;

	return systemForLocale(Intl.DateTimeFormat().resolvedOptions().locale);
}
