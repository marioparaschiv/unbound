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
	component: DeveloperPage,
	usePredicate: useDeveloperMode,
	icon: 'WrenchIcon',
};
