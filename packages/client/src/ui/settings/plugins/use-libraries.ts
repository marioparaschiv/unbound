import { useUnboundSettings } from '~/settings/unbound';
import { isLibrary } from '~/addons/dependencies';
import type { Addon } from '~/addons/addon';

/**
 * @description Hides library plugins, the ones other plugins build on, unless the user chose to show them.
 * @param plugins Every installed plugin.
 * @returns The plugins to list, the ids of the libraries among them, whether they show, and the toggle.
 */
function useLibraries(plugins: Addon[]) {
	const settings = useUnboundSettings(({ key }) => key === 'plugins.showLibraries');
	const shown = settings.get('plugins.showLibraries');
	const libraries = new Set(
		plugins.filter((addon) => isLibrary(addon, plugins)).map((addon) => addon.id),
	);

	return {
		listed: shown ? plugins : plugins.filter((addon) => !libraries.has(addon.id)),
		libraries,
		shown,
		toggle: () => settings.set('plugins.showLibraries', !shown),
	};
}

export default useLibraries;
