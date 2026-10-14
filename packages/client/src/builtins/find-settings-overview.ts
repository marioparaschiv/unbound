type OverviewModule = { default: (...args: any[]) => any };
type FinderOptions = { interop: false };
type Finder = (value: string, options: FinderOptions) => unknown;

function isOverviewModule(value: unknown): value is OverviewModule {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as Record<string, unknown>).default === 'function'
	);
}

export function findSettingsOverview(
	byName: Finder,
	byFilePath: Finder,
): OverviewModule | undefined {
	const named = byName('SettingsOverviewScreen', { interop: false });
	if (isOverviewModule(named)) return named;

	const path = byFilePath('modules/user_settings/overview/native/SettingsOverviewScreen.tsx', {
		interop: false,
	});
	return isOverviewModule(path) ? path : undefined;
}

export default findSettingsOverview;
