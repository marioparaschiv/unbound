import type { SectionEntry } from '~/settings/section';
import { Screens } from '~/core/constants';

export const pluginsSection: SectionEntry = {
	key: Screens.Plugins,
	titleKey: 'UNBOUND_PLUGINS',
	/**
	 * @description Loads the page when it first opens.
	 * @returns The page.
	 */
	getComponent: () => require('~/ui/settings/plugins').default,
	icon: 'PuzzlePieceIcon',
	/**
	 * @description Shows how many plugins are enabled.
	 * @returns The overview row's trailing count.
	 */
	useTrailing: () => {
		// Required on render, so startup never evaluates the UI.
		const { default: AddonCount } = require('~/ui/settings/addon-count');

		return <AddonCount kind='plugin' />;
	},
};

export default { pluginsSection };
