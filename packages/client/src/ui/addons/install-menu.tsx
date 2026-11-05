import type { AddonKind } from '@unbound-app/types/addons';
import { useMemo } from 'react';

import { installOptions } from '~/ui/addons/open-install-sheet';
import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import type { MenuTriggerProps } from './menu-trigger';

type InstallMenuProps = {
	kind: AddonKind;
	size?: 'md' | 'lg';
};

/** @description A round `+` button whose context menu offers the ways to install another addon of `kind`. */
function InstallMenu({ kind, size = 'lg' }: InstallMenuProps) {
	const navigation = Discord.useNavigation();
	const items = useMemo(
		() =>
			installOptions(kind, navigation).map(({ label, icon, run }) => ({
				label,
				iconSource: icon,
				action: run,
			})),
		[kind, navigation],
	);

	// The menu anchors to the button it renders, so the trigger props go straight onto it.
	return (
		<Discord.ContextMenu title={messages.UNBOUND_INSTALL} items={items} triggerOnTap>
			{(props: MenuTriggerProps) => (
				<Discord.IconButton
					{...props}
					icon={icons['PlusLargeIcon'] ?? 0}
					variant='secondary'
					size={size}
					accessibilityLabel={messages.UNBOUND_INSTALL}
				/>
			)}
		</Discord.ContextMenu>
	);
}

export default InstallMenu;
