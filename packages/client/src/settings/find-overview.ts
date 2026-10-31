import type { DiscordFunction } from '@unbound-app/types/components';

import type { AnyProps, MetroFunction, MetroSearchOptions } from '~/metro';

type OverviewModule = { default: DiscordFunction };
type Finder = (
	value: string,
	options: MetroSearchOptions,
) => AnyProps | OverviewModule | MetroFunction | undefined;

function isOverviewModule(value: unknown): value is OverviewModule {
	if (typeof value !== 'object' || value === null || !('default' in value)) {
		return false;
	}

	return typeof value.default === 'function';
}

function findSettingsOverview(byName: Finder, byFilePath: Finder): OverviewModule | undefined {
	const named = byName('SettingsOverviewScreen', { interop: false });

	if (isOverviewModule(named)) {
		return named;
	}

	const path = byFilePath('modules/user_settings/overview/native/SettingsOverviewScreen.tsx', {
		interop: false,
	});

	if (isOverviewModule(path)) {
		return path;
	}

	return undefined;
}

export default findSettingsOverview;
