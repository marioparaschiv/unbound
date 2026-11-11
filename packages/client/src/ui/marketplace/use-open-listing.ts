import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';

import { Discord } from '~/metro/components';
import { Screens } from '~/core/constants';

import type { AddonPageParams } from './addon-page';

import { offerListedInstall } from './offer-listed-install';

/**
 * @description Opens a listed addon: its addon page, or, for a version without one, the install prompt.
 * @returns The opener, taking the addon and the manager it belongs to.
 */
function useOpenListing() {
	const navigation = Discord.useNavigation();

	return (addon: ListedAddon, kind: AddonKind) => {
		if (!addon.latestVersion.pageUrl) {
			void offerListedInstall(kind, addon);

			return;
		}

		const params: AddonPageParams = { addon, kind };

		navigation.push(Screens.AddonPage, params);
	};
}

export default useOpenListing;
