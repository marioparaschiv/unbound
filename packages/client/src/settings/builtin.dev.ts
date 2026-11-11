import { useUnboundSettings } from '~/settings/unbound';
import DeveloperPage from '~/ui/settings/developer.dev';
import type { SectionEntry } from '~/settings/section';
import { Screens } from '~/core/constants';

function useDeveloperMode(): boolean {
	return useUnboundSettings(({ key }) => key === 'developer-mode').get('developer-mode');
}

export const developerSection: SectionEntry = {
	key: Screens.Developer,
	titleKey: 'UNBOUND_DEVELOPER',
	/**
	 * @description Hands Discord's navigator the page.
	 * @returns The page.
	 */
	getComponent: () => DeveloperPage,
	usePredicate: useDeveloperMode,
	icon: 'WrenchIcon',
};
