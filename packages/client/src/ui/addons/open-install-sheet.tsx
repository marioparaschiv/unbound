import type { AddonKind } from '@unbound-app/types/addons';

import { Discord } from '~/metro/components';
import { Screens } from '~/core/constants';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import InstallUrlModal from './install-url-modal';

type MarketplaceParams = { kind: AddonKind };

type Navigation = { push: (screen: string, params: MarketplaceParams) => void };

/** One way to install an addon, shaped for both an action sheet and a context menu. */
export type InstallOption = {
	label: string;
	icon: number | undefined;
	run: () => void;
};

function openInstallUrlModal(kind: AddonKind) {
	Discord.openAlert(
		'unbound-install',
		<InstallUrlModal kind={kind} onClose={() => Discord.dismissAlert('unbound-install')} />,
	);
}

/**
 * @description The ways to install one addon kind: by URL, or by browsing the marketplace on its tab.
 * @param kind The addon kind to install.
 * @param navigation The stack to push the marketplace onto.
 * @returns The install options, in display order.
 */
export function installOptions(kind: AddonKind, navigation: Navigation): InstallOption[] {
	return [
		{
			label: messages.UNBOUND_INSTALL_FROM_URL,
			icon: icons['LinkIcon'],
			run: () => openInstallUrlModal(kind),
		},
		{
			label: messages.UNBOUND_BROWSE_MARKETPLACE,
			icon: icons['ShopIcon'],
			run: () => navigation.push(Screens.Marketplace, { kind }),
		},
	];
}

/**
 * @description Offers {@link installOptions} in an action sheet, so any trigger works without a layout
 * box to anchor a menu to.
 * @param kind The addon kind to install.
 * @param navigation The stack to push the marketplace onto.
 */
export function openInstallSheet(kind: AddonKind, navigation: Navigation): void {
	Discord.showSimpleActionSheet({
		key: 'unbound-install',
		header: { title: messages.UNBOUND_INSTALL },
		options: installOptions(kind, navigation).map(({ label, icon, run }) => ({
			label,
			icon,
			onPress: run,
		})),
	});
}
