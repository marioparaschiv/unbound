import { useUnboundSettings } from '~/settings/unbound';
import type { SectionEntry } from '~/settings/section';
import { Screens } from '~/core/constants';

function useDeveloperMode(): boolean {
	return useUnboundSettings(({ key }) => key === 'developer-mode').get('developer-mode');
}

export const logsSection: SectionEntry = {
	key: Screens.Logs,
	titleKey: 'UNBOUND_LOGS',
	/**
	 * @description Loads the page when it first opens.
	 * @returns The page.
	 */
	getComponent: () => require('~/ui/settings/logs').default,
	usePredicate: useDeveloperMode,
	icon: 'PaperIcon',
};
